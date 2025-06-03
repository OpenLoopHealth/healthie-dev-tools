import { describe, it, expect } from 'vitest';
import { calculatePercentiles } from './stats-utils';

describe('Stats Utils', () => {
  describe('calculatePercentiles', () => {
    it('should calculate percentiles correctly', () => {
      const values = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
      const metrics = calculatePercentiles(values);

      expect(metrics.p0).toBe(1);
      expect(metrics.p50).toBe(5.5);
      expect(metrics.p100).toBe(10);
      expect(metrics.mean).toBe(5.5);
      expect(metrics.stdDev).toBeCloseTo(2.87, 1);
    });

    it('should handle single value arrays', () => {
      const values = [42];
      const metrics = calculatePercentiles(values);

      expect(metrics.p0).toBe(42);
      expect(metrics.p50).toBe(42);
      expect(metrics.p100).toBe(42);
      expect(metrics.mean).toBe(42);
      expect(metrics.stdDev).toBe(0);
    });

    it('should handle empty arrays gracefully', () => {
      const values: number[] = [];
      const metrics = calculatePercentiles(values);

      expect(metrics.mean).toBeNaN();
      expect(metrics.stdDev).toBeNaN();
    });

    it('should calculate all percentiles correctly for larger dataset', () => {
      const values = Array.from({ length: 100 }, (_, i) => i + 1);
      const metrics = calculatePercentiles(values);

      expect(metrics.p0).toBe(1);
      expect(metrics.p25).toBe(25.75);
      expect(metrics.p50).toBe(50.5);
      expect(metrics.p75).toBe(75.25);
      expect(metrics.p90).toBeCloseTo(90.1, 1);
      expect(metrics.p95).toBeCloseTo(95.05, 1);
      expect(metrics.p99).toBeCloseTo(99.01, 1);
      expect(metrics.p100).toBe(100);
      expect(metrics.mean).toBe(50.5);
    });

    it('should handle duplicate values', () => {
      const values = [5, 5, 5, 5, 5];
      const metrics = calculatePercentiles(values);

      expect(metrics.p0).toBe(5);
      expect(metrics.p50).toBe(5);
      expect(metrics.p100).toBe(5);
      expect(metrics.mean).toBe(5);
      expect(metrics.stdDev).toBe(0);
    });

    it('should handle unsorted input', () => {
      const values = [10, 1, 5, 8, 3, 7, 2, 9, 4, 6];
      const metrics = calculatePercentiles(values);

      expect(metrics.p0).toBe(1);
      expect(metrics.p50).toBe(5.5);
      expect(metrics.p100).toBe(10);
      expect(metrics.mean).toBe(5.5);
    });
  });
}); 