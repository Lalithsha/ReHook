import express from 'express';

const app = express();
app.use(express.json());

const PORT = 4000;
let requestCount = 0;

/**
 * Mock Webhook Target Receiver Endpoint
 * Simulates:
 * - 200 OK
 * - 500 Internal Error (for failure retries)
 * - 429 Rate Limited
 * - Signature Verification check
 */
app.post('/webhook', (req, res) => {
  requestCount++;

  const signature = req.headers['x-rehook-signature'];
  const timestamp = req.headers['x-rehook-timestamp'];
  const deliveryId = req.headers['x-rehook-delivery-id'];
  const mode = req.query.mode as string; // 'ok', 'fail', 'rate_limit', 'random'

  console.log(`[MockReceiver] Received Webhook #${requestCount} | Delivery-ID: ${deliveryId} | Sig: ${signature ? 'PRESENT' : 'NONE'}`);

  if (mode === 'fail') {
    res.status(500).json({ error: 'Internal Server Error', message: 'Simulated subscriber crash' });
    return;
  }

  if (mode === 'rate_limit') {
    res.status(429).json({ error: 'Too Many Requests', message: 'Simulated subscriber rate limit' });
    return;
  }

  if (mode === 'random') {
    if (Math.random() < 0.5) {
      res.status(500).json({ error: 'Simulated random 500 failure' });
      return;
    }
  }

  res.status(200).json({
    status: 'received',
    received_at: new Date().toISOString(),
    request_number: requestCount,
  });
});

app.listen(PORT, () => {
  console.log(`
  🧪 ReHook Mock Target Webhook Receiver is running!
  -----------------------------------------------
  📡 Endpoint: http://localhost:${PORT}/webhook
  Modes available:
    - Normal OK:          http://localhost:${PORT}/webhook
    - Simulated 500 Fail: http://localhost:${PORT}/webhook?mode=fail
    - Simulated 429:      http://localhost:${PORT}/webhook?mode=rate_limit
    - Random 50% Fail:    http://localhost:${PORT}/webhook?mode=random
  -----------------------------------------------
  `);
});
