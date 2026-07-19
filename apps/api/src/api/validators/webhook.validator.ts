import { z } from 'zod';

export const registerWebhookSchema = z.object({
  target_url: z.string().url({ message: 'target_url must be a valid HTTP/HTTPS URL' }),
  event_type: z.string().min(1, { message: 'event_type is required' }),
  payload: z.record(z.any()),
  headers: z.record(z.string()).optional(),
  meta: z.record(z.any()).optional(),
  retry_config: z
    .object({
      max_attempts: z.number().int().min(1).max(20).optional().default(5),
      initial_delay_ms: z.number().int().min(100).max(86400000).optional().default(5000),
    })
    .optional(),
});
