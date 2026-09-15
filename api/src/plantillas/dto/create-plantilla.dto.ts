import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsOptional,
  IsString,
  Length,
} from 'class-validator';

export class CreatePlantillaDto {
  /** Único campo obligatorio: el texto de la plantilla (primer mensaje). */
  @IsString()
  @Length(1, 4000)
  cuerpo: string;

  /**
   * Mensajes adicionales que se envían tras el cuerpo, en secuencia.
   * Ej: cuerpo = saludo, pasos[0] = solicitud de cotización.
   */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(9)
  @IsString({ each: true })
  @Length(1, 4000, { each: true })
  pasos?: string[];

  /** Categoría opcional para agrupar (General, Cemento, etc.). */
  @IsOptional()
  @IsString()
  @Length(1, 80)
  categoria?: string;

  @IsOptional()
  @IsBoolean()
  activa?: boolean;
}
