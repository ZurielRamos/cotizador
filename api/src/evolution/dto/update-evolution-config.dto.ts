import { IsString, IsUrl, MinLength } from 'class-validator';

export class UpdateEvolutionConfigDto {
  @IsUrl(
    { require_protocol: true },
    { message: 'baseUrl debe ser una URL válida con protocolo (http/https).' },
  )
  baseUrl: string;

  @IsString()
  @MinLength(1, { message: 'apiKey es obligatorio.' })
  apiKey: string;
}
