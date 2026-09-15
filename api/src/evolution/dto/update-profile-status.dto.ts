import { IsString, Length } from 'class-validator';

export class UpdateProfileStatusDto {
  /** Mensaje de estado/recado del perfil de WhatsApp. */
  @IsString()
  @Length(0, 139)
  status: string;
}
