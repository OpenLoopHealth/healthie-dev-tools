import { Strategy } from './types';

export function generateDefaultStrategies(daysAhead: number): Strategy[] {
  const strategies: Strategy[] = [];
  
  // Define chunk sizes that make sense for different scenarios
  const chunkSizes = [1, 2, 3, 5, 7, 10, 14, 21, 30].filter(size => size <= daysAhead);
  
  // Maximum reasonable concurrency to avoid overwhelming the server
  const maxConcurrency = 30;
  
  for (const chunkSize of chunkSizes) {
    const totalQueries = Math.ceil(daysAhead / chunkSize);
    
    // Set concurrency to the number of queries (maximizing parallelism)
    // but cap it at a reasonable maximum to avoid overwhelming the server
    const optimalConcurrency = Math.min(totalQueries, maxConcurrency);
    
    strategies.push({
      name: `${chunkSize}d-${optimalConcurrency}c`,
      daysPerQuery: chunkSize,
      concurrency: optimalConcurrency
    });
  }
  
  return strategies;
}

export function getQuickStrategies(): Strategy[] {
  return [
    { name: 'single-day-high', daysPerQuery: 1, concurrency: 30 },
    { name: 'three-day-high', daysPerQuery: 3, concurrency: 10 },
    { name: 'weekly-medium', daysPerQuery: 7, concurrency: 4 },
    { name: 'biweekly-low', daysPerQuery: 14, concurrency: 2 },
    { name: 'monthly-single', daysPerQuery: 30, concurrency: 1 }
  ];
} 