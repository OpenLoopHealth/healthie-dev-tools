import { performance } from 'perf_hooks';

interface QueryVariables {
  startDate: string;
  endDate: string;
  appointmentTypeId: string;
  providerId: string;
  state: string;
  timezone: string;
}

interface QueryResult {
  availableSlotsForRange: Array<{
    user_id: string;
    date: string;
  }>;
}

interface PerformanceMetrics {
  p0: number;
  p25: number;
  p50: number;
  p75: number;
  p90: number;
  p95: number;
  p99: number;
  p100: number;
  mean: number;
  stdDev: number;
}

interface StrategyResult {
  strategy: {
    name: string;
    totalQueries: number;
    daysPerQuery: number;
    concurrency: number;
  };
  metrics: PerformanceMetrics;
  measurements: number[];
  totalTime: number;
  averageTimePerQuery: number;
  errors: number;
}

interface OptimizerConfig {
  endpoint: string;
  baseVariables: {
    appointmentTypeId: string;
    providerId: string;
    state: string;
    timezone: string;
  };
  daysAhead: number;
  iterations: number;
  headers?: Record<string, string>;
  strategies?: Array<{
    name: string;
    daysPerQuery: number;
    concurrency: number;
  }>;
}

class AvailabilityQueryOptimizer {
  private config: OptimizerConfig;
  
  constructor(config: OptimizerConfig) {
    this.config = config;
  }
  
  private generateDateRanges(daysPerChunk: number): Array<{ start: string; end: string }> {
    const ranges: Array<{ start: string; end: string }> = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    let currentStart = new Date(today);
    const finalEnd = new Date(today);
    finalEnd.setDate(finalEnd.getDate() + this.config.daysAhead);
    
    while (currentStart < finalEnd) {
      const currentEnd = new Date(currentStart);
      currentEnd.setDate(currentEnd.getDate() + daysPerChunk - 1);
      
      if (currentEnd > finalEnd) {
        currentEnd.setTime(finalEnd.getTime());
      }
      
      ranges.push({
        start: this.formatDate(currentStart),
        end: this.formatDate(currentEnd)
      });
      
      currentStart = new Date(currentEnd);
      currentStart.setDate(currentStart.getDate() + 1);
    }
    
    return ranges;
  }
  
  private formatDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
  
  private async executeQuery(variables: QueryVariables): Promise<QueryResult> {
    const query = `
      query AvailableSlots(
        $startDate: String!
        $endDate: String!
        $appointmentTypeId: String!
        $providerId: String!
        $state: String!
        $timezone: String!
      ) {
        availableSlotsForRange(
          start_date: $startDate
          end_date: $endDate
          appt_type_id: $appointmentTypeId
          provider_id: $providerId
          licensed_in_state: $state
          org_level: true
          timezone: $timezone
        ) {
          user_id
          date
        }
      }
    `;
    
    const response = await fetch(this.config.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...this.config.headers
      },
      body: JSON.stringify({
        query,
        variables
      })
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    
    if (data.errors) {
      throw new Error(`GraphQL errors: ${JSON.stringify(data.errors)}`);
    }
    
    return data.data;
  }
  
  private async executeQueriesWithConcurrency(
    ranges: Array<{ start: string; end: string }>,
    concurrency: number
  ): Promise<{ results: QueryResult[]; duration: number }> {
    const startTime = performance.now();
    const results: QueryResult[] = [];
    const errors: Error[] = [];
    
    const queryPromises = ranges.map(range => async () => {
      const variables: QueryVariables = {
        startDate: range.start,
        endDate: range.end,
        ...this.config.baseVariables
      };
      
      try {
        const result = await this.executeQuery(variables);
        results.push(result);
      } catch (error) {
        errors.push(error as Error);
      }
    });
    
    const inFlight: Promise<void>[] = [];
    
    for (const queryPromise of queryPromises) {
      if (inFlight.length >= concurrency) {
        await Promise.race(inFlight);
      }
      
      const promise = queryPromise().then(() => {
        inFlight.splice(inFlight.indexOf(promise), 1);
      });
      
      inFlight.push(promise);
    }
    
    await Promise.all(inFlight);
    
    const endTime = performance.now();
    
    if (errors.length > 0) {
      console.error(`Encountered ${errors.length} errors:`, errors[0].message);
    }
    
    return {
      results,
      duration: endTime - startTime
    };
  }
  
  private calculatePercentiles(values: number[]): PerformanceMetrics {
    const sorted = [...values].sort((a, b) => a - b);
    const len = sorted.length;
    
    const percentile = (p: number): number => {
      const index = (len - 1) * p;
      const lower = Math.floor(index);
      const upper = Math.ceil(index);
      const weight = index % 1;
      
      if (lower === upper) {
        return sorted[lower];
      }
      
      return sorted[lower] * (1 - weight) + sorted[upper] * weight;
    };
    
    const mean = values.reduce((a, b) => a + b, 0) / len;
    const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / len;
    const stdDev = Math.sqrt(variance);
    
    return {
      p0: sorted[0],
      p25: percentile(0.25),
      p50: percentile(0.50),
      p75: percentile(0.75),
      p90: percentile(0.90),
      p95: percentile(0.95),
      p99: percentile(0.99),
      p100: sorted[len - 1],
      mean,
      stdDev
    };
  }
  
  private async testStrategy(
    name: string,
    daysPerQuery: number,
    concurrency: number
  ): Promise<StrategyResult> {
    const ranges = this.generateDateRanges(daysPerQuery);
    const measurements: number[] = [];
    let totalErrors = 0;
    
    console.log(`\nTesting strategy: ${name}`);
    console.log(`  - Days per query: ${daysPerQuery}`);
    console.log(`  - Total queries: ${ranges.length}`);
    console.log(`  - Concurrency: ${concurrency}`);
    console.log(`  - Iterations: ${this.config.iterations}`);
    
    for (let i = 0; i < this.config.iterations; i++) {
      process.stdout.write(`  - Iteration ${i + 1}/${this.config.iterations}...`);
      
      try {
        const { duration } = await this.executeQueriesWithConcurrency(ranges, concurrency);
        measurements.push(duration);
        process.stdout.write(` ${duration.toFixed(2)}ms\n`);
      } catch (error) {
        totalErrors++;
        process.stdout.write(` ERROR\n`);
      }
    }
    
    const metrics = this.calculatePercentiles(measurements);
    const totalTime = measurements.reduce((a, b) => a + b, 0);
    
    return {
      strategy: {
        name,
        totalQueries: ranges.length,
        daysPerQuery,
        concurrency
      },
      metrics,
      measurements,
      totalTime,
      averageTimePerQuery: totalTime / (ranges.length * this.config.iterations),
      errors: totalErrors
    };
  }
  
  private generateDefaultStrategies(): Array<{ name: string; daysPerQuery: number; concurrency: number }> {
    const strategies: Array<{ name: string; daysPerQuery: number; concurrency: number }> = [];
    
    const chunkSizes = [1, 2, 3, 5, 7, 10, 14, 21, 30].filter(size => size <= this.config.daysAhead);
    
    const concurrencyLevels = [1, 3, 5, 10, 20];
    
    for (const chunkSize of chunkSizes) {
      for (const concurrency of concurrencyLevels) {
        const totalQueries = Math.ceil(this.config.daysAhead / chunkSize);
        if (concurrency > totalQueries) continue;
        
        strategies.push({
          name: `${chunkSize}d-${concurrency}c`,
          daysPerQuery: chunkSize,
          concurrency
        });
      }
    }
    
    return strategies;
  }
  
  async optimize(): Promise<{
    results: StrategyResult[];
    recommendation: StrategyResult;
  }> {
    console.log('=== Availability Query Performance Optimizer ===');
    console.log(`Endpoint: ${this.config.endpoint}`);
    console.log(`Days ahead: ${this.config.daysAhead}`);
    console.log(`Iterations per strategy: ${this.config.iterations}`);
    
    const strategies = this.config.strategies || this.generateDefaultStrategies();
    const results: StrategyResult[] = [];
    
    console.log(`\nTesting ${strategies.length} strategies...`);
    
    for (const strategy of strategies) {
      const result = await this.testStrategy(
        strategy.name,
        strategy.daysPerQuery,
        strategy.concurrency
      );
      results.push(result);
    }
    
    results.sort((a, b) => a.metrics.p50 - b.metrics.p50);
    
    console.log('\n=== Results Summary ===\n');
    console.log('Strategy         | Queries | Days/Q | Conc | p50 (ms) | p90 (ms) | p99 (ms) | Mean (ms) | Errors');
    console.log('-----------------|---------|--------|------|----------|----------|----------|-----------|-------');
    
    for (const result of results) {
      console.log(
        `${result.strategy.name.padEnd(16)} | ` +
        `${result.strategy.totalQueries.toString().padStart(7)} | ` +
        `${result.strategy.daysPerQuery.toString().padStart(6)} | ` +
        `${result.strategy.concurrency.toString().padStart(4)} | ` +
        `${result.metrics.p50.toFixed(0).padStart(8)} | ` +
        `${result.metrics.p90.toFixed(0).padStart(8)} | ` +
        `${result.metrics.p99.toFixed(0).padStart(8)} | ` +
        `${result.metrics.mean.toFixed(0).padStart(9)} | ` +
        `${result.errors.toString().padStart(6)}`
      );
    }
    
    const recommendation = results.find(r => r.errors === 0) || results[0];
    
    console.log('\n=== Recommendation ===');
    console.log(`Best strategy: ${recommendation.strategy.name}`);
    console.log(`  - ${recommendation.strategy.daysPerQuery} days per query`);
    console.log(`  - ${recommendation.strategy.concurrency} concurrent requests`);
    console.log(`  - Median response time: ${recommendation.metrics.p50.toFixed(2)}ms`);
    console.log(`  - 99th percentile: ${recommendation.metrics.p99.toFixed(2)}ms`);
    
    const fs = await import('fs/promises');
    const resultsPath = `./optimization-results-${new Date().toISOString().split('T')[0]}.json`;
    await fs.writeFile(resultsPath, JSON.stringify({
      timestamp: new Date().toISOString(),
      config: this.config,
      results,
      recommendation: recommendation.strategy
    }, null, 2));
    console.log(`\nResults saved to: ${resultsPath}`);
    
    return {
      results,
      recommendation
    };
  }
}

export { AvailabilityQueryOptimizer, OptimizerConfig, StrategyResult, PerformanceMetrics };