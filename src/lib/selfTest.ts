import { DoublyLinkedList } from './DoublyLinkedList';

export interface CheckResult {
  name: string;
  passed: boolean;
}

export interface BenchmarkRow {
  name: string;
  listMs: number;
  arrayMs: number;
  note: string;
}

const build = (...values: number[]): DoublyLinkedList<number> => DoublyLinkedList.from(values, String);
const same = (list: DoublyLinkedList<number>, expected: number[]): boolean =>
  list.toArray().join() === expected.join() && list.toArrayReversed().join() === [...expected].reverse().join() && list.isConsistent();

/**
 * Pruebas que corren en el navegador (pestaña Laboratorio). Son un resumen de la batería
 * completa de Vitest, para ver en vivo que la estructura se comporta bien.
 */
export function runSelfTest(): CheckResult[] {
  const checks: [string, () => boolean][] = [
    ['La lista nueva está vacía', () => new DoublyLinkedList<number>().isEmpty()],
    ['addLast enlaza tail', () => same(build(1, 2, 3), [1, 2, 3])],
    ['addFirst cambia head', () => {
      const list = build(2, 3);
      list.addFirst(1);
      return same(list, [1, 2, 3]) && list.head?.value === 1;
    }],
    ['insertAt(0) equivale a insertar al inicio', () => {
      const list = build(2);
      list.insertAt(0, 1);
      return same(list, [1, 2]);
    }],
    ['insertAt(size) equivale a insertar al final', () => {
      const list = build(1);
      list.insertAt(1, 2);
      return same(list, [1, 2]);
    }],
    ['Insertar en el medio enlaza los 4 punteros', () => {
      const list = build(1, 3);
      const node = list.insertAt(1, 2);
      return same(list, [1, 2, 3]) && node?.prev?.value === 1 && node.next?.value === 3;
    }],
    ['Un índice inválido no modifica la lista', () => {
      const list = build(1, 2);
      return list.insertAt(9, 0) === null && list.removeAt(-1) === null && same(list, [1, 2]);
    }],
    ['Eliminar head, tail y el único nodo', () => {
      const list = build(1, 2, 3);
      list.removeAt(0);
      list.removeAt(1);
      list.removeAt(0);
      return list.isEmpty() && list.head === null && list.tail === null;
    }],
    ['Eliminar la canción actual pasa a la siguiente', () => {
      const list = build(1, 2, 3);
      list.setCurrentAt(1);
      list.removeById('2');
      return list.current?.value === 3;
    }],
    ['Eliminar la última actual pasa a la anterior', () => {
      const list = build(1, 2);
      list.setCurrentAt(1);
      list.removeAt(1);
      return list.current?.value === 1;
    }],
    ['next y previous respetan el modo repetir', () => {
      const list = build(1, 2);
      list.setCurrentAt(1);
      const stays = list.next('off') === null && list.current?.value === 2;
      const wraps = list.next('all') === 1 && list.previous('all') === 2;
      return stays && wraps;
    }],
    ['moveUp y moveDown conservan el mismo nodo', () => {
      const list = build(1, 2, 3);
      const node = list.tail;
      list.moveUp(2);
      list.moveUp(1);
      return same(list, [3, 1, 2]) && list.head === node && list.moveDown(0) && same(list, [1, 3, 2]);
    }],
    ['Con 10.000 nodos la lista sigue consistente', () => {
      const list = new DoublyLinkedList<number>(String);
      for (let i = 0; i < 10_000; i++) list.addLast(i);
      for (let i = 0; i < 200; i++) list.moveTo((i * 31) % list.size, (i * 97) % list.size);
      return list.size === 10_000 && list.isConsistent();
    }],
  ];
  return checks.map(([name, check]) => {
    try {
      return { name, passed: check() };
    } catch {
      return { name, passed: false };
    }
  });
}

function time(work: () => void): number {
  const start = performance.now();
  work();
  return performance.now() - start;
}

/** Compara la lista doble con un arreglo de JavaScript en tres operaciones, con `count` elementos. */
export function runBenchmark(count = 10_000): BenchmarkRow[] {
  const list = new DoublyLinkedList<number>(String);
  const array: number[] = [];

  const insertList = time(() => {
    for (let i = 0; i < count; i++) list.addFirst(i);
  });
  const insertArray = time(() => {
    for (let i = 0; i < count; i++) array.unshift(i);
  });

  const middle = Math.floor(count / 2);
  let sink = 0;
  const readList = time(() => {
    for (let i = 0; i < 300; i++) sink += list.getAt(middle) ?? 0;
  });
  const readArray = time(() => {
    for (let i = 0; i < 300; i++) sink += array[middle] ?? 0;
  });

  const removeList = time(() => {
    for (let i = 0; i < count; i++) list.removeAt(0);
  });
  const removeArray = time(() => {
    for (let i = 0; i < count; i++) array.shift();
  });

  // `sink` solo existe para que el motor de JavaScript no descarte las lecturas.
  void sink;
  return [
    { name: `Insertar ${count.toLocaleString('es')} al inicio`, listMs: insertList, arrayMs: insertArray, note: 'Lista O(1) por inserción; el arreglo corre todos sus elementos.' },
    { name: `Eliminar ${count.toLocaleString('es')} del inicio`, listMs: removeList, arrayMs: removeArray, note: 'Lista O(1); el arreglo vuelve a correr sus elementos.' },
    { name: 'Leer 300 veces la posición central', listMs: readList, arrayMs: readArray, note: 'Aquí gana el arreglo: acceso directo O(1) contra n/2 pasos de la lista.' },
  ];
}
