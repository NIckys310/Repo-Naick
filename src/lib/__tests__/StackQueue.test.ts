import { describe, expect, it } from 'vitest';
import { Queue } from '../Queue';
import { Stack } from '../Stack';

describe('Stack (pila LIFO)', () => {
  it('saca primero lo último que entró', () => {
    const stack = new Stack<number>();
    stack.push(1);
    stack.push(2);
    stack.push(3);
    expect(stack.peek()).toBe(3);
    expect(stack.pop()).toBe(3);
    expect(stack.pop()).toBe(2);
    expect(stack.size).toBe(1);
    expect(stack.toArray()).toEqual([1]);
  });

  it('vacía devuelve null', () => {
    const stack = new Stack<number>();
    expect(stack.isEmpty()).toBe(true);
    expect(stack.pop()).toBeNull();
    expect(stack.peek()).toBeNull();
  });

  it('con límite descarta el elemento más viejo', () => {
    const stack = new Stack<number>(2);
    stack.push(1);
    stack.push(2);
    stack.push(3);
    expect(stack.toArray()).toEqual([3, 2]);
    stack.clear();
    expect(stack.isEmpty()).toBe(true);
  });
});

describe('Queue (cola FIFO)', () => {
  it('saca primero lo primero que entró', () => {
    const queue = new Queue<string>();
    queue.enqueue('a');
    queue.enqueue('b');
    queue.enqueue('c');
    expect(queue.peek()).toBe('a');
    expect(queue.dequeue()).toBe('a');
    expect(queue.toArray()).toEqual(['b', 'c']);
    expect(queue.size).toBe(2);
  });

  it('vacía devuelve null', () => {
    const queue = new Queue<string>();
    expect(queue.isEmpty()).toBe(true);
    expect(queue.dequeue()).toBeNull();
    expect(queue.peek()).toBeNull();
  });

  it('permite quitar un elemento concreto y respeta el límite', () => {
    const queue = new Queue<string>(3);
    queue.enqueue('a');
    queue.enqueue('b');
    queue.enqueue('c');
    queue.enqueue('d');
    expect(queue.toArray()).toEqual(['b', 'c', 'd']);
    expect(queue.removeById('c')).toBe('c');
    expect(queue.removeById('zzz')).toBeNull();
    expect(queue.toArray()).toEqual(['b', 'd']);
    queue.clear();
    expect(queue.isEmpty()).toBe(true);
  });
});
