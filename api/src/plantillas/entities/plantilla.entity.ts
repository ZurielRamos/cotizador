import {
  Column,
  CreateDateColumn,
  Entity,
  Generated,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * Plantilla de texto usada por los bots para pedir cotizaciones de precios
 * (p. ej. precios de cemento) a los negocios vía WhatsApp / Evolution API.
 *
 * No requiere título: cada plantilla se identifica por un número correlativo
 * automático (`numero`). Lo único obligatorio al crearla es el `cuerpo`.
 *
 * Incluye métricas básicas de:
 *  - Utilización: cuántas veces se ha enviado y cuándo fue el último envío.
 *  - Efectividad: cuántas respuestas y cuántas cotizaciones válidas se
 *    obtuvieron a partir de los envíos de esta plantilla.
 */
@Entity('plantillas')
export class Plantilla {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /**
   * Número correlativo autoincremental para identificar la plantilla sin
   * necesidad de ponerle un título. Se asigna solo al crearla.
   */
  @Column({ type: 'int', unique: true })
  @Generated('increment')
  numero: number;

  /** Categoría libre opcional para agrupar (General, Cemento, etc.). */
  @Column({ length: 80, default: 'General' })
  categoria: string;

  /**
   * Texto que se envía al negocio. Es el único campo obligatorio.
   * Puede contener variables tipo {{nombre}} que los bots reemplazan
   * antes de enviar.
   */
  @Column({ type: 'text' })
  cuerpo: string;

  /**
   * Mensajes adicionales (pasos 2, 3, …) que se envían en secuencia tras el
   * `cuerpo`, cada uno con su propio delay. Vacío = un solo mensaje.
   * La secuencia completa de envío es [cuerpo, ...pasos].
   */
  @Column({ type: 'jsonb', default: () => "'[]'" })
  pasos: string[];

  @Column({ default: true })
  activa: boolean;

  // ---- Métricas de utilización ----

  /** Número total de veces que la plantilla fue enviada. */
  @Column({ name: 'veces_usada', type: 'int', default: 0 })
  vecesUsada: number;

  /** Fecha/hora del último envío. Null si nunca se ha usado. */
  @Column({ name: 'ultimo_uso_en', type: 'timestamptz', nullable: true })
  ultimoUsoEn: Date | null;

  // ---- Métricas de efectividad ----

  /** Respuestas recibidas de negocios tras enviar esta plantilla. */
  @Column({ name: 'respuestas_recibidas', type: 'int', default: 0 })
  respuestasRecibidas: number;

  /** Respuestas que sí contenían una cotización de precio utilizable. */
  @Column({ name: 'cotizaciones_obtenidas', type: 'int', default: 0 })
  cotizacionesObtenidas: number;

  @CreateDateColumn({ name: 'creado_en' })
  creadoEn: Date;

  @UpdateDateColumn({ name: 'actualizado_en' })
  actualizadoEn: Date;

  /**
   * Secuencia completa de mensajes a enviar: el cuerpo seguido de los pasos
   * adicionales (ignorando vacíos). Se calcula al vuelo.
   */
  get mensajes(): string[] {
    const extra = Array.isArray(this.pasos) ? this.pasos : [];
    return [this.cuerpo, ...extra].filter((m) => m && m.trim() !== '');
  }

  /**
   * Tasa de efectividad = cotizaciones obtenidas / veces usada (0-1).
   * Se calcula al vuelo; no se persiste.
   */
  get tasaEfectividad(): number {
    if (this.vecesUsada <= 0) return 0;
    return Number((this.cotizacionesObtenidas / this.vecesUsada).toFixed(4));
  }

  /**
   * Tasa de respuesta = respuestas recibidas / veces usada (0-1).
   * Se calcula al vuelo; no se persiste.
   */
  get tasaRespuesta(): number {
    if (this.vecesUsada <= 0) return 0;
    return Number((this.respuestasRecibidas / this.vecesUsada).toFixed(4));
  }
}
