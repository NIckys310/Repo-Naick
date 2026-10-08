import { describe, expect, it } from 'vitest';
import { DoublyLinkedList } from '../DoublyLinkedList';

interface Item {
  id: string;
}

const item = (id: string): Item => ({ id });

/** Crea una lista con los ids dados, en orden. */
function listOf(...ids: string[]): DoublyLinkedList<Item> {
  return DoublyLinkedList.from(ids.map(item));
}

/** Ids de head a tail. */
const ids = (list: DoublyLinkedList<Item>): string[] => list.toArray().map((value) => value.id);

/** Ids de tail a head, caminando por `prev`. */
const idsReversed = (list: DoublyLinkedList<Item>): string[] => list.toArrayReversed().map((value) => value.id);

/** Comprueba el orden en ambos sentidos y la coherencia de todos los punteros. */
function expectOrder(list: DoublyLinkedList<Item>, expected: string[]): void {
  expect(ids(list)).toEqual(expected);
  expect(idsReversed(list)).toEqual([...expected].reverse());
  expect(list.size).toBe(expected.length);
  expect(list.isConsistent()).toBe(true);
}

describe('lista vacía', () => {
  it('empieza sin nodos', () => {
    const list = new DoublyLinkedList<Item>();
    expect(list.isEmpty()).toBe(true);
    expect(list.size).toBe(0);
    expect(list.head).toBeNull();
    expect(list.tail).toBeNull();
    expect(list.current).toBeNull();
    expect(list.toArray()).toEqual([]);
    expect(list.isConsistent()).toBe(true);
  });

  it('las operaciones de lectura y borrado no fallan', () => {
    const list = new DoublyLinkedList<Item>();
    expect(list.removeAt(0)).toBeNull();
    expect(list.removeById('x')).toBeNull();
    expect(list.getAt(0)).toBeNull();
    expect(list.indexOf('x')).toBe(-1);
    expect(list.next()).toBeNull();
    expect(list.previous()).toBeNull();
    expect(list.next('all')).toBeNull();
    expect(list.moveUp(0)).toBe(false);
    expect(list.moveDown(0)).toBe(false);
    expect(list.currentIndex()).toBe(-1);
    list.clear();
    expect(list.isEmpty()).toBe(true);
  });
});

describe('addFirst y addLast', () => {
  it('addFirst cambia head', () => {
    const list = new DoublyLinkedList<Item>();
    list.addFirst(item('b'));
    list.addFirst(item('a'));
    expectOrder(list, ['a', 'b']);
    expect(list.head?.value.id).toBe('a');
    expect(list.head?.prev).toBeNull();
  });

  it('addLast enlaza tail', () => {
    const list = new DoublyLinkedList<Item>();
    list.addLast(item('a'));
    list.addLast(item('b'));
    expectOrder(list, ['a', 'b']);
    expect(list.tail?.value.id).toBe('b');
    expect(list.tail?.prev?.value.id).toBe('a');
    expect(list.tail?.next).toBeNull();
  });

  it('con un solo elemento, head y tail son el mismo nodo', () => {
    const list = new DoublyLinkedList<Item>();
    const node = list.addFirst(item('a'));
    expect(list.head).toBe(node);
    expect(list.tail).toBe(node);
    expect(node.prev).toBeNull();
    expect(node.next).toBeNull();
    expect(list.isEmpty()).toBe(false);
  });

  it('agregar no mueve la canción actual', () => {
    const list = listOf('a', 'b');
    list.setCurrentAt(1);
    list.addFirst(item('z'));
    list.addLast(item('c'));
    expect(list.current?.value.id).toBe('b');
    expect(list.currentIndex()).toBe(2);
  });
});

describe('insertAt', () => {
  it('en 0 equivale a insertar al inicio', () => {
    const list = listOf('b', 'c');
    list.insertAt(0, item('a'));
    expectOrder(list, ['a', 'b', 'c']);
  });

  it('en size equivale a insertar al final', () => {
    const list = listOf('a', 'b');
    list.insertAt(2, item('c'));
    expectOrder(list, ['a', 'b', 'c']);
    expect(list.tail?.value.id).toBe('c');
  });

  it('en el medio enlaza los 4 punteros', () => {
    const list = listOf('a', 'c');
    const node = list.insertAt(1, item('b'));
    expectOrder(list, ['a', 'b', 'c']);
    expect(node?.prev?.value.id).toBe('a');
    expect(node?.next?.value.id).toBe('c');
    expect(list.head?.next).toBe(node);
    expect(list.tail?.prev).toBe(node);
  });

  it('en una lista vacía solo acepta la posición 0', () => {
    const list = new DoublyLinkedList<Item>();
    expect(list.insertAt(1, item('x'))).toBeNull();
    expect(list.insertAt(0, item('a'))).not.toBeNull();
    expectOrder(list, ['a']);
  });

  it('rechaza índices inválidos sin modificar la lista', () => {
    const list = listOf('a', 'b');
    expect(list.insertAt(-1, item('x'))).toBeNull();
    expect(list.insertAt(3, item('x'))).toBeNull();
    expect(list.insertAt(1.5, item('x'))).toBeNull();
    expect(list.insertAt(Number.NaN, item('x'))).toBeNull();
    expectOrder(list, ['a', 'b']);
    expect(list.lastOperation?.detail).toContain('Índice inválido');
  });

  it('camina desde tail cuando la posición está en la segunda mitad', () => {
    const list = listOf('a', 'b', 'c', 'd', 'e', 'f');
    list.insertAt(4, item('x'));
    expect(list.lastOperation).toMatchObject({ operation: 'insertAt(4)', steps: 1, from: 'tail', complexity: 'O(n)' });
    list.insertAt(1, item('y'));
    expect(list.lastOperation).toMatchObject({ steps: 1, from: 'head' });
    expectOrder(list, ['a', 'y', 'b', 'c', 'd', 'x', 'e', 'f']);
  });

  it('insertAfterCurrent deja el nodo justo después de la canción actual', () => {
    const list = listOf('a', 'b', 'c');
    list.setCurrentAt(0);
    list.insertAfterCurrent(item('x'));
    expectOrder(list, ['a', 'x', 'b', 'c']);
    list.setCurrentAt(3);
    list.insertAfterCurrent(item('y'));
    expectOrder(list, ['a', 'x', 'b', 'c', 'y']);
    list.clearCurrent();
    list.insertAfterCurrent(item('z'));
    expect(list.tail?.value.id).toBe('z');
  });
});

describe('removeAt y removeById', () => {
  it('elimina al inicio', () => {
    const list = listOf('a', 'b', 'c');
    expect(list.removeAt(0)?.id).toBe('a');
    expectOrder(list, ['b', 'c']);
    expect(list.head?.prev).toBeNull();
  });

  it('elimina en el medio', () => {
    const list = listOf('a', 'b', 'c');
    expect(list.removeAt(1)?.id).toBe('b');
    expectOrder(list, ['a', 'c']);
    expect(list.head?.next).toBe(list.tail);
    expect(list.tail?.prev).toBe(list.head);
  });

  it('elimina al final', () => {
    const list = listOf('a', 'b', 'c');
    expect(list.removeAt(2)?.id).toBe('c');
    expectOrder(list, ['a', 'b']);
    expect(list.tail?.next).toBeNull();
  });

  it('elimina el único elemento y la lista queda vacía', () => {
    const list = listOf('a');
    expect(list.removeAt(0)?.id).toBe('a');
    expect(list.isEmpty()).toBe(true);
    expect(list.head).toBeNull();
    expect(list.tail).toBeNull();
  });

  it('rechaza índices inválidos', () => {
    const list = listOf('a', 'b');
    expect(list.removeAt(-1)).toBeNull();
    expect(list.removeAt(2)).toBeNull();
    expect(list.removeAt(0.5)).toBeNull();
    expectOrder(list, ['a', 'b']);
  });

  it('removeById elimina por identificador', () => {
    const list = listOf('a', 'b', 'c');
    expect(list.removeById('b')?.id).toBe('b');
    expectOrder(list, ['a', 'c']);
    expect(list.removeById('a')?.id).toBe('a');
    expect(list.removeById('c')?.id).toBe('c');
    expect(list.isEmpty()).toBe(true);
  });

  it('removeById con un id que no existe no cambia nada', () => {
    const list = listOf('a', 'b');
    expect(list.removeById('zzz')).toBeNull();
    expectOrder(list, ['a', 'b']);
  });

  it('el nodo eliminado queda suelto, sin punteros a la lista', () => {
    const list = listOf('a', 'b', 'c');
    const middle = list.head?.next;
    list.removeAt(1);
    expect(middle?.prev).toBeNull();
    expect(middle?.next).toBeNull();
  });
});

describe('eliminar la canción que suena', () => {
  it('en el medio: pasa a la siguiente', () => {
    const list = listOf('a', 'b', 'c');
    list.setCurrentAt(1);
    list.removeById('b');
    expect(list.current?.value.id).toBe('c');
    expect(list.isConsistent()).toBe(true);
  });

  it('al inicio: pasa a la siguiente', () => {
    const list = listOf('a', 'b', 'c');
    list.setCurrentAt(0);
    list.removeAt(0);
    expect(list.current?.value.id).toBe('b');
    expect(list.current).toBe(list.head);
  });

  it('si era la última: pasa a la anterior', () => {
    const list = listOf('a', 'b', 'c');
    list.setCurrentAt(2);
    list.removeAt(2);
    expect(list.current?.value.id).toBe('b');
    expect(list.current).toBe(list.tail);
  });

  it('si no queda ninguna: current es null', () => {
    const list = listOf('a');
    list.setCurrentAt(0);
    list.removeById('a');
    expect(list.current).toBeNull();
    expect(list.isConsistent()).toBe(true);
  });

  it('eliminar otra canción no mueve current', () => {
    const list = listOf('a', 'b', 'c');
    list.setCurrentAt(1);
    list.removeAt(0);
    list.removeAt(1);
    expect(list.current?.value.id).toBe('b');
    expectOrder(list, ['b']);
  });
});

describe('next y previous', () => {
  it('next sin canción actual empieza por head', () => {
    const list = listOf('a', 'b');
    expect(list.next()?.id).toBe('a');
    expect(list.current).toBe(list.head);
  });

  it('next avanza por el puntero next', () => {
    const list = listOf('a', 'b', 'c');
    list.setCurrentAt(0);
    expect(list.next()?.id).toBe('b');
    expect(list.next()?.id).toBe('c');
  });

  it('previous retrocede por el puntero prev', () => {
    const list = listOf('a', 'b', 'c');
    list.setCurrentAt(2);
    expect(list.previous()?.id).toBe('b');
    expect(list.previous()?.id).toBe('a');
  });

  it('next en la última con repetir apagado: devuelve null y no se mueve', () => {
    const list = listOf('a', 'b');
    list.setCurrentAt(1);
    expect(list.next('off')).toBeNull();
    expect(list.current?.value.id).toBe('b');
  });

  it('next en la última con repetir todo: vuelve a head', () => {
    const list = listOf('a', 'b');
    list.setCurrentAt(1);
    expect(list.next('all')?.id).toBe('a');
    expect(list.current).toBe(list.head);
  });

  it('previous en la primera con repetir apagado: devuelve null y no se mueve', () => {
    const list = listOf('a', 'b');
    list.setCurrentAt(0);
    expect(list.previous('off')).toBeNull();
    expect(list.current?.value.id).toBe('a');
  });

  it('previous en la primera con repetir todo: salta a tail', () => {
    const list = listOf('a', 'b', 'c');
    list.setCurrentAt(0);
    expect(list.previous('all')?.id).toBe('c');
    expect(list.current).toBe(list.tail);
  });

  it('repetir una: next y previous se quedan en la misma', () => {
    const list = listOf('a', 'b', 'c');
    list.setCurrentAt(1);
    expect(list.next('one')?.id).toBe('b');
    expect(list.previous('one')?.id).toBe('b');
    expect(list.currentIndex()).toBe(1);
  });

  it('con un solo elemento y repetir todo, next y previous dan la misma canción', () => {
    const list = listOf('a');
    list.setCurrentAt(0);
    expect(list.next('all')?.id).toBe('a');
    expect(list.previous('all')?.id).toBe('a');
    expect(list.next('off')).toBeNull();
    expect(list.previous('off')).toBeNull();
  });

  it('setCurrentAt y setCurrentById validan su entrada', () => {
    const list = listOf('a', 'b');
    expect(list.setCurrentAt(5)).toBeNull();
    expect(list.setCurrentById('nope')).toBeNull();
    expect(list.current).toBeNull();
    expect(list.setCurrentById('b')?.id).toBe('b');
    expect(list.currentIndex()).toBe(1);
  });
});

describe('moveUp, moveDown y moveTo', () => {
  it('moveUp intercambia con el anterior', () => {
    const list = listOf('a', 'b', 'c');
    expect(list.moveUp(2)).toBe(true);
    expectOrder(list, ['a', 'c', 'b']);
    expect(list.moveUp(1)).toBe(true);
    expectOrder(list, ['c', 'a', 'b']);
  });

  it('moveDown intercambia con el siguiente', () => {
    const list = listOf('a', 'b', 'c');
    expect(list.moveDown(0)).toBe(true);
    expectOrder(list, ['b', 'a', 'c']);
    expect(list.moveDown(1)).toBe(true);
    expectOrder(list, ['b', 'c', 'a']);
  });

  it('moveUp en la primera y moveDown en la última no hacen nada', () => {
    const list = listOf('a', 'b', 'c');
    expect(list.moveUp(0)).toBe(false);
    expect(list.moveDown(2)).toBe(false);
    expectOrder(list, ['a', 'b', 'c']);
  });

  it('rechazan índices inválidos', () => {
    const list = listOf('a', 'b');
    expect(list.moveUp(-1)).toBe(false);
    expect(list.moveUp(2)).toBe(false);
    expect(list.moveDown(7)).toBe(false);
    expect(list.moveTo(0, 9)).toBe(false);
    expect(list.moveTo(9, 0)).toBe(false);
    expectOrder(list, ['a', 'b']);
  });

  it('con un solo elemento no se puede mover', () => {
    const list = listOf('a');
    expect(list.moveUp(0)).toBe(false);
    expect(list.moveDown(0)).toBe(false);
    expectOrder(list, ['a']);
  });

  it('mueven el mismo nodo: la canción actual lo sigue siendo', () => {
    const list = listOf('a', 'b', 'c');
    list.setCurrentAt(1);
    const node = list.current;
    list.moveUp(1);
    expect(list.current).toBe(node);
    expect(list.currentIndex()).toBe(0);
    list.moveDown(0);
    list.moveDown(1);
    expect(list.current).toBe(node);
    expect(list.currentIndex()).toBe(2);
    expect(list.current).toBe(list.tail);
  });

  it('moveTo lleva un nodo a cualquier posición', () => {
    const list = listOf('a', 'b', 'c', 'd', 'e');
    list.moveTo(0, 4);
    expectOrder(list, ['b', 'c', 'd', 'e', 'a']);
    list.moveTo(4, 0);
    expectOrder(list, ['a', 'b', 'c', 'd', 'e']);
    list.moveTo(1, 3);
    expectOrder(list, ['a', 'c', 'd', 'b', 'e']);
    list.moveTo(3, 1);
    expectOrder(list, ['a', 'b', 'c', 'd', 'e']);
    expect(list.moveTo(2, 2)).toBe(true);
    expectOrder(list, ['a', 'b', 'c', 'd', 'e']);
  });
});

describe('getAt, indexOf, clear y toArray', () => {
  it('getAt devuelve el valor de cada posición', () => {
    const list = listOf('a', 'b', 'c', 'd');
    expect(list.getAt(0)?.id).toBe('a');
    expect(list.getAt(1)?.id).toBe('b');
    expect(list.getAt(2)?.id).toBe('c');
    expect(list.getAt(3)?.id).toBe('d');
    expect(list.getAt(4)).toBeNull();
    expect(list.getAt(-1)).toBeNull();
  });

  it('indexOf devuelve la posición o -1', () => {
    const list = listOf('a', 'b', 'c');
    expect(list.indexOf('a')).toBe(0);
    expect(list.indexOf('c')).toBe(2);
    expect(list.indexOf('z')).toBe(-1);
  });

  it('clear suelta todos los nodos y la canción actual', () => {
    const list = listOf('a', 'b', 'c');
    list.setCurrentAt(1);
    const first = list.head;
    list.clear();
    expect(list.isEmpty()).toBe(true);
    expect(list.current).toBeNull();
    expect(first?.next).toBeNull();
    expect(list.isConsistent()).toBe(true);
  });

  it('el recorrido inverso es el reverso del recorrido normal', () => {
    const list = listOf('a', 'b', 'c', 'd');
    expect(idsReversed(list)).toEqual(['d', 'c', 'b', 'a']);
  });

  it('toArray devuelve una copia: modificarla no afecta a la lista', () => {
    const list = listOf('a', 'b');
    const copy = list.toArray();
    copy.pop();
    copy.reverse();
    expectOrder(list, ['a', 'b']);
  });

  it('acepta una función propia para identificar valores', () => {
    const list = DoublyLinkedList.from([10, 20, 30], (value) => `n${value}`);
    expect(list.indexOf('n20')).toBe(1);
    expect(list.removeById('n20')).toBe(20);
    expect(list.toArray()).toEqual([10, 30]);
  });

  it('walkCost informa pasos y extremo sin modificar la lista', () => {
    const list = listOf('a', 'b', 'c', 'd', 'e', 'f');
    expect(list.walkCost(1)).toEqual({ steps: 1, from: 'head' });
    expect(list.walkCost(4)).toEqual({ steps: 1, from: 'tail' });
    expect(new DoublyLinkedList<Item>().walkCost(0)).toEqual({ steps: 0, from: 'tail' });
  });
});

describe('update y clone', () => {
  it('update cambia el valor sin mover el nodo', () => {
    const list = DoublyLinkedList.from([
      { id: 'a', favorite: false },
      { id: 'b', favorite: false },
    ]);
    const node = list.tail;
    expect(list.update('b', (value) => ({ ...value, favorite: true }))?.favorite).toBe(true);
    expect(list.tail).toBe(node);
    expect(list.getAt(1)?.favorite).toBe(true);
    expect(list.update('zzz', (value) => value)).toBeNull();
    expect(list.isConsistent()).toBe(true);
  });

  it('clone crea nodos nuevos con los mismos valores y la misma canción actual', () => {
    const list = listOf('a', 'b', 'c');
    list.setCurrentAt(1);
    const copy = list.clone();
    expectOrder(copy, ['a', 'b', 'c']);
    expect(copy.current?.value.id).toBe('b');
    expect(copy.head).not.toBe(list.head);
    copy.removeAt(0);
    expectOrder(list, ['a', 'b', 'c']);
    expect(new DoublyLinkedList<Item>().clone().isEmpty()).toBe(true);
  });
});

describe('sort', () => {
  it('ordena reenlazando nodos y conserva la canción actual', () => {
    const list = DoublyLinkedList.from([5, 3, 9, 1, 7], (value) => String(value));
    list.setCurrentById('9');
    const node = list.current;
    list.sort((a, b) => a - b);
    expect(list.toArray()).toEqual([1, 3, 5, 7, 9]);
    expect(list.toArrayReversed()).toEqual([9, 7, 5, 3, 1]);
    expect(list.current).toBe(node);
    expect(list.isConsistent()).toBe(true);
  });

  it('es estable y no falla con listas de 0 o 1 elemento', () => {
    const empty = new DoublyLinkedList<Item>();
    empty.sort(() => 0);
    expect(empty.isEmpty()).toBe(true);
    const pairs = DoublyLinkedList.from(
      [
        { id: 'a', key: 2 },
        { id: 'b', key: 1 },
        { id: 'c', key: 2 },
        { id: 'd', key: 1 },
      ],
    );
    pairs.sort((x, y) => x.key - y.key);
    expect(pairs.toArray().map((value) => value.id)).toEqual(['b', 'd', 'a', 'c']);
    expect(pairs.isConsistent()).toBe(true);
  });
});

describe('informe de operaciones', () => {
  it('addFirst y addLast son O(1)', () => {
    const list = listOf('a');
    list.addFirst(item('b'));
    expect(list.lastOperation).toMatchObject({ operation: 'addFirst()', complexity: 'O(1)', steps: 0 });
    list.addLast(item('c'));
    expect(list.lastOperation).toMatchObject({ operation: 'addLast()', complexity: 'O(1)', steps: 0 });
  });

  it('removeAt nunca da más de n/2 pasos', () => {
    const list = listOf('a', 'b', 'c', 'd', 'e', 'f', 'g', 'h');
    list.removeAt(6);
    expect(list.lastOperation).toMatchObject({ steps: 1, from: 'tail' });
    list.removeAt(2);
    expect(list.lastOperation).toMatchObject({ steps: 2, from: 'head' });
  });
});

describe('resistencia', () => {
  it('con 10.000 nodos sigue siendo consistente tras muchas operaciones', () => {
    const list = new DoublyLinkedList<Item>();
    for (let i = 0; i < 10_000; i++) list.addLast(item(`s${i}`));
    list.setCurrentAt(5_000);
    for (let i = 0; i < 500; i++) {
      list.removeAt((i * 37) % list.size);
      list.insertAt((i * 91) % (list.size + 1), item(`n${i}`));
      list.moveTo((i * 13) % list.size, (i * 53) % list.size);
    }
    expect(list.size).toBe(10_000);
    expect(list.isConsistent()).toBe(true);
    expect(list.toArrayReversed().length).toBe(10_000);
    expect(list.current).not.toBeNull();
  });
});
