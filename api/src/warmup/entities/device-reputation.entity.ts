import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * Estado de warm-up y reputación de un dispositivo (instancia de WhatsApp).
 * Se identifica por el nombre de la instancia en Evolution.
 */
@Entity('device_reputations')
export class DeviceReputation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** Nombre de la instancia en Evolution (único). */
  @Column({ name: 'instance_name', unique: true })
  instanceName: string;

  /**
   * Primera vez que la instancia se vio conectada (open). Define la antigüedad
   * a partir de la cual se calcula el tier. Null si aún no se ha conectado.
   */
  @Column({ name: 'first_connected_at', type: 'timestamptz', nullable: true })
  firstConnectedAt: Date | null;

  /** Reputación 0.0–1.0 (arranca en 1.0). */
  @Column({
    name: 'reputation_score',
    type: 'numeric',
    precision: 3,
    scale: 2,
    default: 1,
  })
  reputationScore: string;

  /** Pausado manualmente o por reputación baja: no se le asignan envíos. */
  @Column({ name: 'paused', default: false })
  paused: boolean;

  // ---- Contadores de envío (con ventanas de reseteo) ----

  @Column({ name: 'sent_today', type: 'int', default: 0 })
  sentToday: number;

  /** Inicio del día (UTC) al que corresponde sentToday. */
  @Column({ name: 'day_window_start', type: 'timestamptz', nullable: true })
  dayWindowStart: Date | null;

  @Column({ name: 'sent_this_hour', type: 'int', default: 0 })
  sentThisHour: number;

  /** Inicio de la hora (UTC) a la que corresponde sentThisHour. */
  @Column({ name: 'hour_window_start', type: 'timestamptz', nullable: true })
  hourWindowStart: Date | null;

  /** Último envío realizado (para el cooldown/jitter). */
  @Column({ name: 'last_sent_at', type: 'timestamptz', nullable: true })
  lastSentAt: Date | null;

  /** No enviar antes de este instante (cooldown aleatorio tras el último envío). */
  @Column({ name: 'next_allowed_at', type: 'timestamptz', nullable: true })
  nextAllowedAt: Date | null;

  // ---- Métricas acumuladas para reputación ----

  @Column({ name: 'total_sent', type: 'int', default: 0 })
  totalSent: number;

  @Column({ name: 'total_delivered', type: 'int', default: 0 })
  totalDelivered: number;

  @Column({ name: 'total_failed', type: 'int', default: 0 })
  totalFailed: number;

  @Column({ name: 'total_replies', type: 'int', default: 0 })
  totalReplies: number;

  @CreateDateColumn({ name: 'creado_en' })
  creadoEn: Date;

  @UpdateDateColumn({ name: 'actualizado_en' })
  actualizadoEn: Date;
}
