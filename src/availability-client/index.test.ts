import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AvailabilityClient } from './index';

// Mock fetch for testing
global.fetch = vi.fn();

describe('AvailabilityClient', () => {
  let client: AvailabilityClient;

  beforeEach(() => {
    vi.clearAllMocks();
    client = new AvailabilityClient({
      endpoint: 'https://api.test.com/graphql',
      headers: { 'Authorization': 'Bearer test-token' },
      daysPerQuery: 7,
      maxConcurrency: 2
    });
  });

  describe('Configuration', () => {
    it('should use default configuration values', () => {
      const defaultClient = new AvailabilityClient({
        endpoint: 'https://api.test.com/graphql'
      });

      expect(defaultClient).toBeDefined();
    });

    it('should merge custom headers with defaults', () => {
      const clientWithHeaders = new AvailabilityClient({
        endpoint: 'https://api.test.com/graphql',
        headers: {
          'Authorization': 'Bearer custom-token',
          'X-Custom': 'value'
        }
      });

      expect(clientWithHeaders).toBeDefined();
    });
  });

  describe('Date Range Generation', () => {
    it('should handle remainders correctly', async () => {
      const mockResponse = {
        ok: true,
        json: () => new Promise(resolve => setTimeout(() => resolve({
          data: { availableSlotsForRange: [] }
        }), 1))
      };
      vi.mocked(fetch).mockResolvedValue(mockResponse as any);

      await client.queryAvailability({
        providerId: '123',
        appointmentTypeId: '456',
        state: 'CA',
        timezone: 'America/Los_Angeles'
      }, 30);

      expect(fetch).toHaveBeenCalledTimes(5);
    });

    it('should handle exact divisions without remainders', async () => {
      const mockResponse = {
        ok: true,
        json: () => new Promise(resolve => setTimeout(() => resolve({
          data: { availableSlotsForRange: [] }
        }), 1))
      };
      vi.mocked(fetch).mockResolvedValue(mockResponse as any);

      await client.queryAvailability({
        providerId: '123',
        appointmentTypeId: '456',
        state: 'CA',
        timezone: 'America/Los_Angeles'
      }, 14);

      expect(fetch).toHaveBeenCalledTimes(2);
    });
  });

  describe('Query Execution', () => {
    it('should execute queries with controlled concurrency', async () => {
      const mockResponse = {
        ok: true,
        json: () => new Promise(resolve => setTimeout(() => resolve({
          data: { availableSlotsForRange: [{ user_id: '123', date: '2024-01-01' }] }
        }), 1))
      };
      vi.mocked(fetch).mockResolvedValue(mockResponse as any);

      const results = await client.queryAvailability({
        providerId: '123',
        appointmentTypeId: '456',
        state: 'CA',
        timezone: 'America/Los_Angeles'
      }, 30);

      expect(results).toHaveLength(5);
      expect(results[0]).toHaveProperty('data');
      expect(results[0]).toHaveProperty('executionTime');
      expect(results[0].executionTime).toBeGreaterThan(0);
    });

    it('should handle query errors gracefully', async () => {
      const mockResponse = {
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        json: vi.fn().mockResolvedValue({})
      };
      vi.mocked(fetch).mockResolvedValue(mockResponse as any);

      const results = await client.queryAvailability({
        providerId: '123',
        appointmentTypeId: '456',
        state: 'CA',
        timezone: 'America/Los_Angeles'
      }, 7);

      expect(results).toHaveLength(1);
      expect(results[0]).toHaveProperty('errors');
      expect(results[0].errors).toHaveLength(1);
      expect(results[0].errors![0].message).toContain('HTTP 500');
    });

    it('should handle network errors', async () => {
      vi.mocked(fetch).mockRejectedValue(new Error('Network error'));

      const results = await client.queryAvailability({
        providerId: '123',
        appointmentTypeId: '456',
        state: 'CA',
        timezone: 'America/Los_Angeles'
      }, 7);

      expect(results).toHaveLength(1);
      expect(results[0]).toHaveProperty('errors');
      expect(results[0].errors![0].message).toBe('Network error');
    });

    it('should include proper GraphQL variables in requests', async () => {
      const mockResponse = {
        ok: true,
        json: () => Promise.resolve({
          data: { availableSlotsForRange: [] }
        })
      };
      vi.mocked(fetch).mockResolvedValue(mockResponse as any);

      await client.queryAvailability({
        providerId: '123456',
        appointmentTypeId: '789012',
        state: 'NY',
        timezone: 'America/New_York'
      }, 7);

      expect(fetch).toHaveBeenCalledWith(
        'https://api.test.com/graphql',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            'Authorization': 'Bearer test-token'
          }),
          body: expect.stringContaining('"providerId":"123456"')
        })
      );
    });
  });

  describe('Date Formatting', () => {
    it('should format dates correctly', async () => {
      const mockResponse = {
        ok: true,
        json: () => Promise.resolve({
          data: { availableSlotsForRange: [] }
        })
      };
      vi.mocked(fetch).mockResolvedValue(mockResponse as any);

      await client.queryAvailability({
        providerId: '123',
        appointmentTypeId: '456',
        state: 'CA',
        timezone: 'America/Los_Angeles'
      }, 1);

      const callBody = JSON.parse(vi.mocked(fetch).mock.calls[0][1]?.body as string);
      const { startDate, endDate } = callBody.variables;

      expect(startDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(endDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });
  });

  describe('Performance Features', () => {
    it('should track execution time for each query', async () => {
      const mockResponse = {
        ok: true,
        json: () => new Promise(resolve => setTimeout(() => resolve({
          data: { availableSlotsForRange: [] }
        }), 1))
      };
      vi.mocked(fetch).mockResolvedValue(mockResponse as any);

      const results = await client.queryAvailability({
        providerId: '123',
        appointmentTypeId: '456',
        state: 'CA',
        timezone: 'America/Los_Angeles'
      }, 7);

      expect(results[0].executionTime).toBeGreaterThan(0);
      expect(typeof results[0].executionTime).toBe('number');
    });

    it('should handle request delays', async () => {
      const clientWithDelay = new AvailabilityClient({
        endpoint: 'https://api.test.com/graphql',
        requestDelay: 50,
        maxConcurrency: 1
      });

      const mockResponse = {
        ok: true,
        json: () => Promise.resolve({
          data: { availableSlotsForRange: [] }
        })
      };
      vi.mocked(fetch).mockResolvedValue(mockResponse as any);

      const startTime = Date.now();
      await clientWithDelay.queryAvailability({
        providerId: '123',
        appointmentTypeId: '456',
        state: 'CA',
        timezone: 'America/Los_Angeles'
      }, 14);

      const totalTime = Date.now() - startTime;
      expect(totalTime).toBeGreaterThan(25);
    });
  });
}); 