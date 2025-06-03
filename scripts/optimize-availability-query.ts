#!/usr/bin/env node

import { AvailabilityQueryOptimizer } from '../src/optimize-availability-query';
import * as dotenv from 'dotenv';
import { program } from 'commander';

// Load environment variables
dotenv.config();

// Parse command line arguments
program
  .name('query-optimizer')
  .description('Optimize GraphQL query performance by testing different strategies')
  .option('-e, --endpoint <url>', 'GraphQL endpoint URL', process.env.GRAPHQL_ENDPOINT)
  .option('-p, --provider <id>', 'Provider ID', '6775393')
  .option('-a, --appointment <id>', 'Appointment type ID', '436561')
  .option('-s, --state <code>', 'State code', 'CA')
  .option('-t, --timezone <tz>', 'Timezone', 'America/Chicago')
  .option('-d, --days <number>', 'Number of days to query ahead', '30')
  .option('-i, --iterations <number>', 'Iterations per strategy', '5')
  .option('--quick', 'Run quick test with limited strategies')
  .parse(process.argv);

const options = program.opts();

async function main() {
  // Validate required parameters
  if (!options.endpoint) {
    console.error('Error: GraphQL endpoint is required (--endpoint or GRAPHQL_ENDPOINT env var)');
    process.exit(1);
  }

  console.log('\n📊 Availability Query Optimizer\n');
  console.log('Configuration:');
  console.log(`  Endpoint: ${options.endpoint}`);
  console.log(`  Provider: ${options.provider}`);
  console.log(`  Appointment Type: ${options.appointment}`);
  console.log(`  State: ${options.state}`);
  console.log(`  Days Ahead: ${options.days}`);
  console.log(`  Iterations: ${options.iterations}`);
  console.log(`  Mode: ${options.quick ? 'Quick' : 'Full'}\n`);

  // Build headers
  const headers: Record<string, string> = {
    'Content-Type': 'application/json'
  };

  // Define strategies
  let strategies;
  
  if (options.quick) {
    // Quick test with fewer strategies
    strategies = [
      { name: 'single-day-high', daysPerQuery: 1, concurrency: 15 },
      { name: 'three-day-high', daysPerQuery: 3, concurrency: 10 },
      { name: 'weekly-medium', daysPerQuery: 7, concurrency: 5 },
      { name: 'biweekly-low', daysPerQuery: 14, concurrency: 3 },
      { name: 'monthly-single', daysPerQuery: 30, concurrency: 1 }
    ];
  } else {
    // Let the optimizer generate all combinations
    strategies = undefined;
  }

  // Create optimizer instance
  const optimizer = new AvailabilityQueryOptimizer({
    endpoint: options.endpoint,
    baseVariables: {
      providerId: options.provider,
      appointmentTypeId: options.appointment,
      state: options.state,
      timezone: options.timezone
    },
    daysAhead: parseInt(options.days),
    iterations: parseInt(options.iterations),
    headers,
    strategies
  });

  try {
    console.log('Starting optimization... This may take several minutes.\n');
    
    const startTime = Date.now();
    const { results, recommendation } = await optimizer.optimize();
    const totalTime = (Date.now() - startTime) / 1000;
    
    console.log(`\n✅ Optimization completed in ${totalTime.toFixed(1)} seconds\n`);
    
    // Display top 5 strategies
    console.log('Top 5 Strategies:');
    results.slice(0, 5).forEach((result, index) => {
      console.log(`${index + 1}. ${result.strategy.name}`);
      console.log(`   - Response time: p50=${result.metrics.p50.toFixed(0)}ms, p99=${result.metrics.p99.toFixed(0)}ms`);
      console.log(`   - Configuration: ${result.strategy.daysPerQuery} days/query, ${result.strategy.concurrency} concurrent`);
    });
    
    // Implementation suggestion
    console.log('\n💡 Implementation Suggestion:');
    console.log('```typescript');
    console.log(`const DAYS_PER_QUERY = ${recommendation.strategy.daysPerQuery};`);
    console.log(`const MAX_CONCURRENCY = ${recommendation.strategy.concurrency};`);
    console.log('```');
    
    // Performance improvement estimate
    const baselineStrategy = results.find(r => r.strategy.daysPerQuery === 30 && r.strategy.concurrency === 1);
    if (baselineStrategy) {
      const improvement = ((baselineStrategy.metrics.p50 - recommendation.metrics.p50) / baselineStrategy.metrics.p50 * 100).toFixed(1);
      console.log(`\n📈 Expected improvement: ${improvement}% faster than single 30-day query`);
    }
    
  } catch (error) {
    console.error('\n❌ Optimization failed:', error);
    process.exit(1);
  }
}

// Run the optimizer
main().catch(console.error);
