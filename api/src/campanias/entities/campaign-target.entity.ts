import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Campaign } from './campaign.entity.js';

export type TargetStatus =
  /** Creado pero aún no lanzado (su municipio no ha sido enviado). */
  | 'queued'
  | 'pending'
  | 'sending'
  | 'sent'
  | 'failed'
  | 'skipped';

/**
 * Un destinatario dentro de una campaña. Guarda a qué plantilla y dispositivo
 * quedó asignado y el resultado del envío.
 */
@Entity('campaign_targets')
@Index(['campaign', 'estado'])
export class CampaignTarget {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Campaign, (c) => c.targets, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'campaign_id' })
  campaign: Campaign;

  /** Número destino en formato internacional sin + (ej. 5215512345678). */
  @Column({ type: 'varchar', length: 32 })
  numero: string;

  /** Municipio del depósito (para la cuota por municipio). */
  @Column({ type: 'varchar', length: 150, nullable: true })
  municipio: string | null;

  /** Meta de cotizaciones del municipio (copiada de la programación). */
  @Column({ type: 'int', default: 0 })
  requerido: number;

  /** Marcado manual: este destinatario entregó una cotización de precio. */
  @Column({ default: false })
  cotizacion: boolean;

  /** Plantilla asignada a este target. */
  @Column({ name: 'plantilla_id', type: 'uuid' })
  plantillaId: string;

  @Column({ type: 'varchar', length: 16, default: 'pending' })
  estado: TargetStatus;

  /** Instancia (dispositivo) que realizó/está realizando el envío. */
  @Column({ name: 'instance_name', type: 'varchar', nullable: true })
  instanceName: string | null;

  /** Id de la conversación en Chatwoot asociada a este destinatario. */
  @Column({ name: 'chatwoot_conversation_id', type: 'int', nullable: true })
  chatwootConversationId: number | null;

  /** True si el negocio respondió al mensaje. */
  @Column({ default: false })
  respondido: boolean;

  @Column({ name: 'respondido_en', type: 'timestamptz', nullable: true })
  respondidoEn: Date | null;

  /** Nº de intentos de envío. */
  @Column({ type: 'int', default: 0 })
  intentos: number;

  /** Último error, si el envío falló. */
  @Column({ name: 'ultimo_error', type: 'text', nullable: true })
  ultimoError: string | null;

  @Column({ name: 'enviado_en', type: 'timestamptz', nullable: true })
  enviadoEn: Date | null;

  @CreateDateColumn({ name: 'creado_en' })
  creadoEn: Date;

  @UpdateDateColumn({ name: 'actualizado_en' })
  actualizadoEn: Date;
}
