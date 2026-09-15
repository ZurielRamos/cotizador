import { IsIn, IsOptional, IsString, Matches } from 'class-validator';

export class CreateInstanceDto {
  @IsString()
  @Matches(/^[a-zA-Z0-9_-]+$/, {
    message:
      'instanceName solo puede contener letras, números, guiones y guiones bajos.',
  })
  instanceName: string;

  @IsOptional()
  @IsIn(['WHATSAPP-BAILEYS', 'WHATSAPP-BUSINESS'])
  integration?: 'WHATSAPP-BAILEYS' | 'WHATSAPP-BUSINESS';
}
