import { describe, it, expect } from 'vitest';
import { generateDefaultStrategies, getQuickStrategies } from './strategy-generator';

describe('Strategy Generator', () => {
  describe('generateDefaultStrategies', () => {
    it('should generate default strategies for 30 days', () => {
      const strategies = generateDefaultStrategies(30);
      
      expect(strategies.length).toBeGreaterThan(0);
      strategies.forEach(strategy => {
        expect(strategy).toHaveProperty('name');
        expect(strategy).toHaveProperty('daysPerQuery');
        expect(strategy).toHaveProperty('concurrency');
        expect(typeof strategy.daysPerQuery).toBe('number');
        expect(typeof strategy.concurrency).toBe('number');
        expect(strategy.daysPerQuery).toBeGreaterThan(0);
        expect(strategy.concurrency).toBeGreaterThan(0);
      });
    });

    it('should filter out chunk sizes larger than days ahead', () => {
      const strategies = generateDefaultStrategies(5);
      
      const chunkSizes = strategies.map(s => s.daysPerQuery);
      const maxChunkSize = Math.max(...chunkSizes);
      
      expect(maxChunkSize).toBeLessThanOrEqual(5);
    });

    it('should filter out invalid concurrency combinations', () => {
      const strategies = generateDefaultStrategies(2);
      
      strategies.forEach(strategy => {
        const totalQueries = Math.ceil(2 / strategy.daysPerQuery);
        expect(strategy.concurrency).toBeLessThanOrEqual(totalQueries);
      });
    });

    it('should generate strategy names in correct format', () => {
      const strategies = generateDefaultStrategies(10);
      
      strategies.forEach(strategy => {
        expect(strategy.name).toMatch(/^\d+d-\d+c$/);
        const [daysStr, concurrencyStr] = strategy.name.split('-');
        expect(parseInt(daysStr.replace('d', ''))).toBe(strategy.daysPerQuery);
        expect(parseInt(concurrencyStr.replace('c', ''))).toBe(strategy.concurrency);
      });
    });

    it('should handle edge case of 1 day ahead', () => {
      const strategies = generateDefaultStrategies(1);
      
      expect(strategies.length).toBeGreaterThan(0);
      strategies.forEach(strategy => {
        expect(strategy.daysPerQuery).toBe(1);
        expect(strategy.concurrency).toBe(1);
      });
    });

    it('should include standard chunk sizes when applicable', () => {
      const strategies = generateDefaultStrategies(30);
      const chunkSizes = strategies.map(s => s.daysPerQuery);
      
      expect(chunkSizes).toContain(1);
      expect(chunkSizes).toContain(7);
      expect(chunkSizes).toContain(14);
      expect(chunkSizes).toContain(30);
    });
  });

  describe('getQuickStrategies', () => {
    it('should return predefined quick strategies', () => {
      const strategies = getQuickStrategies();
      
      expect(strategies).toHaveLength(5);
      expect(strategies[0]).toEqual({ name: 'single-day-high', daysPerQuery: 1, concurrency: 15 });
      expect(strategies[1]).toEqual({ name: 'three-day-high', daysPerQuery: 3, concurrency: 10 });
      expect(strategies[2]).toEqual({ name: 'weekly-medium', daysPerQuery: 7, concurrency: 5 });
      expect(strategies[3]).toEqual({ name: 'biweekly-low', daysPerQuery: 14, concurrency: 3 });
      expect(strategies[4]).toEqual({ name: 'monthly-single', daysPerQuery: 30, concurrency: 1 });
    });

    it('should return consistent results on multiple calls', () => {
      const strategies1 = getQuickStrategies();
      const strategies2 = getQuickStrategies();
      
      expect(strategies1).toEqual(strategies2);
    });

    it('should include variety of concurrency levels', () => {
      const strategies = getQuickStrategies();
      const concurrencyLevels = strategies.map(s => s.concurrency);
      
      expect(Math.min(...concurrencyLevels)).toBe(1);
      expect(Math.max(...concurrencyLevels)).toBe(15);
      expect(new Set(concurrencyLevels).size).toBeGreaterThan(1);
    });

    it('should include variety of day ranges', () => {
      const strategies = getQuickStrategies();
      const dayRanges = strategies.map(s => s.daysPerQuery);
      
      expect(Math.min(...dayRanges)).toBe(1);
      expect(Math.max(...dayRanges)).toBe(30);
      expect(new Set(dayRanges).size).toBeGreaterThan(1);
    });
  });
}); 