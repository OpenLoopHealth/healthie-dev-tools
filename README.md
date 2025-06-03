# Availability Query Optimizer

A TypeScript utility for finding the optimal strategy to query availability data from Healthie's API by testing different date range chunking and concurrency configurations.

## Features

- Tests multiple strategies combining different date range sizes and concurrency levels
- Provides comprehensive performance metrics (p0, p25, p50, p75, p90, p95, p99, p100)
- Runs multiple iterations for statistical significance
- Automatically recommends the best strategy based on median performance
- Saves detailed results to JSON for further analysis
- Supports both quick tests and comprehensive optimization runs
- **Includes production-ready client for easy implementation**

## Quick Links

- 🔧 [Run Optimization](#usage) - Find the best strategy for your use case
- 📦 [Copy Production Client](#production-client) - Ready-to-use implementation
- 📊 [Understanding Results](#understanding-the-results) - Interpret optimization output

## Installation

```bash
npm install
```

## Production Client

**For immediate implementation**: Copy the complete availability client to your project:

```bash
cp -r src/availability-client ./your-project/src/
```

The client includes:
- ✅ Optimized date range chunking with remainder handling
- ✅ Controlled concurrency to maximize performance
- ✅ Error handling and retry logic
- ✅ Performance monitoring and timing
- ✅ Rate limiting protection
- ✅ TypeScript interfaces and full documentation

### Quick Implementation

```typescript
import { AvailabilityClient } from './availability-client';

const client = new AvailabilityClient({
  endpoint: 'https://api.gethealthie.com/graphql',
  headers: { 'Authorization': 'Bearer YOUR_TOKEN' },
  daysPerQuery: 7,     // Use your optimization results
  maxConcurrency: 4    // Use your optimization results
});

const results = await client.queryAvailability({
  providerId: '123456',
  appointmentTypeId: '789012',
  state: 'CA',
  timezone: 'America/Los_Angeles'
}, 30);

const availableSlots = results
  .filter(result => result.data && !result.errors)
  .flatMap(result => result.data.availableSlotsForRange);
```

**See [`src/availability-client/README.md`](src/availability-client/README.md) for complete documentation.**

## Optimization Tool

Use this tool to find the optimal settings for your specific environment before implementing the client.

## Configuration

Optionally create a `.env` file in the project root to override the default endpoint:

```env
GRAPHQL_ENDPOINT=https://staging-api.gethealthie.com/graphql
```

## Usage

### Basic Usage

```bash
npm run optimize:availability -- --provider YOUR_PROVIDER_ID --appointment YOUR_APPOINTMENT_TYPE_ID
```

### Quick Test (Limited Strategies)

```bash
npm run optimize:availability:quick -- --provider YOUR_PROVIDER_ID --appointment YOUR_APPOINTMENT_TYPE_ID
```

### Full Command Line Options

```bash
npm run optimize:availability -- [options]

Options:
  -e, --endpoint <url>      GraphQL endpoint URL (default: "https://api.gethealthie.com/graphql", or GRAPHQL_ENDPOINT env var)
  -p, --provider <id>       Provider ID (required)
  -a, --appointment <id>    Appointment type ID (required)
  -s, --state <code>        State code (default: "CA")
  -t, --timezone <tz>       Timezone (default: "America/Chicago")
  -d, --days <number>       Number of days to query ahead (default: "30")
  -i, --iterations <number> Iterations per strategy (default: "5")
  --quick                   Run quick test with limited strategies
  -h, --help                Display help
```

### Examples

```bash
# Basic optimization (uses production API by default)
npm run optimize:availability -- --provider 123456 --appointment 789012

# Quick test with custom parameters
npm run optimize:availability -- --provider 123456 --appointment 789012 --days 14 --quick

# Full optimization with more iterations for accuracy
npm run optimize:availability -- --provider 123456 --appointment 789012 --iterations 10

# Using custom endpoint (e.g., staging environment)
npm run optimize:availability -- --endpoint https://staging-api.gethealthie.com/graphql --provider 123456 --appointment 789012

# Using environment variable for custom endpoint
GRAPHQL_ENDPOINT=https://staging-api.gethealthie.com/graphql npm run optimize:availability -- --provider 123456 --appointment 789012 --state NY --timezone America/New_York
```

## Understanding the Results

The optimizer will test various strategies and output:

1. **Real-time Progress**: Shows each strategy being tested with iteration timings
2. **Results Table**: Comprehensive metrics for all strategies tested
3. **Recommendation**: The optimal strategy based on median performance
4. **Implementation Code**: Ready-to-use constants for your application
5. **Performance Improvement**: Estimated speed improvement over baseline

### Example Output

```
=== Results Summary ===

Strategy         | Queries | Days/Q | Conc | p50 (ms) | p90 (ms) | p99 (ms) | Mean (ms) | Errors
-----------------|---------|--------|------|----------|----------|----------|-----------|-------
7d-5c            |       5 |      7 |    5 |      245 |      312 |      389 |       258 |      0
3d-10c           |      10 |      3 |   10 |      267 |      342 |      401 |       281 |      0
...

=== Recommendation ===
Best strategy: 7d-5c
  - 7 days per query
  - 5 concurrent requests
  - Median response time: 245.00ms
  - 99th percentile: 389.00ms

💡 Implementation Suggestion:
```typescript
const DAYS_PER_QUERY = 7;
const MAX_CONCURRENCY = 5;
```
```

## How It Works

1. **Strategy Generation**: Creates combinations of date range sizes (1-30 days) and concurrency levels (1-20)
2. **Testing**: Each strategy is run multiple times to gather statistical data
3. **Metrics Calculation**: Computes percentiles and statistical measures for each strategy
4. **Recommendation**: Selects the strategy with the best median performance and no errors

## Customizing Strategies

You can define custom strategies in the code:

```typescript
const strategies = [
  { name: 'daily-burst', daysPerQuery: 1, concurrency: 30 },
  { name: 'weekly-balanced', daysPerQuery: 7, concurrency: 5 },
  { name: 'monthly-single', daysPerQuery: 30, concurrency: 1 }
];
```

## Output Files

Results are automatically saved to timestamped JSON files:
- `optimization-results-YYYY-MM-DD.json`

These files contain:
- Complete configuration used
- Detailed metrics for all strategies
- The recommended strategy
- All raw measurements

## Tips for Best Results

1. **Network Stability**: Run from a stable network connection
2. **Iterations**: Use at least 5 iterations for reliable results
3. **Time of Day**: Consider API load patterns when testing
4. **Monitoring**: Watch for rate limiting or errors in specific strategies

## Troubleshooting

- **Network Timeouts**: Reduce concurrency levels
- **Rate Limiting**: Add delays between iterations or reduce concurrency
- **Memory Issues**: Test with fewer strategies using `--quick`
- **Missing Parameters**: Ensure provider ID and appointment type ID are provided
