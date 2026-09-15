import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  type Relation,
} from 'typeorm';
import { Municipio } from './municipio.entity.js';

/**
 * Depósito (ferretería) perteneciente a un municipio de una programación.
 * Los campos de negocio provienen del endpoint externo. El id/IDdeposito de
 * origen se guardan como datos; la clave primaria es un uuid propio.
 */
@Entity('programacion_depositos')
export class Deposito {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** Id del depósito proveniente del endpoint externo (campo "id"). */
  @Column({ name: 'deposito_id', type: 'varchar', length: 50 })
  depositoId: string;

  /** Código IDdeposito proveniente del endpoint externo. */
  @Column({ name: 'id_deposito', type: 'varchar', length: 50, nullable: true })
  idDeposito: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  nombre: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  telefono: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  telefono2: string | null;

  @Column({ type: 'text', nullable: true })
  direccion: string | null;

  @ManyToOne(() => Municipio, (municipio) => municipio.depositos, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'municipio_id' })
  municipio: Relation<Municipio>;
}
