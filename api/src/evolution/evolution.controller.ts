import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseFilePipe,
  Post,
  Put,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ChatwootService } from './chatwoot.service.js';
import { CreateInstanceDto } from './dto/create-instance.dto.js';
import { UpdateChatwootConfigDto } from './dto/update-chatwoot-config.dto.js';
import { UpdateEvolutionConfigDto } from './dto/update-evolution-config.dto.js';
import { UpdateProfileNameDto } from './dto/update-profile-name.dto.js';
import { UpdateProfileStatusDto } from './dto/update-profile-status.dto.js';
import {
  EvolutionInstancesService,
  type UploadedImage,
} from './evolution-instances.service.js';
import { EvolutionService } from './evolution.service.js';

@Controller('evolution')
export class EvolutionController {
  constructor(
    private readonly evolutionService: EvolutionService,
    private readonly instancesService: EvolutionInstancesService,
    private readonly chatwootService: ChatwootService,
  ) {}

  /** Estado público de la configuración (sin el apiKey en claro). */
  @Get('config')
  getConfig() {
    return this.evolutionService.getPublicConfig();
  }

  /** Crea o actualiza la configuración. */
  @Put('config')
  updateConfig(@Body() dto: UpdateEvolutionConfigDto) {
    return this.evolutionService.upsert(dto);
  }

  /** Estado público de la configuración de Chatwoot (sin token en claro). */
  @Get('chatwoot/config')
  getChatwootConfig() {
    return this.chatwootService.getPublicConfig();
  }

  /** Crea o actualiza la configuración de Chatwoot. */
  @Put('chatwoot/config')
  updateChatwootConfig(@Body() dto: UpdateChatwootConfigDto) {
    return this.chatwootService.upsert(dto);
  }

  /** Lista las instancias reales desde Evolution API. */
  @Get('instances')
  listInstances() {
    return this.instancesService.listInstances();
  }

  /** Crea una nueva instancia y devuelve el QR para vincular. */
  @Post('instances')
  createInstance(@Body() dto: CreateInstanceDto) {
    return this.instancesService.createInstance(dto);
  }

  /** Obtiene un nuevo QR para vincular/reconectar una instancia. */
  @Get('instances/:name/connect')
  connectInstance(@Param('name') name: string) {
    return this.instancesService.connectInstance(name);
  }

  /** Cambia el nombre del perfil de WhatsApp de la instancia. */
  @Post('instances/:name/profile/name')
  @HttpCode(HttpStatus.NO_CONTENT)
  updateProfileName(
    @Param('name') name: string,
    @Body() dto: UpdateProfileNameDto,
  ) {
    return this.instancesService.updateProfileName(name, dto.name);
  }

  /** Cambia el mensaje de estado/recado del perfil de WhatsApp. */
  @Post('instances/:name/profile/status')
  @HttpCode(HttpStatus.NO_CONTENT)
  updateProfileStatus(
    @Param('name') name: string,
    @Body() dto: UpdateProfileStatusDto,
  ) {
    return this.instancesService.updateProfileStatus(name, dto.status);
  }

  /** Bloquea (lógicamente) una instancia: congela todas las operaciones. */
  @Post('instances/:name/block')
  @HttpCode(HttpStatus.NO_CONTENT)
  blockInstance(@Param('name') name: string) {
    return this.instancesService.blockInstance(name);
  }

  /** Desbloquea una instancia. */
  @Delete('instances/:name/block')
  @HttpCode(HttpStatus.NO_CONTENT)
  unblockInstance(@Param('name') name: string) {
    return this.instancesService.unblockInstance(name);
  }

  /** Elimina la instancia en Evolution API. */
  @Delete('instances/:name')
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteInstance(@Param('name') name: string) {
    return this.instancesService.deleteInstance(name);
  }

  /** Cambia la foto de perfil. Recibe la imagen como multipart (campo "file"). */
  @Post('instances/:name/profile/picture')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
    }),
  )
  updateProfilePicture(
    @Param('name') name: string,
    @UploadedFile(
      new ParseFilePipe({
        fileIsRequired: true,
      }),
    )
    file: UploadedImage,
  ) {
    if (!file.mimetype?.startsWith('image/')) {
      throw new BadRequestException('El archivo debe ser una imagen.');
    }
    return this.instancesService.updateProfilePicture(name, file);
  }
}
