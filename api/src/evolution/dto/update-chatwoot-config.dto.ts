import { IsString, IsUrl, Matches, MinLength } from 'class-validator';

export class UpdateChatwootConfigDto {
  @IsUrl(
    { require_protocol: true },
    { message: 'baseUrl debe ser una URL válida con protocolo (http/https).' },
  )
  baseUrl: string;

  @Matches(/^\d+$/, { message: 'accountId debe ser numérico.' })
  accountId: string;

  @IsString()
  @MinLength(1, { message: 'token es obligatorio.' })
  token: string;
}
