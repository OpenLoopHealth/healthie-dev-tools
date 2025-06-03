import { PerformanceMetrics } from '../types';

export function calculatePercentiles(values: number[]): PerformanceMetrics {
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