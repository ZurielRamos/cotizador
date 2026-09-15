import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  type Relation,
} from 'typeorm';
import { Deposito } from './deposito.entity.js';
import { Programacion } from './programacion.entity.js';

/**
 * Municipio dentro de una programación. Un municipio puede repetirse entre
 * distintas programaciones, por eso su clave primaria es un uuid propio y se
 * guarda `municipioId` (el id de negocio que entrega el endpoint) como dato.
 */
@Entity('programacion_municipios')
@Index(['programacion', 'municipioId'], { unique: true })
export class Municipio {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** Id de municipio proveniente del endpoint externo (municipio_id). */
  @Column({ name: 'municipio_id', type: 'int' })
  municipioId: number;

  @Column({ length: 150 })
  municipio: string;

  @Column({ length: 150 })
  departamento: string;

  @Column({ type: 'int', default: 0 })
  requerido: number;

  @Column({ name: 'objetivo_triple', type: 'int', default: 0 })
  objetivoTriple: number;

  @Column({ name: 'depositos_devueltos', type: 'int', default: 0 })
  depositosDevueltos: number;

  @ManyToOne(() => Programacion, (programacion) => programacion.municipios, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'programacion_id' })
  programacion: Relation<Programacion>;

  @OneToMany(() => Deposito, (deposito) => deposito.municipio, {
    cascade: true,
  })
  depositos: Relation<Deposito[]>;
}
