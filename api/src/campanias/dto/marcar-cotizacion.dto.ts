import { IsBoolean, IsString, Length } from 'class-validator';

export class MarcarCotizacionDto {
  @IsString()
  @Length(8, 32)
  numero: string;

  @IsBoolean()
  cotizacion: boolean;
}
