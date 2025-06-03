import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AvailabilityQueryOptimizer } from './optimizer';

// Mock the utility modules
vi.mock('./utils/date-utils', () => ({
  generateDateRanges: vi.fn(() => [
    { start: '2024-01-15', end: '2024-01-16' },
    { start: '2024-01-17', end: '2024-01-18' }
  ])
}));

vi.mock('./utils/stats-utils', () => ({
  calculatePercentiles: vi.fn(() => ({
    p0: 100,
    p25: 200,
    p50: 250,
    p75: 300,
    p90: 350,
    p95: 400,
    p99: 450,
    p100: 500,
    mean: 275,
    stdDev: 50
  }))
}));

vi.mock('./utils/query-executor', () => ({
  executeQueriesWithConcurrency: vi.fn(() => Promise.resolve({
    results: [{ availableSlotsForRange: [] }],
    duration: 250
  }))
}));

vi.mock('./strategy-generator', () => ({
  generateDefaultStrategies: vi.fn(() => [
    { name: 'test-strategy', daysPerQuery: 7, concurrency: 5 }
  ])
}));

// Mock file system operations
vi.mock('fs/promises', () => ({
  writeFile: vi.fn(() => Promise.resolve(undefined)),
  mkdir: vi.fn(() => Promise.resolve(undefined))
}));

global.fetch = vi.fn();

describe('AvailabilityQueryOptimizer', () => {
  let optimizer: AvailabilityQueryOptimizer;
  let consoleSpy: any;
  let processStdoutSpy: any;

  const defaultConfig = {
    endpoint: 'https://api.example.com/graphql',
    baseVariables: {
      appointmentTypeId: '123',
      providerId: '456',
      state: 'CA',
      timezone: 'America/Los_Angeles'
    },
    daysAhead: 7,
    iterations: 2,
    headers: { 'Content-Type': 'application/json' }
  };

  beforeEach(() => {
    optimizer = new AvailabilityQueryOptimizer(defaultConfig);
    consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    processStdoutSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Constructor', () => {
    it('should create optimizer with valid configuration', () => {
      expect(() => new AvailabilityQueryOptimizer(defaultConfig)).not.toThrow();
    });

    it('should accept configuration with custom strategies', () => {
      const configWithStrategies = {
        ...defaultConfig,
        strategies: [{ name: 'custom', daysPerQuery: 14, concurrency: 3 }]
      };

      expect(() => new AvailabilityQueryOptimizer(configWithStrategies)).not.toThrow();
    });
  });

  describe('optimize', () => {
    it('should run optimization and return results', async () => {
      const result = await optimizer.optimize();

      expect(result).toHaveProperty('results');
      expect(result).toHaveProperty('recommendation');
      expect(result.results).toHaveLength(1);
      expect(result.recommendation).toHaveProperty('strategy');
      expect(result.recommendation).toHaveProperty('metrics');
    });

    it('should use custom strategies when provided', async () => {
      const customStrategies = [
        { name: 'custom-1', daysPerQuery: 3, concurrency: 2 },
        { name: 'custom-2', daysPerQuery: 5, concurrency: 4 }
      ];

      const configWithStrategies = {
        ...defaultConfig,
        strategies: customStrategies
      };

      const customOptimizer = new AvailabilityQueryOptimizer(configWithStrategies);
      const result = await customOptimizer.optimize();

      expect(result.results).toHaveLength(2);
    });

    it('should handle strategies with no errors correctly', async () => {
      const result = await optimizer.optimize();

      expect(result.recommendation.errors).toBe(0);
    });

    it('should sort results by p50 performance metric', async () => {
      const configWithMultipleStrategies = {
        ...defaultConfig,
        strategies: [
          { name: 'slow-strategy', daysPerQuery: 1, concurrency: 1 },
          { name: 'fast-strategy', daysPerQuery: 7, concurrency: 5 }
        ]
      };

      const { calculatePercentiles } = await import('./utils/stats-utils');
      vi.mocked(calculatePercentiles)
        .mockReturnValueOnce({
          p0: 400, p25: 450, p50: 500, p75: 550, p90: 600, p95: 650, p99: 700, p100: 750,
          mean: 525, stdDev: 75
        })
        .mockReturnValueOnce({
          p0: 100, p25: 150, p50: 200, p75: 250, p90: 300, p95: 350, p99: 400, p100: 450,
          mean: 225, stdDev: 50
        });

      const customOptimizer = new AvailabilityQueryOptimizer(configWithMultipleStrategies);
      const result = await customOptimizer.optimize();

      expect(result.results[0].metrics.p50).toBeLessThan(result.results[1].metrics.p50);
    });

    it('should save results to file', async () => {
      const fs = await import('fs/promises');
      
      await optimizer.optimize();

      expect(fs.mkdir).toHaveBeenCalledWith('./results', { recursive: true });
      expect(fs.writeFile).toHaveBeenCalledWith(
        expect.stringMatching(/^\.\/results\/optimization-results-\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}-\d{3}Z\.json$/),
        expect.stringContaining('"timestamp"')
      );
    });

    it('should handle errors during strategy testing', async () => {
      const { executeQueriesWithConcurrency } = await import('./utils/query-executor');
      vi.mocked(executeQueriesWithConcurrency).mockRejectedValueOnce(new Error('Test error'));

      const result = await optimizer.optimize();

      expect(result.results[0].errors).toBe(1);
    });

    it('should log progress information', async () => {
      await optimizer.optimize();

      expect(consoleSpy).toHaveBeenCalledWith('=== Availability Query Performance Optimizer ===');
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Endpoint:'));
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Days ahead:'));
    });

    it('should recommend strategy with no errors when available', async () => {
      const configWithMultipleStrategies = {
        ...defaultConfig,
        strategies: [
          { name: 'error-strategy', daysPerQuery: 1, concurrency: 1 },
          { name: 'good-strategy', daysPerQuery: 7, concurrency: 5 }
        ]
      };

      const { executeQueriesWithConcurrency } = await import('./utils/query-executor');
      vi.mocked(executeQueriesWithConcurrency)
        .mockRejectedValueOnce(new Error('Test error'))
        .mockResolvedValueOnce({
          results: [{ availableSlotsForRange: [] }],
          duration: 200
        });

      const customOptimizer = new AvailabilityQueryOptimizer(configWithMultipleStrategies);
      const result = await customOptimizer.optimize();

      expect(result.recommendation.errors).toBe(0);
      expect(result.recommendation.strategy.name).toBe('good-strategy');
    });
  });
}); 