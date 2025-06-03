import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AvailabilityQueryOptimizer } from './index';

// Mock fetch globally
global.fetch = vi.fn();

describe('AvailabilityQueryOptimizer', () => {
  let optimizer: AvailabilityQueryOptimizer;
  let mockFetch: any;

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
    mockFetch = vi.mocked(fetch);
    mockFetch.mockClear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Date Range Generation', () => {
    it('should generate correct date ranges for single day chunks', () => {
      const optimizer = new AvailabilityQueryOptimizer({
        ...defaultConfig,
        daysAhead: 3
      });

      // Access the private method through any casting for testing
      const ranges = (optimizer as any).generateDateRanges(1);
      
      expect(ranges).toHaveLength(3);
      expect(ranges[0]).toHaveProperty('start');
      expect(ranges[0]).toHaveProperty('end');
      expect(ranges[0].start).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(ranges[0].end).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it('should generate correct date ranges for multi-day chunks', () => {
      const optimizer = new AvailabilityQueryOptimizer({
        ...defaultConfig,
        daysAhead: 10
      });

      const ranges = (optimizer as any).generateDateRanges(5);
      
      expect(ranges).toHaveLength(2);
    });

    it('should handle edge case where days ahead is less than chunk size', () => {
      const optimizer = new AvailabilityQueryOptimizer({
        ...defaultConfig,
        daysAhead: 3
      });

      const ranges = (optimizer as any).generateDateRanges(7);
      
      expect(ranges).toHaveLength(1);
    });
  });

  describe('Date Formatting', () => {
    it('should format dates correctly', () => {
      const testDate = new Date(2024, 0, 15); // Month is 0-indexed, so 0 = January
      const formatted = (optimizer as any).formatDate(testDate);
      
      expect(formatted).toBe('2024-01-15');
    });

    it('should handle single digit months and days', () => {
      const testDate = new Date(2024, 0, 5); // Month is 0-indexed, so 0 = January
      const formatted = (optimizer as any).formatDate(testDate);
      
      expect(formatted).toBe('2024-01-05');
    });
  });

  describe('Percentile Calculations', () => {
    it('should calculate percentiles correctly', () => {
      const values = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
      const metrics = (optimizer as any).calculatePercentiles(values);

      expect(metrics.p0).toBe(1);
      expect(metrics.p50).toBe(5.5);
      expect(metrics.p100).toBe(10);
      expect(metrics.mean).toBe(5.5);
      expect(metrics.stdDev).toBeCloseTo(2.87, 1);
    });

    it('should handle single value arrays', () => {
      const values = [42];
      const metrics = (optimizer as any).calculatePercentiles(values);

      expect(metrics.p0).toBe(42);
      expect(metrics.p50).toBe(42);
      expect(metrics.p100).toBe(42);
      expect(metrics.mean).toBe(42);
      expect(metrics.stdDev).toBe(0);
    });

    it('should handle empty arrays gracefully', () => {
      const values: number[] = [];
      const metrics = (optimizer as any).calculatePercentiles(values);

      expect(metrics.mean).toBeNaN();
      expect(metrics.stdDev).toBeNaN();
    });
  });

  describe('GraphQL Query Execution', () => {
    it('should execute queries successfully', async () => {
      const mockResponse = {
        ok: true,
        json: async () => ({
          data: {
            availableSlotsForRange: [
              { user_id: '1', date: '2024-01-15' },
              { user_id: '2', date: '2024-01-16' }
            ]
          }
        })
      };

      mockFetch.mockResolvedValueOnce(mockResponse);

      const variables = {
        startDate: '2024-01-15',
        endDate: '2024-01-16',
        appointmentTypeId: '123',
        providerId: '456',
        state: 'CA',
        timezone: 'America/Los_Angeles'
      };

      const result = await (optimizer as any).executeQuery(variables);

      expect(result.availableSlotsForRange).toHaveLength(2);
      expect(mockFetch).toHaveBeenCalledWith(
        defaultConfig.endpoint,
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json'
          }),
          body: expect.stringContaining('AvailableSlots')
        })
      );
    });

    it('should handle HTTP errors', async () => {
      const mockResponse = {
        ok: false,
        status: 500
      };

      mockFetch.mockResolvedValueOnce(mockResponse);

      const variables = {
        startDate: '2024-01-15',
        endDate: '2024-01-16',
        appointmentTypeId: '123',
        providerId: '456',
        state: 'CA',
        timezone: 'America/Los_Angeles'
      };

      await expect((optimizer as any).executeQuery(variables)).rejects.toThrow('HTTP error! status: 500');
    });

    it('should handle GraphQL errors', async () => {
      const mockResponse = {
        ok: true,
        json: async () => ({
          errors: [{ message: 'GraphQL error' }]
        })
      };

      mockFetch.mockResolvedValueOnce(mockResponse);

      const variables = {
        startDate: '2024-01-15',
        endDate: '2024-01-16',
        appointmentTypeId: '123',
        providerId: '456',
        state: 'CA',
        timezone: 'America/Los_Angeles'
      };

      await expect((optimizer as any).executeQuery(variables)).rejects.toThrow('GraphQL errors');
    });
  });

  describe('Strategy Generation', () => {
    it('should generate default strategies', () => {
      const strategies = (optimizer as any).generateDefaultStrategies();
      
      expect(strategies.length).toBeGreaterThan(0);
      expect(strategies[0]).toHaveProperty('name');
      expect(strategies[0]).toHaveProperty('daysPerQuery');
      expect(strategies[0]).toHaveProperty('concurrency');
    });

    it('should filter out invalid combinations', () => {
      const optimizer = new AvailabilityQueryOptimizer({
        ...defaultConfig,
        daysAhead: 2
      });

      const strategies = (optimizer as any).generateDefaultStrategies();
      
      const invalidStrategies = strategies.filter((s: any) => {
        const totalQueries = Math.ceil(2 / s.daysPerQuery);
        return s.concurrency > totalQueries;
      });
      
      expect(invalidStrategies).toHaveLength(0);
    });
  });

  describe('Configuration Validation', () => {
    it('should accept valid configuration', () => {
      expect(() => new AvailabilityQueryOptimizer(defaultConfig)).not.toThrow();
    });

    it('should work with custom strategies', () => {
      const customConfig = {
        ...defaultConfig,
        strategies: [
          { name: 'test-strategy', daysPerQuery: 7, concurrency: 2 }
        ]
      };

      expect(() => new AvailabilityQueryOptimizer(customConfig)).not.toThrow();
    });
  });

  describe('Error Handling', () => {
    it('should handle network failures gracefully', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const processStdoutSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

      const ranges = [{ start: '2024-01-15', end: '2024-01-16' }];
      const result = await (optimizer as any).executeQueriesWithConcurrency(ranges, 1);

      expect(result.results).toHaveLength(0);
      expect(result.duration).toBeGreaterThan(0);

      consoleSpy.mockRestore();
      consoleLogSpy.mockRestore();
      processStdoutSpy.mockRestore();
    });
  });
});

describe('Integration Tests', () => {
  it('should create and configure optimizer correctly', () => {
    const config = {
      endpoint: 'https://api.example.com/graphql',
      baseVariables: {
        appointmentTypeId: '123',
        providerId: '456',
        state: 'CA',
        timezone: 'America/Los_Angeles'
      },
      daysAhead: 30,
      iterations: 5
    };

    const optimizer = new AvailabilityQueryOptimizer(config);
    expect(optimizer).toBeInstanceOf(AvailabilityQueryOptimizer);
  });

  it('should handle minimal configuration', () => {
    const minimalConfig = {
      endpoint: 'https://api.example.com/graphql',
      baseVariables: {
        appointmentTypeId: '123',
        providerId: '456',
        state: 'CA',
        timezone: 'America/Los_Angeles'
      },
      daysAhead: 7,
      iterations: 1
    };

    const optimizer = new AvailabilityQueryOptimizer(minimalConfig);
    expect(optimizer).toBeInstanceOf(AvailabilityQueryOptimizer);
  });
}); 