import { Strategy } from './types';

export function generateDefaultStrategies(daysAhead: number): Strategy[] {
  const strategies: Strategy[] = [];
  
  const chunkSizes = [1, 2, 3, 5, 7, 10, 14, 21, 30].filter(size => size <= daysAhead);
  const concurrencyLevels = [1, 3, 5, 10, 20];
  
  for (const chunkSize of chunkSizes) {
    for (const concurrency of concurrencyLevels) {
      const totalQueries = Math.ceil(daysAhead / chunkSize);
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

export function getQuickStrategies(): Strategy[] {
  return [
    { name: 'single-day-high', daysPerQuery: 1, concurrency: 15 },
    { name: 'three-day-high', daysPerQuery: 3, concurrency: 10 },
    { name: 'weekly-medium', daysPerQuery: 7, concurrency: 5 },
    { name: 'biweekly-low', daysPerQuery: 14, concurrency: 3 },
    { name: 'monthly-single', daysPerQuery: 30, concurrency: 1 }
  ];
} 