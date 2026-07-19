import { config } from '../configs/env.config.js';

const TOTAL_REQUESTS = 1000;
const CONCURRENCY = 50;

async function runBenchmark() {
  console.log(`
  🚀 Starting ReHook High-Concurrency Load Benchmark
  --------------------------------------------------
  Total Ingestions: ${TOTAL_REQUESTS}
  Concurrency Level: ${CONCURRENCY}
  Target API:       http://localhost:${config.port}/api/v1/webhooks
  --------------------------------------------------
  `);

  const startTime = Date.now();
  let successCount = 0;
  let failureCount = 0;

  const sendRequest = async (index: number) => {
    try {
      const res = await fetch(`http://localhost:${config.port}/api/v1/webhooks`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': config.apiKey,
        },
        body: JSON.stringify({
          target_url: 'http://localhost:4000/webhook',
          event_type: 'benchmark.event',
          payload: { index, timestamp: Date.now() },
        }),
      });

      if (res.status === 202) {
        successCount++;
      } else {
        failureCount++;
      }
    } catch {
      failureCount++;
    }
  };

  const chunks = [];
  for (let i = 0; i < TOTAL_REQUESTS; i += CONCURRENCY) {
    const batch = Array.from({ length: Math.min(CONCURRENCY, TOTAL_REQUESTS - i) }, (_, k) => sendRequest(i + k));
    chunks.push(Promise.all(batch));
  }

  for (const chunk of chunks) {
    await chunk;
  }

  const totalTimeMs = Date.now() - startTime;
  const requestsPerSec = ((TOTAL_REQUESTS / totalTimeMs) * 1000).toFixed(2);
  const avgLatencyMs = (totalTimeMs / TOTAL_REQUESTS).toFixed(2);

  console.log(`
  📊 Benchmark Results
  --------------------------------------------------
  Completed In:        ${totalTimeMs} ms
  Throughput:          ${requestsPerSec} requests/sec
  Average Ingest Time: ${avgLatencyMs} ms / request
  Successful (202):    ${successCount}
  Failed:              ${failureCount}
  --------------------------------------------------
  `);
}

runBenchmark().catch(console.error);
