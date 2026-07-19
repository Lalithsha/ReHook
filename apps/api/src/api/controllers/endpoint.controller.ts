import { Request, Response } from 'express';
import { createEndpointSchema, rotateSecretSchema } from '../validators/endpoint.validator.js';
import { EndpointService } from '../../services/endpoint.service.js';

export class EndpointController {
  /**
   * POST /api/v1/endpoints
   */
  static async createEndpoint(req: Request, res: Response): Promise<void> {
    try {
      const parseResult = createEndpointSchema.safeParse(req.body);
      if (!parseResult.success) {
        res.status(400).json({
          error: 'Bad Request',
          message: 'Invalid request body payload',
          details: parseResult.error.flatten(),
        });
        return;
      }

      const endpoint = await EndpointService.createEndpoint(parseResult.data);
      res.status(201).json({
        message: 'Webhook endpoint registered successfully',
        endpoint: {
          id: endpoint.id,
          project_id: endpoint.projectId,
          target_url: endpoint.targetUrl,
          secret_v1: endpoint.secretV1,
          secret_v2: endpoint.secretV2,
          status: endpoint.status,
          created_at: endpoint.createdAt,
        },
      });
    } catch (error: any) {
      console.error('[CreateEndpoint Error]', error);
      res.status(500).json({ error: 'Internal Server Error', message: error.message });
    }
  }

  /**
   * POST /api/v1/endpoints/:id/rotate
   */
  static async rotateSecret(req: Request, res: Response): Promise<void> {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const parseResult = rotateSecretSchema.safeParse(req.body || {});
      if (!parseResult.success) {
        res.status(400).json({
          error: 'Bad Request',
          details: parseResult.error.flatten(),
        });
        return;
      }

      const endpoint = await EndpointService.rotateSecret(id, parseResult.data.new_secret);
      if (!endpoint) {
        res.status(404).json({ error: 'Not Found', message: 'Endpoint not found' });
        return;
      }

      res.json({
        message: 'Endpoint signing secret rotated successfully. Both v1 and v2 signatures will be sent during grace period.',
        endpoint: {
          id: endpoint.id,
          target_url: endpoint.targetUrl,
          secret_v1: endpoint.secretV1,
          secret_v2: endpoint.secretV2,
          updated_at: endpoint.updatedAt,
        },
      });
    } catch (error: any) {
      console.error('[RotateSecret Error]', error);
      res.status(500).json({ error: 'Internal Server Error', message: error.message });
    }
  }

  /**
   * GET /api/v1/endpoints
   */
  static async getEndpoints(req: Request, res: Response): Promise<void> {
    try {
      const projectId = (req.query.project_id as string) || 'default';
      const endpoints = await EndpointService.getEndpointsByProject(projectId);
      res.json({
        project_id: projectId,
        total: endpoints.length,
        endpoints,
      });
    } catch (error: any) {
      res.status(500).json({ error: 'Internal Server Error', message: error.message });
    }
  }
}
