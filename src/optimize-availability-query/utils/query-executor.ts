import { performance } from 'perf_hooks';
import { QueryVariables, QueryResult, QueryExecutionResult, DateRange } from '../types';

export async function executeQuery(
  endpoint: string,
  variables: QueryVariables,
  headers?: Record<string, string>
): Promise<QueryResult> {
  const query = `
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
  
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...headers
    },
    body: JSON.stringify({
      query,
      variables
    })
  });
  
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }
  
  const data = await response.json();
  
  if (data.errors) {
    throw new Error(`GraphQL errors: ${JSON.stringify(data.errors)}`);
  }
  
  return data.data;
}

export async function executeQueriesWithConcurrency(
  ranges: DateRange[],
  baseVariables: Omit<QueryVariables, 'startDate' | 'endDate'>,
  concurrency: number,
  endpoint: string,
  headers?: Record<string, string>
): Promise<QueryExecutionResult> {
  const startTime = performance.now();
  const results: QueryResult[] = [];
  const errors: Error[] = [];
  
  const queryPromises = ranges.map(range => async () => {
    const variables: QueryVariables = {
      startDate: range.start,
      endDate: range.end,
      ...baseVariables
    };
    
    try {
      const result = await executeQuery(endpoint, variables, headers);
      results.push(result);
    } catch (error) {
      errors.push(error as Error);
    }
  });
  
  const inFlight: Promise<void>[] = [];
  
  for (const queryPromise of queryPromises) {
    if (inFlight.length >= concurrency) {
      await Promise.race(inFlight);
    }
    
    const promise = queryPromise().then(() => {
      inFlight.splice(inFlight.indexOf(promise), 1);
    });
    
    inFlight.push(promise);
  }
  
  await Promise.all(inFlight);
  
  const endTime = performance.now();
  
  if (errors.length > 0) {
    console.error(`Encountered ${errors.length} errors:`, errors[0].message);
  }
  
  return {
    results,
    duration: endTime - startTime
  };
} 