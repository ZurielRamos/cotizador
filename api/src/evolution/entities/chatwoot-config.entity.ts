import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * Configuración de conexión a Chatwoot (singleton).
 * El token se guarda cifrado; nunca se devuelve en claro al cliente.
 * Se usa para conectar cada instancia de WhatsApp a su bandeja (inbox)
 * al momento de crearla en Evolution API.
 */
@Entity('chatwoot_config')
export class ChatwootConfig {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** URL base de Chatwoot, sin la barra final. */
  @Column({ name: 'base_url' })
  baseUrl: string;

  /** ID de la cuenta de Chatwoot. */
  @Column({ name: 'account_id' })
  accountId: string;

  /** Token (user access token) cifrado (AES-256-GCM). */
  @Column({ name: 'token_encrypted', type: 'text' })
  tokenEncrypted: string;

  /** Últimos 4 caracteres del token, para mostrar una máscara. */
  @Column({ name: 'token_last4', length: 4 })
  tokenLast4: string;

  @CreateDateColumn({ name: 'creado_en' })
  creadoEn: Date;

  @UpdateDateColumn({ name: 'actualizado_en' })
  actualizadoEn: Date;
}
