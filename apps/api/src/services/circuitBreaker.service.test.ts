import { describe, expect, it, mock } from 'bun:test';
import { DistributedCircuitBreaker, CircuitState } from './circuitBreaker.service.js';

describe('Distributed Circuit Breaker (Redis State Machine)', () => {
  it('should initialize state as CLOSED by default', async () => {
    const cb = new DistributedCircuitBreaker('https://example-test-endpoint.com/webhook');
    cb.getState = mock(async (): Promise<CircuitState> => 'CLOSED');
    
    const state = await cb.getState();
    const isAllowed = await cb.isAllowed();

    expect(state).toBe('CLOSED');
    expect(isAllowed).toBe(true);
  });

  it('should deny traffic when state is OPEN', async () => {
    const cb = new DistributedCircuitBreaker('https://failing-target.com/webhook');
    cb.getState = mock(async (): Promise<CircuitState> => 'OPEN');
    cb.isAllowed = mock(async (): Promise<boolean> => false);

    const isAllowed = await cb.isAllowed();
    expect(isAllowed).toBe(false);
  });

  it('should allow trial request when state is HALF_OPEN', async () => {
    const cb = new DistributedCircuitBreaker('https://recovering-target.com/webhook');
    cb.getState = mock(async (): Promise<CircuitState> => 'HALF_OPEN');
    cb.isAllowed = mock(async (): Promise<boolean> => true);

    const isAllowed = await cb.isAllowed();
    expect(isAllowed).toBe(true);
  });
});
