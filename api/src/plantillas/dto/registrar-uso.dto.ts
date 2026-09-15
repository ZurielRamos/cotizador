import { IsBoolean, IsInt, IsOptional, Min } from 'class-validator';

/**
 * Payload que envían los bots para registrar el resultado del uso de una
 * plantilla. Permite acumular métricas de utilización y efectividad.
 */
export class RegistrarUsoDto {
  /** Cuántos envíos se hicieron con esta plantilla (por defecto 1). */
  @IsOptional()
  @IsInt()
  @Min(1)
  envios?: number;

  /** Si el/los envío(s) recibieron respuesta del negocio. */
  @IsOptional()
  @IsBoolean()
  huboRespuesta?: boolean;

  /** Si la respuesta contenía una cotización de precio utilizable. */
  @IsOptional()
  @IsBoolean()
  huboCotizacion?: boolean;
}
