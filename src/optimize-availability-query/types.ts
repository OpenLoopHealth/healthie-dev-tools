export interface QueryVariables {
  startDate: string;
  endDate: string;
  appointmentTypeId: string;
  providerId: string;
  state: string;
  timezone: string;
}

export interface QueryResult {
  availableSlotsForRange: Array<{
    user_id: string;
    date: string;
  }>;
}

export interface PerformanceMetrics {
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

export interface Strategy {
  name: string;
  daysPerQuery: number;
  concurrency: number;
}

export interface StrategyResult {
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

export interface OptimizerConfig {
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
  strategies?: Strategy[];
}

export interface DateRange {
  start: string;
  end: string;
}

export interface QueryExecutionResult {
  results: QueryResult[];
  duration: number;
} 