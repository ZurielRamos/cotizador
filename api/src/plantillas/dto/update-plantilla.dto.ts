import { PartialType } from '@nestjs/mapped-types';
import { CreatePlantillaDto } from './create-plantilla.dto.js';

export class UpdatePlantillaDto extends PartialType(CreatePlantillaDto) {}
