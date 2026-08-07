import { prisma } from '../db/index.js';
import { WebhookEndpoint } from '@prisma/client';
import crypto from 'crypto';
import { assertSafeTargetUrl } from '../utils/targetUrl.utils.js';

export interface CreateEndpointInput {
  project_id: string;
  target_url: string;
  description?: string;
  secret_v1?: string;
}

export class EndpointService {
  /**
   * Registers a new webhook endpoint with a signing secret
   */
  static async createEndpoint(input: CreateEndpointInput): Promise<WebhookEndpoint> {
    await assertSafeTargetUrl(input.target_url);
    const secretV1 = input.secret_v1 || `whsec_${crypto.randomBytes(24).toString('hex')}`;

    return prisma.webhookEndpoint.create({
      data: {
        projectId: input.project_id,
        targetUrl: input.target_url,
        description: input.description,
        secretV1,
        status: 'active',
      },
    });
  }

  /**
   * Rotates signing secret for zero-downtime key migration
   * Promotes active secretV1 -> secretV2, assigns new secretV1
   */
  static async rotateSecret(endpointId: string, projectId: string, newSecret?: string): Promise<WebhookEndpoint | null> {
    const endpoint = await prisma.webhookEndpoint.findUnique({ where: { id: endpointId, projectId } });
    if (!endpoint) {
      return null;
    }

    const nextSecretV1 = newSecret || `whsec_${crypto.randomBytes(24).toString('hex')}`;

    return prisma.webhookEndpoint.update({
      where: { id: endpointId },
      data: {
        secretV2: endpoint.secretV1, // Promote old V1 to V2
        secretV1: nextSecretV1,      // Assign new V1
      },
    });
  }

  /**
   * Gets endpoint by ID
   */
  static async getEndpointById(id: string): Promise<WebhookEndpoint | null> {
    return prisma.webhookEndpoint.findUnique({ where: { id } });
  }

  /**
   * Lists endpoints by project ID
   */
  static async getEndpointsByProject(projectId: string): Promise<WebhookEndpoint[]> {
    return prisma.webhookEndpoint.findMany({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
    });
  }
}
