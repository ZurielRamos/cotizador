import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * Un nivel de calentamiento. minDays = antigüedad mínima (en días) para
 * alcanzar este tier. Los delays están en segundos y definen el rango de
 * espera aleatoria (jitter) entre mensajes.
 */
export type WarmupTier = {
  tier: number;
  label: string;
  minDays: number;
  dailyLimit: number;
  hourlyLimit: number;
  minDelaySeconds: number;
  maxDelaySeconds: number;
};

const DEFAULT_TIERS: WarmupTier[] = [
  { tier: 0, label: 'Nuevo', minDays: 0, dailyLimit: 15, hourlyLimit: 4, minDelaySeconds: 180, maxDelaySeconds: 480 },
  { tier: 1, label: 'Joven', minDays: 3, dailyLimit: 30, hourlyLimit: 6, minDelaySeconds: 120, maxDelaySeconds: 300 },
  { tier: 2, label: 'Medio', minDays: 7, dailyLimit: 60, hourlyLimit: 10, minDelaySeconds: 60, maxDelaySeconds: 180 },
  { tier: 3, label: 'Maduro', minDays: 14, dailyLimit: 120, hourlyLimit: 18, minDelaySeconds: 45, maxDelaySeconds: 120 },
  { tier: 4, label: 'Establecido', minDays: 30, dailyLimit: 250, hourlyLimit: 30, minDelaySeconds: 30, maxDelaySeconds: 90 },
];

/**
 * Configuración global de warm-up y límites (singleton). Editable desde la UI.
 */
@Entity('warmup_config')
export class WarmupConfig {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** Escala de tiers. Se guarda como JSON para poder editarla desde la UI. */
  @Column({ type: 'jsonb', default: () => `'${JSON.stringify(DEFAULT_TIERS)}'` })
  tiers: WarmupTier[];

  /** Zona horaria IANA para la ventana de envío (ej. America/Mexico_City). */
  @Column({ name: 'timezone', default: 'America/Mexico_City' })
  timezone: string;

  /** Hora (0-23) a la que empieza la ventana de envío permitida. */
  @Column({ name: 'window_start_hour', type: 'int', default: 8 })
  windowStartHour: number;

  /** Hora (0-23) a la que termina la ventana de envío permitida. */
  @Column({ name: 'window_end_hour', type: 'int', default: 21 })
  windowEndHour: number;

  /** Score por debajo del cual el dispositivo se pausa automáticamente. */
  @Column({
    name: 'pause_threshold',
    type: 'numeric',
    precision: 3,
    scale: 2,
    default: 0.4,
  })
  pauseThreshold: string;

  /** Piso mínimo del multiplicador de reputación (para no anular el envío). */
  @Column({
    name: 'min_reputation_multiplier',
    type: 'numeric',
    precision: 3,
    scale: 2,
    default: 0.5,
  })
  minReputationMultiplier: string;

  @CreateDateColumn({ name: 'creado_en' })
  creadoEn: Date;

  @UpdateDateColumn({ name: 'actualizado_en' })
  actualizadoEn: Date;
}

export { DEFAULT_TIERS };
