// Main exports
export { AvailabilityQueryOptimizer } from './optimizer';

// Type exports
export type {
  QueryVariables,
  QueryResult,
  PerformanceMetrics,
  Strategy,
  StrategyResult,
  OptimizerConfig,
  DateRange,
  QueryExecutionResult
} from './types';

// Utility exports
export { formatDate, generateDateRanges } from './utils/date-utils';
export { calculatePercentiles } from './utils/stats-utils';
export { executeQuery, executeQueriesWithConcurrency } from './utils/query-executor';
export { generateDefaultStrategies, getQuickStrategies } from './strategy-generator';