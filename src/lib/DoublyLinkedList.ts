/**
 * LISTA DOBLEMENTE ENLAZADA
 *
 * Cada nodo guarda un valor y DOS punteros: `prev` (nodo anterior) y `next` (nodo siguiente).
 * La lista solo recuerda tres nodos: `head` (primero), `tail` (último) y `current` (la canción
 * que suena). Todo lo demás se alcanza caminando por los punteros.
 *
 *   null ← [A] ⇄ [B] ⇄ [C] ⇄ [D] → null
 *           ↑           ↑     ↑
 *          head      current  tail
 *
 * REGLA DEL TALLER: aquí no se usa ningún arreglo para guardar ni mover nodos.
 * `toArray()` existe únicamente para que la interfaz pueda pintar la lista.
 */

/** Nodo de la lista: un valor y sus dos enlaces. */
export class ListNode<T> {
  value: T;
  prev: ListNode<T> | null = null;
  next: ListNode<T> | null = null;

  constructor(value: T) {
    this.value = value;
  }
}

/** Modo de repetición: decide qué pasa en los extremos de la lista. */
export type RepeatMode = 'off' | 'all' | 'one';

/** Extremo desde el que se empezó a caminar para llegar a una posición. */
export type TraversalStart = 'head' | 'tail';

/** Costo de una operación, en notación Big-O. */
export type Complexity = 'O(1)' | 'O(n)' | 'O(n²)';

/** Resumen de la última operación. La interfaz lo muestra en la consola y anima el recorrido. */
export interface OperationReport {
  /** Nombre de la operación tal como se llamó, por ejemplo `insertAt(3)`. */
  operation: string;
  /** Cuántos enlaces se recorrieron para llegar al nodo. */
  steps: number;
  /** Desde qué extremo se caminó (null si no hizo falta caminar). */
  from: TraversalStart | null;
  complexity: Complexity;
  /** Explicación en lenguaje claro. */
  detail: string;
}

/** Resultado de buscar un nodo por posición. */
interface Located<T> {
  node: ListNode<T>;
  steps: number;
  from: TraversalStart;
}

/** Por defecto, el identificador de un valor es su propiedad `id` (o el valor mismo). */
function defaultGetId(value: unknown): string {
  if (typeof value === 'object' && value !== null && 'id' in value) {
    return String((value as { id: unknown }).id);
  }
  return String(value);
}

export class DoublyLinkedList<T> {
  private _head: ListNode<T> | null = null;
  private _tail: ListNode<T> | null = null;
  private _current: ListNode<T> | null = null;
  private _size = 0;
  private _lastOperation: OperationReport | null = null;
  private readonly getId: (value: T) => string;

  /** `getId` indica cómo identificar un valor (lo usan `removeById` e `indexOf`). */
  constructor(getId: (value: T) => string = defaultGetId) {
    this.getId = getId;
  }

  /** Crea una lista agregando los valores en orden, uno por uno, al final. */
  static from<T>(values: Iterable<T>, getId?: (value: T) => string): DoublyLinkedList<T> {
    const list = new DoublyLinkedList<T>(getId);
    for (const value of values) list.addLast(value);
    list._lastOperation = null;
    return list;
  }

  /**
   * Copia la lista nodo por nodo (sin arreglos intermedios) y conserva cuál es la canción
   * actual. Permite ordenar o reemplazar la lista y poder deshacer volviendo a la original.
   */
  clone(): DoublyLinkedList<T> {
    const copy = new DoublyLinkedList<T>(this.getId);
    let node = this._head;
    while (node !== null) {
      const added = copy.addLast(node.value);
      if (node === this._current) copy._current = added;
      node = node.next;
    }
    copy._lastOperation = null;
    return copy;
  }

  // ───────────────────────── Lectura ─────────────────────────

  get head(): ListNode<T> | null {
    return this._head;
  }

  get tail(): ListNode<T> | null {
    return this._tail;
  }

  /** Nodo de la canción en reproducción (null si no hay ninguna). */
  get current(): ListNode<T> | null {
    return this._current;
  }

  get size(): number {
    return this._size;
  }

  /** Informe de la última operación ejecutada. */
  get lastOperation(): OperationReport | null {
    return this._lastOperation;
  }

  isEmpty(): boolean {
    return this._size === 0;
  }

  // ───────────────────────── Agregar ─────────────────────────

  /** Agrega al inicio. O(1): solo se toca la cabeza. */
  addFirst(value: T): ListNode<T> {
    const node = new ListNode(value);
    this.linkFirst(node);
    this.report('addFirst()', 0, null, 'O(1)', 'El nodo nuevo apunta a la antigua head y pasa a ser head.');
    return node;
  }

  /** Agrega al final. O(1): gracias al puntero `tail` no hay que recorrer la lista. */
  addLast(value: T): ListNode<T> {
    const node = new ListNode(value);
    this.linkLast(node);
    this.report('addLast()', 0, null, 'O(1)', 'La antigua tail apunta al nodo nuevo y este pasa a ser tail.');
    return node;
  }

  /**
   * Inserta para que el valor quede en la posición `index` (0 = inicio, size = final).
   * Devuelve null si el índice no es válido. En el medio hay que reconectar 4 punteros.
   */
  insertAt(index: number, value: T): ListNode<T> | null {
    if (!Number.isInteger(index) || index < 0 || index > this._size) {
      this.report(`insertAt(${index})`, 0, null, 'O(1)', `Índice inválido: debe estar entre 0 y ${this._size}.`);
      return null;
    }
    if (index === 0) {
      const node = this.addFirst(value);
      this.report('insertAt(0)', 0, null, 'O(1)', 'Posición 0: equivale a addFirst().');
      return node;
    }
    if (index === this._size) {
      const node = this.addLast(value);
      this.report(`insertAt(${index})`, 0, null, 'O(1)', 'Última posición: equivale a addLast().');
      return node;
    }

    // Se camina hasta el nodo que hoy ocupa esa posición: el nuevo va justo antes.
    const { node: follower, steps, from } = this.locate(index);
    const node = new ListNode(value);
    this.linkBefore(follower, node);
    this.report(
      `insertAt(${index})`,
      steps,
      from,
      'O(n)',
      `${describeWalk(steps, from)} y se reconectaron 4 punteros.`,
    );
    return node;
  }

  /** Inserta justo después de la canción actual (o al final si no hay actual). O(1). */
  insertAfterCurrent(value: T): ListNode<T> {
    if (this._current === null || this._current === this._tail) {
      const node = this.addLast(value);
      this.report('insertAfterCurrent()', 0, null, 'O(1)', 'Se enlazó después de tail.');
      return node;
    }
    const node = new ListNode(value);
    this.linkBefore(this._current.next as ListNode<T>, node);
    this.report('insertAfterCurrent()', 0, null, 'O(1)', 'Ya se conoce el nodo current: no hay que recorrer nada.');
    return node;
  }

  // ───────────────────────── Eliminar ─────────────────────────

  /** Elimina el nodo de la posición `index` y devuelve su valor (null si el índice no es válido). */
  removeAt(index: number): T | null {
    if (!this.isValidIndex(index)) {
      this.report(`removeAt(${index})`, 0, null, 'O(1)', this.invalidIndexDetail());
      return null;
    }
    const { node, steps, from } = this.locate(index);
    this.unlink(node);
    this.report(
      `removeAt(${index})`,
      steps,
      from,
      'O(n)',
      `${describeWalk(steps, from)} y se reconectaron 2 punteros.`,
    );
    return node.value;
  }

  /** Busca desde head el nodo con ese identificador, lo elimina y devuelve su valor (o null). */
  removeById(id: string): T | null {
    let node = this._head;
    let steps = 0;
    while (node !== null && this.getId(node.value) !== id) {
      node = node.next;
      steps++;
    }
    if (node === null) {
      this.report(`removeById("${id}")`, steps, 'head', 'O(n)', 'Se recorrió toda la lista y no existe ese id.');
      return null;
    }
    this.unlink(node);
    this.report(
      `removeById("${id}")`,
      steps,
      'head',
      'O(n)',
      `${describeWalk(steps, 'head')} y se reconectaron 2 punteros.`,
    );
    return node.value;
  }

  /** Suelta todos los nodos. O(n) porque limpia los punteros de cada uno. */
  clear(): void {
    const removed = this._size;
    let node = this._head;
    while (node !== null) {
      const next = node.next;
      node.prev = null;
      node.next = null;
      node = next;
    }
    this._head = null;
    this._tail = null;
    this._current = null;
    this._size = 0;
    this.report('clear()', removed, 'head', 'O(n)', `Se soltaron ${removed} nodos; head, tail y current quedan en null.`);
  }

  // ───────────────────────── Navegar (puntero current) ─────────────────────────

  /**
   * Avanza `current` por el puntero `next` y devuelve la canción nueva.
   * - Sin canción actual: empieza por head.
   * - 'one': se queda en la misma canción.
   * - En la última: con 'all' vuelve a head (la lista se comporta como circular);
   *   con 'off' no se mueve y devuelve null.
   */
  next(repeat: RepeatMode = 'off'): T | null {
    if (this._size === 0) {
      this.report('next()', 0, null, 'O(1)', 'La lista está vacía.');
      return null;
    }
    if (this._current === null) {
      this._current = this._head;
      this.report('next()', 0, null, 'O(1)', 'No había canción actual: current = head.');
      return (this._current as ListNode<T>).value;
    }
    if (repeat === 'one') {
      this.report('next()', 0, null, 'O(1)', 'Repetir una: current no se mueve.');
      return this._current.value;
    }
    if (this._current.next !== null) {
      this._current = this._current.next;
      this.report('next()', 1, null, 'O(1)', 'current = current.next');
      return this._current.value;
    }
    if (repeat === 'all') {
      this._current = this._head as ListNode<T>;
      this.report('next()', 1, null, 'O(1)', 'Era la última y repetir está activo: current = head.');
      return this._current.value;
    }
    this.report('next()', 0, null, 'O(1)', 'Era la última y repetir está apagado: no hay siguiente.');
    return null;
  }

  /**
   * Retrocede `current` por el puntero `prev` (lo que una lista simple no puede hacer).
   * En la primera: con 'all' salta a tail; con 'off' no se mueve y devuelve null.
   */
  previous(repeat: RepeatMode = 'off'): T | null {
    if (this._size === 0) {
      this.report('previous()', 0, null, 'O(1)', 'La lista está vacía.');
      return null;
    }
    if (this._current === null) {
      this._current = this._head;
      this.report('previous()', 0, null, 'O(1)', 'No había canción actual: current = head.');
      return (this._current as ListNode<T>).value;
    }
    if (repeat === 'one') {
      this.report('previous()', 0, null, 'O(1)', 'Repetir una: current no se mueve.');
      return this._current.value;
    }
    if (this._current.prev !== null) {
      this._current = this._current.prev;
      this.report('previous()', 1, null, 'O(1)', 'current = current.prev');
      return this._current.value;
    }
    if (repeat === 'all') {
      this._current = this._tail as ListNode<T>;
      this.report('previous()', 1, null, 'O(1)', 'Era la primera y repetir está activo: current = tail.');
      return this._current.value;
    }
    this.report('previous()', 0, null, 'O(1)', 'Era la primera y repetir está apagado: no hay anterior.');
    return null;
  }

  /** Pone `current` en la posición `index`. Devuelve la canción o null si el índice no es válido. */
  setCurrentAt(index: number): T | null {
    if (!this.isValidIndex(index)) {
      this.report(`setCurrentAt(${index})`, 0, null, 'O(1)', this.invalidIndexDetail());
      return null;
    }
    const { node, steps, from } = this.locate(index);
    this._current = node;
    this.report(`setCurrentAt(${index})`, steps, from, 'O(n)', `${describeWalk(steps, from)}: current = ese nodo.`);
    return node.value;
  }

  /** Pone `current` en el nodo con ese identificador. */
  setCurrentById(id: string): T | null {
    return this.setCurrentAt(this.indexOf(id));
  }

  /** Deja la lista sin canción actual. */
  clearCurrent(): void {
    this._current = null;
  }

  // ───────────────────────── Reordenar ─────────────────────────

  /** Sube una posición el nodo de `index` (lo intercambia con su anterior). */
  moveUp(index: number): boolean {
    if (!this.isValidIndex(index) || index === 0) {
      this.report(`moveUp(${index})`, 0, null, 'O(1)', index === 0 ? 'Ya es el primero: no puede subir.' : this.invalidIndexDetail());
      return false;
    }
    const moved = this.moveTo(index, index - 1);
    this.relabel(`moveUp(${index})`);
    return moved;
  }

  /** Baja una posición el nodo de `index` (lo intercambia con su siguiente). */
  moveDown(index: number): boolean {
    if (!this.isValidIndex(index) || index === this._size - 1) {
      this.report(
        `moveDown(${index})`,
        0,
        null,
        'O(1)',
        this.isValidIndex(index) ? 'Ya es el último: no puede bajar.' : this.invalidIndexDetail(),
      );
      return false;
    }
    const moved = this.moveTo(index, index + 1);
    this.relabel(`moveDown(${index})`);
    return moved;
  }

  /**
   * Mueve el MISMO nodo (no una copia) de `from` a `to`: lo desenlaza y lo vuelve a enlazar.
   * Como el nodo es el mismo, si era `current` lo sigue siendo. Sirve para arrastrar y soltar.
   */
  moveTo(from: number, to: number): boolean {
    if (!this.isValidIndex(from) || !this.isValidIndex(to)) {
      this.report(`moveTo(${from}, ${to})`, 0, null, 'O(1)', this.invalidIndexDetail());
      return false;
    }
    if (from === to) {
      this.report(`moveTo(${from}, ${to})`, 0, null, 'O(1)', 'Misma posición: no cambia nada.');
      return true;
    }
    const located = this.locate(from);
    const node = located.node;
    this.detach(node);

    if (to === 0) {
      this.linkFirst(node);
    } else if (to === this._size) {
      this.linkLast(node);
    } else {
      this.linkBefore(this.locate(to).node, node);
    }
    this.report(
      `moveTo(${from}, ${to})`,
      located.steps,
      located.from,
      'O(n)',
      `${describeWalk(located.steps, located.from)}; se desenlazó el nodo y se volvió a enlazar en la posición ${to}.`,
    );
    return true;
  }

  /**
   * Ordena la lista con el método de inserción, moviendo nodos (no valores) por sus punteros.
   * Lo usa el Modo DJ para ordenar por ritmo. O(n²) en el peor caso.
   */
  sort(compare: (a: T, b: T) => number): void {
    let moves = 0;
    let node = this._head?.next ?? null;
    while (node !== null) {
      const upcoming = node.next;
      // Se busca hacia atrás el primer nodo que NO sea mayor que el que se está acomodando.
      let anchor = node.prev;
      while (anchor !== null && compare(anchor.value, node.value) > 0) anchor = anchor.prev;
      if (anchor !== node.prev) {
        this.detach(node);
        if (anchor === null) this.linkFirst(node);
        else if (anchor.next === null) this.linkLast(node);
        else this.linkBefore(anchor.next, node);
        moves++;
      }
      node = upcoming;
    }
    this.report('sort()', moves, 'head', 'O(n²)', `Ordenamiento por inserción sobre los nodos: ${moves} nodos se reenlazaron.`);
  }

  // ───────────────────────── Consultar ─────────────────────────

  /** Valor de la posición `index`, o null si el índice no es válido. */
  getAt(index: number): T | null {
    if (!this.isValidIndex(index)) return null;
    return this.locate(index).node.value;
  }

  /** Posición del valor con ese identificador, o -1 si no está. Recorre desde head. */
  indexOf(id: string): number {
    let node = this._head;
    let index = 0;
    while (node !== null) {
      if (this.getId(node.value) === id) return index;
      node = node.next;
      index++;
    }
    return -1;
  }

  /**
   * Cambia el valor guardado en el nodo con ese identificador, sin mover el nodo ni tocar
   * sus punteros. Devuelve el valor nuevo, o null si no existe. Sirve para marcar favoritas.
   */
  update(id: string, change: (value: T) => T): T | null {
    let node = this._head;
    while (node !== null) {
      if (this.getId(node.value) === id) {
        node.value = change(node.value);
        return node.value;
      }
      node = node.next;
    }
    return null;
  }

  /** Posición de la canción actual, o -1 si no hay. */
  currentIndex(): number {
    if (this._current === null) return -1;
    let node = this._head;
    let index = 0;
    while (node !== null) {
      if (node === this._current) return index;
      node = node.next;
      index++;
    }
    return -1;
  }

  /**
   * Cuántos pasos costaría llegar a `index` y desde qué extremo. No modifica nada:
   * la interfaz lo usa para mostrar la operación antes de confirmarla.
   */
  walkCost(index: number): { steps: number; from: TraversalStart } {
    const clamped = Math.max(0, Math.min(index, Math.max(0, this._size - 1)));
    return clamped < this._size / 2
      ? { steps: clamped, from: 'head' }
      : { steps: Math.max(0, this._size - 1 - clamped), from: 'tail' };
  }

  /** Copia los valores de head a tail. SOLO para pintar la interfaz. */
  toArray(): T[] {
    const values: T[] = [];
    let node = this._head;
    while (node !== null) {
      values.push(node.value);
      node = node.next;
    }
    return values;
  }

  /** Copia los valores de tail a head siguiendo `prev`. SOLO para pintar la interfaz. */
  toArrayReversed(): T[] {
    const values: T[] = [];
    let node = this._tail;
    while (node !== null) {
      values.push(node.value);
      node = node.prev;
    }
    return values;
  }

  /** Comprueba que todos los punteros sean coherentes en ambos sentidos (lo usan las pruebas). */
  isConsistent(): boolean {
    if (this._size === 0) return this._head === null && this._tail === null && this._current === null;
    if (this._head === null || this._tail === null) return false;
    if (this._head.prev !== null || this._tail.next !== null) return false;

    let count = 0;
    let seenCurrent = this._current === null;
    let previous: ListNode<T> | null = null;
    let node: ListNode<T> | null = this._head;
    while (node !== null && count <= this._size) {
      if (node.prev !== previous) return false;
      if (node === this._current) seenCurrent = true;
      previous = node;
      node = node.next;
      count++;
    }
    return count === this._size && previous === this._tail && seenCurrent;
  }

  // ───────────────────────── Enlaces internos ─────────────────────────

  private isValidIndex(index: number): boolean {
    return Number.isInteger(index) && index >= 0 && index < this._size;
  }

  private invalidIndexDetail(): string {
    return this._size === 0
      ? 'La lista está vacía.'
      : `Índice inválido: debe estar entre 0 y ${this._size - 1}.`;
  }

  /**
   * Camina hasta la posición `index` (que debe ser válida). Ventaja de la lista doble:
   * si la posición está en la segunda mitad, se empieza por tail y se retrocede con `prev`,
   * así que nunca se dan más de n/2 pasos.
   */
  private locate(index: number): Located<T> {
    if (index < this._size / 2) {
      let node = this._head as ListNode<T>;
      for (let i = 0; i < index; i++) node = node.next as ListNode<T>;
      return { node, steps: index, from: 'head' };
    }
    const steps = this._size - 1 - index;
    let node = this._tail as ListNode<T>;
    for (let i = 0; i < steps; i++) node = node.prev as ListNode<T>;
    return { node, steps, from: 'tail' };
  }

  private linkFirst(node: ListNode<T>): void {
    node.prev = null;
    node.next = this._head;
    if (this._head !== null) this._head.prev = node;
    else this._tail = node;
    this._head = node;
    this._size++;
  }

  private linkLast(node: ListNode<T>): void {
    node.next = null;
    node.prev = this._tail;
    if (this._tail !== null) this._tail.next = node;
    else this._head = node;
    this._tail = node;
    this._size++;
  }

  /** Enlaza `node` justo antes de `follower`. `follower` no puede ser head. */
  private linkBefore(follower: ListNode<T>, node: ListNode<T>): void {
    const leader = follower.prev as ListNode<T>;
    node.prev = leader; //     1
    node.next = follower; //   2
    leader.next = node; //     3
    follower.prev = node; //   4
    this._size++;
  }

  /** Saca el nodo de la cadena reconectando a sus dos vecinos entre sí. No toca `current`. */
  private detach(node: ListNode<T>): void {
    if (node.prev !== null) node.prev.next = node.next;
    else this._head = node.next;
    if (node.next !== null) node.next.prev = node.prev;
    else this._tail = node.prev;
    node.prev = null;
    node.next = null;
    this._size--;
  }

  /**
   * Elimina el nodo. Si era la canción que suena, `current` pasa a la siguiente;
   * si era la última, a la anterior; y si no queda ninguna, a null.
   */
  private unlink(node: ListNode<T>): void {
    if (node === this._current) this._current = node.next ?? node.prev;
    this.detach(node);
  }

  private report(
    operation: string,
    steps: number,
    from: TraversalStart | null,
    complexity: Complexity,
    detail: string,
  ): void {
    this._lastOperation = { operation, steps, from, complexity, detail };
  }

  private relabel(operation: string): void {
    if (this._lastOperation !== null) this._lastOperation = { ...this._lastOperation, operation };
  }
}

/** Describe el recorrido en lenguaje claro, por ejemplo "Se dieron 2 pasos desde head". */
function describeWalk(steps: number, from: TraversalStart): string {
  if (steps === 0) return `El nodo es ${from}, no hubo que caminar`;
  const direction = from === 'head' ? 'por next' : 'por prev';
  return `Se ${steps === 1 ? 'dio 1 paso' : `dieron ${steps} pasos`} desde ${from} ${direction}`;
}
