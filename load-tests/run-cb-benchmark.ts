import { prisma } from '../apps/api/src/db/index.js';
import { DistributedCircuitBreaker } from '../apps/api/src/services/circuitBreaker.service.js';

async function testCircuitBreakerEfficiency() {
  console.log(`\n🛡️ Measuring Circuit Breaker Efficiency...`);

  const deadUrl = 'http://localhost:4000/webhook?mode=fail';
  const cb = new DistributedCircuitBreaker(deadUrl);

  // Reset circuit breaker state in Redis
  await cb.recordSuccess(); // Reset state

  // Simulate 100 delivery attempts against a failing host
  let attemptedFetches = 0;
  let skippedByCircuit = 0;

  // Record 5 failures to trip the circuit to OPEN
  for (let i = 0; i < 5; i++) {
    await cb.recordFailure();
    attemptedFetches++;
  }

  // Next 95 attempts check circuit state
  for (let i = 0; i < 95; i++) {
    const isAllowed = await cb.isAllowed();
    if (isAllowed) {
      attemptedFetches++;
    } else {
      skippedByCircuit++;
    }
  }

  const reductionPercentage = Math.round((skippedByCircuit / (attemptedFetches + skippedByCircuit)) * 100);

  console.log(`--------------------------------------------------`);
  console.log(` Total Delivery Jobs Evaluated  : 100`);
  console.log(` Actual Outbound HTTP Attempts  : ${attemptedFetches}`);
  console.log(` Short-Circuited by Redlock/CB  : ${skippedByCircuit}`);
  console.log(` Wasted HTTP Traffic Reduction  : ${reductionPercentage}%`);
  console.log(`--------------------------------------------------\n`);

  return { attemptedFetches, skippedByCircuit, reductionPercentage };
}

if (import.meta.main) {
  await testCircuitBreakerEfficiency();
  process.exit(0);
}
