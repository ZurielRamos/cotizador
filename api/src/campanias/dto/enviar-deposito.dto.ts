import { IsString, Length } from 'class-validator';

/** Envío individual de un depósito (por teléfono) de una programación. */
export class EnviarDepositoDto {
  @IsString()
  @Length(7, 32)
  telefono: string;
}
