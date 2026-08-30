/**
 * Cuánta gente hay ahora mismo en la fila cero.
 *
 * Vive en un Durable Object y no en D1 por una cuestión de cuentas: tres mil
 * personas latiendo cada treinta segundos son cien escrituras por segundo, y D1
 * atiende las consultas de una en una. Ese goteo se comería la mayor parte del
 * presupuesto de escritura de toda la base, y encima justo la noche en que hay
 * que guardar mensajes y fotos.
 *
 * Aquí no se escribe nada: es un Map en memoria. Tres mil personas son unos
 * ciento cincuenta kilobytes, y al aislado le sobran ciento veintiocho megas.
 * A disco sólo baja el récord de la noche, una vez por minuto.
 *
 * Se cuenta por huella de IP y no por la ficha que genera el navegador, porque la
 * ficha se falsea con un curl. La cifra es lo que va a mirar la prensa: un
 * contador que cualquiera puede inflar desde su casa desacredita la convocatoria
 * entera, y desmentirlo después no sirve de nada.
 */

import { DurableObject } from "cloudflare:workers";

/** Sin latido en este tiempo, se da por ido: el cliente late cada 30 s. */
const VENTANA_MS = 90_000;

/** El recuento se recalcula como mucho cada tanto; el resto se sirve tal cual. */
const CACHE_MS = 3_000;

interface Presencia {
  /** El número de butaca, que no cambia mientras el objeto siga en pie. */
  butaca: number;
  /** Último latido. */
  visto: number;
}

export interface Aforado {
  /** Personas con latido reciente. */
  ahora: number;
  /** Cuántas han pasado en total. Sólo sube: es la cifra honesta. */
  total: number;
  /** El máximo simultáneo de la noche, para poder cerrarla con un número. */
  pico: number;
  /** La butaca de quien acaba de latir, si venía a latir. */
  butaca?: number;
}

export class Aforo extends DurableObject {
  private gente = new Map<string, Presencia>();
  private base = 0;            // butacas repartidas antes de un reinicio
  private pico = 0;
  private cargado = false;
  private ultimoConteo = 0;
  private ultimoAhora = 0;

  /** El objeto puede reiniciarse: el total y el récord no pueden empezar de cero. */
  private async cargar(): Promise<void> {
    if (this.cargado) return;
    this.cargado = true;
    this.base = (await this.ctx.storage.get<number>("base")) ?? 0;
    this.pico = (await this.ctx.storage.get<number>("pico")) ?? 0;
    if (!(await this.ctx.storage.getAlarm())) await this.ctx.storage.setAlarm(Date.now() + 60_000);
  }

  private contar(): number {
    const ahora = Date.now();
    if (ahora - this.ultimoConteo < CACHE_MS) return this.ultimoAhora;
    let vivos = 0;
    for (const p of this.gente.values()) if (ahora - p.visto < VENTANA_MS) vivos++;
    this.ultimoConteo = ahora;
    this.ultimoAhora = vivos;
    if (vivos > this.pico) this.pico = vivos;
    return vivos;
  }

  /** Alguien sigue ahí. Devuelve su butaca, que es la misma cada vez que vuelve. */
  async latir(huella: string): Promise<Aforado> {
    await this.cargar();
    let quien = this.gente.get(huella);
    if (!quien) {
      quien = { butaca: this.base + this.gente.size + 1, visto: 0 };
      this.gente.set(huella, quien);
      // Quien acaba de llegar tiene que verse a si mismo en la cuenta. Sin esto,
      // la primera cosa que lee alguien al entrar es "0 personas ahora mismo",
      // que es justo lo contrario de para lo que existe esta pantalla.
      this.ultimoConteo = 0;
    }
    quien.visto = Date.now();
    return { ahora: this.contar(), total: this.base + this.gente.size, pico: this.pico, butaca: quien.butaca };
  }

  /** Sólo mirar, para el feed. */
  async mirar(): Promise<Aforado> {
    await this.cargar();
    return { ahora: this.contar(), total: this.base + this.gente.size, pico: this.pico };
  }

  /**
   * Cada minuto: se olvida a quien hace rato que no aparece y se baja el récord a
   * disco. Las butacas ya repartidas se suman a `base` para que el total no
   * retroceda al soltar sus filas.
   */
  async alarm(): Promise<void> {
    await this.cargar();
    const ahora = Date.now();
    this.contar();
    let soltadas = 0;
    for (const [huella, p] of this.gente) {
      if (ahora - p.visto > VENTANA_MS * 20) {   // media hora sin dar señales
        this.gente.delete(huella);
        soltadas++;
      }
    }
    if (soltadas) this.base += soltadas;
    await this.ctx.storage.put({ base: this.base, pico: this.pico });
    await this.ctx.storage.setAlarm(ahora + 60_000);
  }
}
