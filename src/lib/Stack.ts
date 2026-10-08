import { DoublyLinkedList } from './DoublyLinkedList';

/**
 * PILA (LIFO: el último en entrar es el primero en salir), construida sobre la lista doble:
 * el tope es `tail`. Se usa para deshacer, rehacer y el historial de lo escuchado.
 *
 * Con `limit`, al pasarse se descarta el elemento más viejo (el fondo, que es `head`) en O(1).
 */
export class Stack<T> {
  private readonly list = new DoublyLinkedList<T>();
  readonly limit: number;

  constructor(limit = Infinity) {
    this.limit = limit > 0 ? limit : Infinity;
  }

  get size(): number {
    return this.list.size;
  }

  isEmpty(): boolean {
    return this.list.isEmpty();
  }

  /** Pone un valor en el tope. */
  push(value: T): void {
    this.list.addLast(value);
    if (this.list.size > this.limit) this.list.removeAt(0);
  }

  /** Saca y devuelve el valor del tope (null si está vacía). */
  pop(): T | null {
    return this.list.removeAt(this.list.size - 1);
  }

  /** Mira el tope sin sacarlo. */
  peek(): T | null {
    return this.list.tail?.value ?? null;
  }

  clear(): void {
    this.list.clear();
  }

  /** Valores del tope al fondo. SOLO para pintar la interfaz. */
  toArray(): T[] {
    return this.list.toArrayReversed();
  }
}
