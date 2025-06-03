import { OptimizerConfig, StrategyResult, Strategy } from './types';
import { generateDateRanges } from './utils/date-utils';
import { calculatePercentiles } from './utils/stats-utils';
import { executeQueriesWithConcurrency } from './utils/query-executor';
import { generateDefaultStrategies } from './strategy-generator';

export class AvailabilityQueryOptimizer {
  private config: OptimizerConfig;
  
  constructor(config: OptimizerConfig) {
    this.config = config;
  }
  
  private async testStrategy(
    name: string,
    daysPerQuery: number,
    concurrency: number
  ): Promise<StrategyResult> {
    const ranges = generateDateRanges(daysPerQuery, this.config.daysAhead);
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
        const { duration } = await executeQueriesWithConcurrency(
          ranges,
          this.config.baseVariables,
          concurrency,
          this.config.endpoint,
          this.config.headers
        );
        measurements.push(duration);
        process.stdout.write(` ${duration.toFixed(2)}ms\n`);
      } catch (error) {
        totalErrors++;
        process.stdout.write(` ERROR\n`);
      }
    }
    
    const metrics = calculatePercentiles(measurements);
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
  
  async optimize(): Promise<{
    results: StrategyResult[];
    recommendation: StrategyResult;
  }> {
    console.log('=== Availability Query Performance Optimizer ===');
    console.log(`Endpoint: ${this.config.endpoint}`);
    console.log(`Days ahead: ${this.config.daysAhead}`);
    console.log(`Iterations per strategy: ${this.config.iterations}`);
    
    const strategies = this.config.strategies || generateDefaultStrategies(this.config.daysAhead);
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