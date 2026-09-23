import { IsString, Length } from 'class-validator';

/** Envío de la campaña de un municipio concreto de una programación. */
export class EnviarMunicipioDto {
  @IsString()
  @Length(1, 150)
  municipio: string;
}
