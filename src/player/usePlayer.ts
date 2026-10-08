import { useSyncExternalStore } from 'react';
import { PlayerStore } from './store';

/** localStorage puede estar bloqueado (modo privado): en ese caso la app funciona sin guardar. */
function safeStorage(): Storage | null {
  try {
    const probe = 'rep-naick:probe';
    window.localStorage.setItem(probe, '1');
    window.localStorage.removeItem(probe);
    return window.localStorage;
  } catch {
    return null;
  }
}

/** Único reproductor de la app. Vive fuera de React para que la música no dependa de los repintados. */
export const store = new PlayerStore({
  storage: safeStorage(),
  prefersLight: window.matchMedia('(prefers-color-scheme: light)').matches,
});

/** Suscribe el componente a los cambios del reproductor y lo devuelve para leerlo. */
export function usePlayer(): PlayerStore {
  useSyncExternalStore(store.subscribe, store.getVersion);
  return store;
}

/** Segundos transcurridos. Canal aparte: solo repinta la barra de progreso y el vinilo. */
export function useProgress(): number {
  return useSyncExternalStore(store.subscribeProgress, store.getPosition);
}
