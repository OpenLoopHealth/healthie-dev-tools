/**
 * Production-Ready Availability Query Client
 * 
 * Copy this module to your project for optimized availability querying.
 * This client implements the optimal strategy found through performance testing.
 */

export interface QueryVariables {
  providerId: string;
  appointmentTypeId: string;
  state: string;
  timezone: string;
  startDate: string;
  endDate: string;
}

export interface AvailabilityResult {
  data?: any;
  errors?: any[];
  executionTime: number;
}

export interface ClientConfig {
  endpoint: string;
  headers?: Record<string, string>;
  // Optimal strategy configuration (customize based on your performance testing results)
  daysPerQuery?: number;
  maxConcurrency?: number;
  requestDelay?: number; // ms delay between batch requests
}

export class AvailabilityClient {
  private config: Required<ClientConfig>;

  constructor(config: ClientConfig) {
    this.config = {
      daysPerQuery: 7,        // Default: 7 days per query (adjust based on your optimization results)
      maxConcurrency: 4,      // Default: 4 concurrent requests (adjust based on your optimization results)
      requestDelay: 0,        // Default: no delay (add if you hit rate limits)
      ...config,
      headers: {
        'Content-Type': 'application/json',
        ...config.headers
      }
    };
  }

  /**
   * Query availability for a date range using optimized chunking and concurrency
   */
  async queryAvailability(baseVariables: Omit<QueryVariables, 'startDate' | 'endDate'>, daysAhead: number): Promise<AvailabilityResult[]> {
    const startDate = new Date();
    const dateRanges = this.generateDateRanges(startDate, daysAhead);
    
    console.log(`Querying ${daysAhead} days using ${dateRanges.length} queries with max ${this.config.maxConcurrency} concurrency`);
    
    return this.executeQueriesConcurrently(baseVariables, dateRanges);
  }

  /**
   * Generate optimized date ranges for querying
   */
  private generateDateRanges(startDate: Date, daysAhead: number): Array<{ startDate: string; endDate: string }> {
    const ranges: Array<{ startDate: string; endDate: string }> = [];
    const { daysPerQuery } = this.config;
    
    for (let dayOffset = 0; dayOffset < daysAhead; dayOffset += daysPerQuery) {
      const rangeStart = new Date(startDate);
      rangeStart.setDate(startDate.getDate() + dayOffset);
      
      const rangeEnd = new Date(startDate);
      const endOffset = Math.min(dayOffset + daysPerQuery - 1, daysAhead - 1);
      rangeEnd.setDate(startDate.getDate() + endOffset);
      
      ranges.push({
        startDate: this.formatDate(rangeStart),
        endDate: this.formatDate(rangeEnd)
      });
    }
    
    return ranges;
  }

  /**
   * Execute queries with controlled concurrency
   */
  private async executeQueriesConcurrently(
    baseVariables: Omit<QueryVariables, 'startDate' | 'endDate'>,
    dateRanges: Array<{ startDate: string; endDate: string }>
  ): Promise<AvailabilityResult[]> {
    const results: AvailabilityResult[] = [];
    const { maxConcurrency, requestDelay } = this.config;
    
    // Process queries in batches to control concurrency
    for (let i = 0; i < dateRanges.length; i += maxConcurrency) {
      const batch = dateRanges.slice(i, i + maxConcurrency);
      
      // Execute batch concurrently
      const batchPromises = batch.map(range => 
        this.executeQuery({
          ...baseVariables,
          startDate: range.startDate,
          endDate: range.endDate
        })
      );
      
      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);
      
      // Add delay between batches if configured (for rate limiting)
      if (requestDelay > 0 && i + maxConcurrency < dateRanges.length) {
        await this.delay(requestDelay);
      }
    }
    
    return results;
  }

  /**
   * Execute a single GraphQL query
   */
  private async executeQuery(variables: QueryVariables): Promise<AvailabilityResult> {
    const startTime = Date.now();
    
    try {
      const response = await fetch(this.config.endpoint, {
        method: 'POST',
        headers: this.config.headers,
        body: JSON.stringify({
          query: this.getAvailabilityQuery(),
          variables
        })
      });
      
      const result = await response.json();
      const executionTime = Date.now() - startTime;
      
      if (!response.ok) {
        return {
          errors: [{ message: `HTTP ${response.status}: ${response.statusText}` }],
          executionTime
        };
      }
      
      return {
        data: result.data,
        errors: result.errors,
        executionTime
      };
      
    } catch (error) {
      return {
        errors: [{ message: error instanceof Error ? error.message : 'Unknown error' }],
        executionTime: Date.now() - startTime
      };
    }
  }

  /**
   * GraphQL query for availability (uses the same query as the optimizer)
   */
  private getAvailabilityQuery(): string {
    return `
      query AvailableSlots(
        $startDate: String!
        $endDate: String!
        $appointmentTypeId: String!
        $providerId: String!
        $state: String!
        $timezone: String!
      ) {
        availableSlotsForRange(
          start_date: $startDate
          end_date: $endDate
          appt_type_id: $appointmentTypeId
          provider_id: $providerId
          licensed_in_state: $state
          org_level: true
          timezone: $timezone
        ) {
          user_id
          date
        }
      }
    `;
  }

  /**
   * Format date as YYYY-MM-DD
   */
  private formatDate(date: Date): string {
    return date.toISOString().split('T')[0];
  }

  /**
   * Utility delay function
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * USAGE EXAMPLE:
 * 
 * ```typescript
 * import { AvailabilityClient } from './availability-client';
 * 
 * const client = new AvailabilityClient({
 *   endpoint: 'https://api.gethealthie.com/graphql',
 *   headers: {
 *     'Authorization': 'Bearer YOUR_TOKEN'
 *   },
 *   daysPerQuery: 7,     // Based on your optimization results
 *   maxConcurrency: 4,   // Based on your optimization results
 *   requestDelay: 100    // Add if you hit rate limits
 * });
 * 
 * // Query 30 days of availability
 * const results = await client.queryAvailability({
 *   providerId: '123456',
 *   appointmentTypeId: '789012',
 *   state: 'CA',
 *   timezone: 'America/Los_Angeles'
 * }, 30);
 * 
 * // Process results
 * const allAvailableSlots = results
 *   .filter(result => result.data && !result.errors)
 *   .flatMap(result => result.data.availableSlotsForRange);
 * 
 * console.log(`Found ${allAvailableSlots.length} available slots`);
 * ```
 */ 