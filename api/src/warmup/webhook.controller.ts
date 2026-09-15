import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import {
  WebhookService,
  type EvolutionWebhookPayload,
} from './webhook.service.js';

/**
 * Receptor de webhooks de Evolution. Vive bajo /evolution para que la URL sea
 * coherente, aunque la lógica pertenece al dominio de warm-up/reputación.
 *
 * El body llega con campos arbitrarios de Evolution; se recibe sin DTO tipado
 * para que el ValidationPipe global (forbidNonWhitelisted) no lo rechace.
 */
@Controller('evolution')
export class WebhookController {
  constructor(private readonly webhookService: WebhookService) {}

  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  async receive(@Body() payload: EvolutionWebhookPayload): Promise<{ ok: true }> {
    // Procesa sin bloquear la respuesta a Evolution.
    await this.webhookService.handle(payload);
    return { ok: true };
  }
}
