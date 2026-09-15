import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * Configuración de conexión a Evolution API.
 * Se maneja como un único registro (singleton) en la tabla.
 * El apiKey se guarda cifrado; nunca se devuelve en claro al cliente.
 */
@Entity('evolution_config')
export class EvolutionConfig {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'base_url' })
  baseUrl: string;

  /** API Key cifrado (AES-256-GCM). */
  @Column({ name: 'api_key_encrypted', type: 'text' })
  apiKeyEncrypted: string;

  /** Últimos 4 caracteres del API Key, para mostrar una máscara. */
  @Column({ name: 'api_key_last4', length: 4 })
  apiKeyLast4: string;

  @CreateDateColumn({ name: 'creado_en' })
  creadoEn: Date;

  @UpdateDateColumn({ name: 'actualizado_en' })
  actualizadoEn: Date;
}
