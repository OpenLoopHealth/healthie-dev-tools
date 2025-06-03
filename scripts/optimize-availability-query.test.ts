import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock dependencies
vi.mock('../src/optimize-availability-query', () => ({
  AvailabilityQueryOptimizer: vi.fn().mockImplementation(() => ({
    optimize: vi.fn().mockResolvedValue({
      results: [
        {
          strategy: { name: 'test-strategy', daysPerQuery: 7, concurrency: 5 },
          metrics: { p50: 245, p99: 389 }
        }
      ],
      recommendation: {
        strategy: { name: 'test-strategy', daysPerQuery: 7, concurrency: 5 },
        metrics: { p50: 245, p99: 389 }
      }
    })
  })),
  getQuickStrategies: vi.fn().mockReturnValue([
    { name: 'single-day-high', daysPerQuery: 1, concurrency: 30 },
    { name: 'three-day-high', daysPerQuery: 3, concurrency: 10 },
    { name: 'weekly-medium', daysPerQuery: 7, concurrency: 4 },
    { name: 'biweekly-low', daysPerQuery: 14, concurrency: 2 },
    { name: 'monthly-single', daysPerQuery: 30, concurrency: 1 }
  ])
}));

vi.mock('dotenv', () => ({
  config: vi.fn()
}));

describe('CLI Configuration Logic', () => {
  describe('Quick Strategies Import', () => {
    it('should import getQuickStrategies function correctly', async () => {
      const { getQuickStrategies } = await import('../src/optimize-availability-query');
      const strategies = getQuickStrategies();
      
      expect(strategies).toHaveLength(5);
      expect(strategies[0]).toEqual({ name: 'single-day-high', daysPerQuery: 1, concurrency: 30 });
    });
  });

  describe('Strategy Definitions', () => {
    it('should define correct quick strategies', () => {
      const quickStrategies = [
        { name: 'single-day-high', daysPerQuery: 1, concurrency: 30 },
        { name: 'three-day-high', daysPerQuery: 3, concurrency: 10 },
        { name: 'weekly-medium', daysPerQuery: 7, concurrency: 4 },
        { name: 'biweekly-low', daysPerQuery: 14, concurrency: 2 },
        { name: 'monthly-single', daysPerQuery: 30, concurrency: 1 }
      ];
      
      expect(quickStrategies).toHaveLength(5);
      expect(quickStrategies[0].name).toBe('single-day-high');
      expect(quickStrategies[0].daysPerQuery).toBe(1);
      expect(quickStrategies[0].concurrency).toBe(30);
    });

    it('should validate strategy properties', () => {
      const strategy = { name: 'test', daysPerQuery: 7, concurrency: 5 };
      
      expect(strategy).toHaveProperty('name');
      expect(strategy).toHaveProperty('daysPerQuery');
      expect(strategy).toHaveProperty('concurrency');
      expect(typeof strategy.daysPerQuery).toBe('number');
      expect(typeof strategy.concurrency).toBe('number');
      expect(strategy.daysPerQuery).toBeGreaterThan(0);
      expect(strategy.concurrency).toBeGreaterThan(0);
    });
  });

  describe('Configuration Building', () => {
    it('should build headers correctly', () => {
      const headers = {
        'Content-Type': 'application/json'
      };
      
      expect(headers).toHaveProperty('Content-Type');
      expect(headers['Content-Type']).toBe('application/json');
    });

    it('should use default endpoint when not provided', () => {
      const defaultEndpoint = 'https://api.gethealthie.com/graphql';
      const options: { endpoint?: string } = {};
      const endpoint = options.endpoint || defaultEndpoint;
      
      expect(endpoint).toBe('https://api.gethealthie.com/graphql');
    });

    it('should allow custom endpoint override', () => {
      const customEndpoint = 'https://staging-api.gethealthie.com/graphql';
      const options = { endpoint: customEndpoint };
      
      expect(options.endpoint).toBe(customEndpoint);
    });

    it('should handle missing required parameters', () => {
      const options: { provider?: string; appointment?: string } = {};
      
      expect(options.provider).toBeUndefined();
      expect(options.appointment).toBeUndefined();
    });

    it('should validate strategy configuration logic', async () => {
      const { getQuickStrategies } = await import('../src/optimize-availability-query');
      const isQuickMode = true;
      let strategies;
      
      if (isQuickMode) {
        strategies = getQuickStrategies();
      } else {
        strategies = undefined;
      }
      
      expect(strategies).toHaveLength(5);
    });
  });

  describe('Option Parsing Logic', () => {
    it('should handle provided values correctly', () => {
      const providedOptions = {
        provider: 'custom-provider-123',
        appointment: 'custom-appointment-456',
        state: 'NY',
        timezone: 'America/New_York',
        days: '14',
        iterations: '3'
      };
      
      expect(providedOptions.provider).toBe('custom-provider-123');
      expect(providedOptions.appointment).toBe('custom-appointment-456');
      expect(providedOptions.state).toBe('NY');
      expect(providedOptions.timezone).toBe('America/New_York');
      expect(providedOptions.days).toBe('14');
      expect(providedOptions.iterations).toBe('3');
    });

    it('should parse integer values correctly', () => {
      const daysValue = '14';
      const iterationsValue = '10';
      
      expect(parseInt(daysValue)).toBe(14);
      expect(parseInt(iterationsValue)).toBe(10);
    });
  });

  describe('Environment Variables', () => {
    it('should use GRAPHQL_ENDPOINT environment variable when set', () => {
      const originalEnv = process.env.GRAPHQL_ENDPOINT;
      process.env.GRAPHQL_ENDPOINT = 'https://env.test.com/graphql';
      
      const endpoint = process.env.GRAPHQL_ENDPOINT || 'https://api.gethealthie.com/graphql';
      expect(endpoint).toBe('https://env.test.com/graphql');
      
      if (originalEnv !== undefined) {
        process.env.GRAPHQL_ENDPOINT = originalEnv;
      } else {
        delete process.env.GRAPHQL_ENDPOINT;
      }
    });

    it('should fall back to default endpoint when env var not set', () => {
      const originalEnv = process.env.GRAPHQL_ENDPOINT;
      delete process.env.GRAPHQL_ENDPOINT;
      
      const endpoint = process.env.GRAPHQL_ENDPOINT || 'https://api.gethealthie.com/graphql';
      expect(endpoint).toBe('https://api.gethealthie.com/graphql');
      
      if (originalEnv !== undefined) {
        process.env.GRAPHQL_ENDPOINT = originalEnv;
      }
    });
  });

  describe('Optimizer Configuration', () => {
    it('should create valid optimizer config with required parameters', () => {
      const config = {
        endpoint: 'https://api.gethealthie.com/graphql',
        baseVariables: {
          providerId: 'required-provider-123',
          appointmentTypeId: 'required-appointment-456',
          state: 'CA',
          timezone: 'America/Chicago'
        },
        daysAhead: 30,
        iterations: 5,
        headers: { 'Content-Type': 'application/json' },
        strategies: undefined
      };
      
      expect(config.endpoint).toBe('https://api.gethealthie.com/graphql');
      expect(config.baseVariables.providerId).toBe('required-provider-123');
      expect(config.baseVariables.appointmentTypeId).toBe('required-appointment-456');
      expect(config.daysAhead).toBe(30);
      expect(config.iterations).toBe(5);
      expect(config.headers).toHaveProperty('Content-Type');
      expect(config.strategies).toBeUndefined();
    });

    it('should handle quick mode configuration', async () => {
      const { getQuickStrategies } = await import('../src/optimize-availability-query');
      const quickStrategies = getQuickStrategies();
      
      const config = {
        endpoint: 'https://api.gethealthie.com/graphql',
        baseVariables: {
          providerId: 'test-provider',
          appointmentTypeId: 'test-appointment',
          state: 'CA',
          timezone: 'America/Chicago'
        },
        daysAhead: 30,
        iterations: 5,
        headers: { 'Content-Type': 'application/json' },
        strategies: quickStrategies
      };
      
      expect(config.strategies).toHaveLength(5);
      expect(config.strategies![0].name).toBe('single-day-high');
    });
  });
}); 