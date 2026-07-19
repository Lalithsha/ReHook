import { app } from './app.js';
import { config } from './configs/env.config.js';
import './workers/init.js'; // Start worker processes in single process or split process

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
