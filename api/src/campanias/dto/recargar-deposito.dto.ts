import { IsString, Length } from 'class-validator';

/** Recarga un depósito con otro aleatorio del mismo municipio. */
export class RecargarDepositoDto {
  /** depositoId (id de origen) del depósito a reemplazar. */
  @IsString()
  @Length(1, 50)
  depositoId: string;
}
