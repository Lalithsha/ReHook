import { app } from './app.js';
import { config } from './configs/env.config.js';

app.listen(config.port, () => {
  console.log(`
  🚀 ReHook Webhook Delivery Engine is running!
  -----------------------------------------------
  📡 API Server:  http://localhost:${config.port}
  📊 Metrics:     http://localhost:${config.port}/api/v1/metrics
  🏥 Healthcheck: http://localhost:${config.port}/api/health
  -----------------------------------------------
  `);
});
