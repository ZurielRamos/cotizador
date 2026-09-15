import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryColumn,
  UpdateDateColumn,
  type Relation,
} from 'typeorm';
import { Municipio } from './municipio.entity.js';

/**
 * Programación telefónica cargada desde el endpoint externo
 * (pricecontrolv2.strategee.us/depositos/muestra_telefonica_json).
 *
 * El `id` NO es autogenerado: es el mismo id que devuelve el endpoint origen,
 * de modo que si se intenta cargar dos veces la misma programación se detecte
 * el duplicado y no se vuelva a insertar.
 */
@Entity('programaciones')
export class Programacion {
  /** Id de la programación tal como lo entrega el endpoint externo. */
  @PrimaryColumn({ type: 'int' })
  id: number;

  @Column({ name: 'fecha_inicio', type: 'date' })
  fechaInicio: string;

  @Column({ name: 'fecha_fin', type: 'date' })
  fechaFin: string;

  @OneToMany(() => Municipio, (municipio) => municipio.programacion, {
    cascade: true,
  })
  municipios: Relation<Municipio[]>;

  @CreateDateColumn({ name: 'creado_en' })
  creadoEn: Date;

  @UpdateDateColumn({ name: 'actualizado_en' })
  actualizadoEn: Date;
}
