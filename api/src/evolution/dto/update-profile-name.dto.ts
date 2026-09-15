import { IsString, Length } from 'class-validator';

export class UpdateProfileNameDto {
  @IsString()
  @Length(1, 100)
  name: string;
}
