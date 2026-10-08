import { DoublyLinkedList } from './DoublyLinkedList';

/**
 * COLA (FIFO: el primero en entrar es el primero en salir), construida sobre la lista doble:
 * se encola por `tail` y se desencola por `head`, ambas en O(1).
 * Se usa para "Reproducir a continuación" y para la consola de operaciones.
 */
export class Queue<T> {
  private readonly list: DoublyLinkedList<T>;
  readonly limit: number;

  constructor(limit = Infinity, getId?: (value: T) => string) {
    this.list = new DoublyLinkedList<T>(getId);
    this.limit = limit > 0 ? limit : Infinity;
  }

  get size(): number {
    return this.list.size;
  }

  isEmpty(): boolean {
    return this.list.isEmpty();
  }

  /** Agrega al final de la fila. Si se pasa del límite, sale el más antiguo. */
  enqueue(value: T): void {
    this.list.addLast(value);
    if (this.list.size > this.limit) this.list.removeAt(0);
  }

  /** Saca y devuelve el frente de la fila (null si está vacía). */
  dequeue(): T | null {
    return this.list.removeAt(0);
  }

  /** Mira el frente sin sacarlo. */
  peek(): T | null {
    return this.list.head?.value ?? null;
  }

  /** Quita un elemento concreto de la fila por su identificador. */
  removeById(id: string): T | null {
    return this.list.removeById(id);
  }

  clear(): void {
    this.list.clear();
  }

  /** Valores del frente al final. SOLO para pintar la interfaz. */
  toArray(): T[] {
    return this.list.toArray();
  }
}
