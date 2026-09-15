import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { CampaignTarget } from './campaign-target.entity.js';

export type CampaignStatus =
  | 'draft'
  | 'running'
  | 'paused'
  | 'completed'
  | 'cancelled';

/**
 * Campaña de envío: una lista de números a los que se les envía una de las
 * plantillas asignadas, distribuyendo la carga entre los dispositivos
 * disponibles y respetando los límites de warm-up.
 */
@Entity('campaigns')
export class Campaign {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 150 })
  nombre: string;

  /**
   * Programación a la que pertenece esta campaña (una campaña por
   * programación). Null para campañas no ligadas a una programación.
   */
  @Column({ name: 'programacion_id', type: 'int', nullable: true })
  programacionId: number | null;

  @Column({ type: 'varchar', length: 20, default: 'draft' })
  estado: CampaignStatus;

  /**
   * IDs de las plantillas asignadas. A cada target se le asigna una plantilla
   * de esta lista (round-robin) al crear la campaña.
   */
  @Column({ name: 'plantilla_ids', type: 'jsonb', default: () => "'[]'" })
  plantillaIds: string[];

  @OneToMany(() => CampaignTarget, (t) => t.campaign, { cascade: true })
  targets: CampaignTarget[];

  @CreateDateColumn({ name: 'creado_en' })
  creadoEn: Date;

  @UpdateDateColumn({ name: 'actualizado_en' })
  actualizadoEn: Date;
}
