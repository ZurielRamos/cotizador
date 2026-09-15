import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

/**
 * Registro de bloqueo lógico de una instancia de WhatsApp.
 * Si existe una fila con el nombre de la instancia, esa instancia queda
 * "congelada": no se puede editar su perfil, ni generar QR/reconectar, ni
 * eliminarla. Solo se permite desbloquearla (borrar esta fila).
 */
@Entity('instance_locks')
export class InstanceLock {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** Nombre de la instancia bloqueada (único). */
  @Column({ name: 'instance_name', unique: true })
  instanceName: string;

  @CreateDateColumn({ name: 'creado_en' })
  creadoEn: Date;
}
