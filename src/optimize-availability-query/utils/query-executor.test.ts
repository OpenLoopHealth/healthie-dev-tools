import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { executeQuery, executeQueriesWithConcurrency } from './query-executor';

global.fetch = vi.fn();

describe('Query Executor', () => {
  let mockFetch: any;

  beforeEach(() => {
    mockFetch = vi.mocked(fetch);
    mockFetch.mockClear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('executeQuery', () => {
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

      const result = await executeQuery('https://api.example.com/graphql', variables);

      expect(result.availableSlotsForRange).toHaveLength(2);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.example.com/graphql',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json'
          }),
          body: expect.stringContaining('AvailableSlots')
        })
      );
    });

    it('should include custom headers when provided', async () => {
      const mockResponse = {
        ok: true,
        json: async () => ({ data: { availableSlotsForRange: [] } })
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

      const customHeaders = { 'X-Custom-Header': 'test-value' };

      await executeQuery('https://api.example.com/graphql', variables, customHeaders);

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.example.com/graphql',
        expect.objectContaining({
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            'X-Custom-Header': 'test-value'
          })
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

      await expect(executeQuery('https://api.example.com/graphql', variables)).rejects.toThrow('HTTP error! status: 500');
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

      await expect(executeQuery('https://api.example.com/graphql', variables)).rejects.toThrow('GraphQL errors');
    });
  });

  describe('executeQueriesWithConcurrency', () => {
    it('should execute multiple queries with concurrency control', async () => {
      const mockResponse = {
        ok: true,
        json: async () => ({ data: { availableSlotsForRange: [] } })
      };

      mockFetch.mockResolvedValue(mockResponse);

      const ranges = [
        { start: '2024-01-15', end: '2024-01-16' },
        { start: '2024-01-17', end: '2024-01-18' }
      ];

      const baseVariables = {
        appointmentTypeId: '123',
        providerId: '456',
        state: 'CA',
        timezone: 'America/Los_Angeles'
      };

      const result = await executeQueriesWithConcurrency(
        ranges,
        baseVariables,
        2,
        'https://api.example.com/graphql'
      );

      expect(result.results).toHaveLength(2);
      expect(result.duration).toBeGreaterThan(0);
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('should handle network failures gracefully', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const ranges = [{ start: '2024-01-15', end: '2024-01-16' }];
      const baseVariables = {
        appointmentTypeId: '123',
        providerId: '456',
        state: 'CA',
        timezone: 'America/Los_Angeles'
      };

      const result = await executeQueriesWithConcurrency(
        ranges,
        baseVariables,
        1,
        'https://api.example.com/graphql'
      );

      expect(result.results).toHaveLength(0);
      expect(result.duration).toBeGreaterThan(0);

      consoleSpy.mockRestore();
    });

    it('should respect concurrency limits', async () => {
      let activeRequests = 0;
      let maxConcurrent = 0;

      mockFetch.mockImplementation(async () => {
        activeRequests++;
        maxConcurrent = Math.max(maxConcurrent, activeRequests);
        
        await new Promise(resolve => setTimeout(resolve, 10));
        
        activeRequests--;
        return {
          ok: true,
          json: async () => ({ data: { availableSlotsForRange: [] } })
        };
      });

      const ranges = Array.from({ length: 10 }, (_, i) => ({
        start: `2024-01-${String(i + 1).padStart(2, '0')}`,
        end: `2024-01-${String(i + 1).padStart(2, '0')}`
      }));

      const baseVariables = {
        appointmentTypeId: '123',
        providerId: '456',
        state: 'CA',
        timezone: 'America/Los_Angeles'
      };

      await executeQueriesWithConcurrency(
        ranges,
        baseVariables,
        3,
        'https://api.example.com/graphql'
      );

      expect(maxConcurrent).toBeLessThanOrEqual(3);
    });
  });
}); 