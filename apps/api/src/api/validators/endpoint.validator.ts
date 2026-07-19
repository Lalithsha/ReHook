import { z } from 'zod';

export const createEndpointSchema = z.object({
  project_id: z.string().min(1, { message: 'project_id is required' }),
  target_url: z.string().url({ message: 'target_url must be a valid HTTP/HTTPS URL' }),
  description: z.string().optional(),
  secret_v1: z.string().min(8, { message: 'secret_v1 must be at least 8 characters long' }).optional(),
});

export const rotateSecretSchema = z.object({
  new_secret: z.string().min(8, { message: 'new_secret must be at least 8 characters long' }).optional(),
});
