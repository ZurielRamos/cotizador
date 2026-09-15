import {
  ArrayNotEmpty,
  IsArray,
  IsString,
  IsUUID,
  Length,
} from 'class-validator';

export class CreateCampaignDto {
  @IsString()
  @Length(1, 150)
  nombre: string;

  /** Números destino (formato internacional; se normalizan quitando no dígitos). */
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  numeros: string[];

  /** Plantillas a usar (se reparten round-robin entre los targets). */
  @IsArray()
  @ArrayNotEmpty()
  @IsUUID('4', { each: true })
  plantillaIds: string[];
}
