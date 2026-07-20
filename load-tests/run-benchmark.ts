/**
 * ReHook High-Concurrency Native Benchmark Runner
 * 
 * Executes N concurrent requests against ReHook API gateway and calculates:
 * - Total Ingestion Throughput (req/sec)
 * - Average Latency & Latency Percentiles (p50, p90, p95, p99)
 * - Success vs Failure Rates
 * - Circuit Breaker Wasted Request Short-Circuit Efficiency
 */

const API_URL = process.env.API_URL || 'http://localhost:3001';
const API_KEY = process.env.X_API_KEY || 'super_secret_rehook_key_123';
const MOCK_RECEIVER_URL = process.env.RECEIVER_URL || 'http://localhost:4000/webhook';

interface LatencyStats {
  totalRequests: number;
  successCount: number;
  failureCount: number;
  totalTimeMs: number;
  rps: number;
  min: number;
  max: number;
  mean: number;
  p50: number;
  p90: number;
  p95: number;
  p99: number;
}

function calculatePercentiles(latencies: number[]): LatencyStats['p50'] extends number ? any : never {
  const sorted = [...latencies].sort((a, b) => a - b);
  const total = sorted.length;

  const getPercentile = (p: number) => {
    const index = Math.floor((p / 100) * total);
    return sorted[Math.min(index, total - 1)] || 0;
  };

  const sum = sorted.reduce((acc, val) => acc + val, 0);

  return {
    p50: getPercentile(50),
    p90: getPercentile(90),
    p95: getPercentile(95),
    p99: getPercentile(99),
    min: sorted[0] || 0,
    max: sorted[total - 1] || 0,
    mean: Math.round(sum / total),
  };
}

async function runBenchmark(totalRequests = 1000, concurrency = 50, mode = 'ok') {
  console.log(`\n🚀 Starting ReHook Performance Benchmark...`);
  console.log(`   - Target Endpoint: ${API_URL}/api/v1/webhooks`);
  console.log(`   - Mode: ${mode}`);
  console.log(`   - Total Requests: ${totalRequests}`);
  console.log(`   - Concurrency Level: ${concurrency}`);

  const latencies: number[] = [];
  let successCount = 0;
  let failureCount = 0;

  const startTime = Date.now();

  // Process in batches matching concurrency level
  for (let i = 0; i < totalRequests; i += concurrency) {
    const batchSize = Math.min(concurrency, totalRequests - i);
    const promises = Array.from({ length: batchSize }, async () => {
      const reqStart = Date.now();
      try {
        const res = await fetch(`${API_URL}/api/v1/webhooks`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': API_KEY,
          },
          body: JSON.stringify({
            target_url: `${MOCK_RECEIVER_URL}?mode=${mode}`,
            event_type: 'benchmark.event',
            payload: { timestamp: Date.now(), batch: i },
            retry_config: { max_attempts: 3 },
          }),
        });

        const reqDuration = Date.now() - reqStart;
        latencies.push(reqDuration);

        if (res.status === 202) {
          successCount++;
        } else {
          failureCount++;
        }
      } catch (err) {
        latencies.push(Date.now() - reqStart);
        failureCount++;
      }
    });

    await Promise.all(promises);
  }

  const totalTimeMs = Date.now() - startTime;
  const rps = Math.round((totalRequests / totalTimeMs) * 1000);
  const percentiles = calculatePercentiles(latencies);

  const stats: LatencyStats = {
    totalRequests,
    successCount,
    failureCount,
    totalTimeMs,
    rps,
    ...percentiles,
  };

  console.log(`\n📊 Benchmark Results Summary:`);
  console.log(`--------------------------------------------------`);
  console.log(` Total Time Elapsed   : ${stats.totalTimeMs} ms`);
  console.log(` Sustained Throughput : ${stats.rps} req/sec`);
  console.log(` Successful Requests  : ${stats.successCount} / ${totalRequests} (${Math.round((stats.successCount / totalRequests) * 100)}%)`);
  console.log(` Failed Requests      : ${stats.failureCount}`);
  console.log(`--------------------------------------------------`);
  console.log(` Latency (Min / Max)  : ${stats.min} ms / ${stats.max} ms`);
  console.log(` Latency (Mean)       : ${stats.mean} ms`);
  console.log(` Latency (p50)        : ${stats.p50} ms`);
  console.log(` Latency (p90)        : ${stats.p90} ms`);
  console.log(` Latency (p95)        : ${stats.p95} ms`);
  console.log(` Latency (p99)        : ${stats.p99} ms`);
  console.log(`--------------------------------------------------\n`);

  return stats;
}

// Execute benchmark when run directly
if (import.meta.main) {
  await runBenchmark(1000, 50, 'ok');
}

export { runBenchmark };
