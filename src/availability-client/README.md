# Production-Ready Availability Client

**Copy this entire folder to your project for optimized availability querying.**

This client implements the optimal querying strategies discovered through performance testing. It handles date range chunking, controlled concurrency, error handling, and remainder batches automatically.

## Quick Start

### 1. Copy the Client

Copy the entire `availability-client` folder to your project:

```bash
cp -r src/availability-client ./your-project/src/
```

### 2. Install Dependencies

The client uses only standard web APIs (`fetch`), so no additional dependencies are required for basic usage.

### 3. Basic Usage

```typescript
import { AvailabilityClient } from './availability-client';

const client = new AvailabilityClient({
  endpoint: 'https://api.gethealthie.com/graphql',
  headers: {
    'Authorization': 'Bearer YOUR_TOKEN_HERE'
  }
});

// Query 30 days of availability
const results = await client.queryAvailability({
  providerId: '123456',
  appointmentTypeId: '789012',
  state: 'CA',
  timezone: 'America/Los_Angeles'
}, 30);

// Process all successful results
const availableSlots = results
  .filter(result => result.data && !result.errors)
  .flatMap(result => result.data.availableSlotsForRange)
  .filter(slot => slot.user_id && slot.date);

console.log(`Found ${availableSlots.length} available appointment slots`);
```

## Configuration Options

Customize the client based on your optimization results:

```typescript
const client = new AvailabilityClient({
  endpoint: 'https://api.gethealthie.com/graphql',
  headers: {
    'Authorization': 'Bearer YOUR_TOKEN',
    'X-Custom-Header': 'value'
  },
  
  // Performance settings (adjust based on your optimization results)
  daysPerQuery: 7,        // Chunk size: 7 days per query
  maxConcurrency: 4,      // Max 4 concurrent requests
  requestDelay: 100       // 100ms delay between batches (if rate limiting occurs)
});
```

### Configuration Guide

| Setting | Default | Description | When to Adjust |
|---------|---------|-------------|----------------|
| `daysPerQuery` | 7 | Days per query chunk | Use your optimization results |
| `maxConcurrency` | 4 | Max concurrent requests | Use your optimization results |
| `requestDelay` | 0 | Delay between batches (ms) | Add if you hit rate limits |

## Advanced Usage

### Error Handling

```typescript
const results = await client.queryAvailability(variables, 30);

// Check for errors
const errors = results.filter(result => result.errors?.length > 0);
if (errors.length > 0) {
  console.error('Some queries failed:', errors);
}

// Process successful results only
const successfulResults = results.filter(result => 
  result.data && (!result.errors || result.errors.length === 0)
);
```

### Performance Monitoring

```typescript
const results = await client.queryAvailability(variables, 30);

// Analyze performance
const totalTime = results.reduce((sum, result) => sum + result.executionTime, 0);
const avgTime = totalTime / results.length;
const maxTime = Math.max(...results.map(r => r.executionTime));

console.log(`Total execution time: ${totalTime}ms`);
console.log(`Average query time: ${avgTime.toFixed(1)}ms`);
console.log(`Slowest query: ${maxTime}ms`);
```

### Custom GraphQL Query

The client includes a default GraphQL query, but you can customize it:

```typescript
// Extend the class to customize the query
class CustomAvailabilityClient extends AvailabilityClient {
  protected getAvailabilityQuery(): string {
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
          # Add additional fields as needed
          duration
          cost
        }
      }
    `;
  }
}
```

## Integration Examples

### React Hook

```typescript
import { useState, useEffect } from 'react';
import { AvailabilityClient } from './availability-client';

const useAvailability = (providerId: string, appointmentTypeId: string, daysAhead: number = 30) => {
  const [slots, setSlots] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchAvailability = async () => {
      setLoading(true);
      try {
        const client = new AvailabilityClient({
          endpoint: 'https://api.gethealthie.com/graphql',
          headers: { 'Authorization': `Bearer ${getAuthToken()}` }
        });

        const results = await client.queryAvailability({
          providerId,
          appointmentTypeId,
          state: 'CA',
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
        }, daysAhead);

        const availableSlots = results
          .filter(result => result.data && !result.errors)
          .flatMap(result => result.data.availableSlotsForRange)
          .filter(slot => slot.user_id && slot.date);

        setSlots(availableSlots);
      } catch (err) {
        setError(err);
      } finally {
        setLoading(false);
      }
    };

    fetchAvailability();
  }, [providerId, appointmentTypeId, daysAhead]);

  return { slots, loading, error };
};
```

### Node.js/Express API

```typescript
import express from 'express';
import { AvailabilityClient } from './availability-client';

const app = express();
const client = new AvailabilityClient({
  endpoint: 'https://api.gethealthie.com/graphql',
  headers: { 'Authorization': `Bearer ${process.env.API_TOKEN}` }
});

app.get('/api/availability/:providerId/:appointmentTypeId', async (req, res) => {
  try {
    const { providerId, appointmentTypeId } = req.params;
    const daysAhead = parseInt(req.query.days as string) || 30;

    const results = await client.queryAvailability({
      providerId,
      appointmentTypeId,
      state: req.query.state as string || 'CA',
      timezone: req.query.timezone as string || 'America/Los_Angeles'
    }, daysAhead);

    const availableSlots = results
      .filter(result => result.data && !result.errors)
      .flatMap(result => result.data.availableSlotsForRange)
      .filter(slot => slot.user_id && slot.date);

    res.json({ 
      success: true, 
      slots: availableSlots,
      queryCount: results.length,
      totalTime: results.reduce((sum, r) => sum + r.executionTime, 0)
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});
```

## Performance Tips

1. **Use optimization results**: Run the query optimizer first to find your optimal `daysPerQuery` and `maxConcurrency` values

2. **Monitor rate limits**: Add `requestDelay` if you encounter rate limiting

3. **Cache results**: Consider caching availability data for frequently requested providers/appointment types

4. **Batch requests**: Group multiple availability requests together when possible

5. **Handle failures gracefully**: Always check for errors and have fallback strategies

## Troubleshooting

### Rate Limiting
If you hit rate limits, increase `requestDelay`:
```typescript
const client = new AvailabilityClient({
  endpoint: 'https://api.gethealthie.com/graphql',
  requestDelay: 200  // 200ms delay between batches
});
```

### Slow Performance
1. Run the query optimizer to find better settings
2. Reduce `maxConcurrency` if server is overwhelmed
3. Increase `daysPerQuery` to reduce total number of requests

### Memory Issues
For very large date ranges, consider processing results in chunks:
```typescript
// Query smaller ranges and combine results
const results1 = await client.queryAvailability(variables, 30);
const results2 = await client.queryAvailability({...variables, /* offset start date */}, 30);
```

## License

This code is provided as-is for use in your Healthie implementations. Modify as needed for your specific use case. 