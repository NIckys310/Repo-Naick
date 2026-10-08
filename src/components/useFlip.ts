import { useLayoutEffect, useRef, type RefObject } from 'react';

/**
 * Animación FLIP: cuando cambia el orden, cada elemento marcado con `data-flip="id"` se
 * desliza desde donde estaba hasta su lugar nuevo. Así se VE el nodo viajando al moverlo,
 * insertarlo o eliminar a su vecino. Solo anima `transform` (240 ms, curva ease-out propia).
 */
export function useFlip(container: RefObject<HTMLElement | null>, signature: string): void {
  const positions = useRef(new Map<string, { left: number; top: number }>());

  useLayoutEffect(() => {
    const root = container.current;
    if (root === null) return;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const next = new Map<string, { left: number; top: number }>();
    root.querySelectorAll<HTMLElement>('[data-flip]').forEach((element) => {
      const key = element.dataset.flip ?? '';
      // offsetLeft/offsetTop no cambian al hacer scroll, a diferencia de getBoundingClientRect.
      const position = { left: element.offsetLeft, top: element.offsetTop };
      next.set(key, position);
      const previous = positions.current.get(key);
      if (previous === undefined || reduced) return;
      const dx = previous.left - position.left;
      const dy = previous.top - position.top;
      if (dx === 0 && dy === 0) return;
      element.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'translate(0, 0)' }], {
        duration: 240,
        easing: 'cubic-bezier(0.23, 1, 0.32, 1)',
      });
    });
    positions.current = next;
  }, [container, signature]);
}
