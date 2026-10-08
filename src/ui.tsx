import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';
import { Stack } from './lib/Stack';

export type View = 'home' | 'search' | 'dj' | 'shelf' | 'playlist' | 'summary' | 'settings' | 'more';
export type PlaylistTab = 'songs' | 'nodes' | 'stacks' | 'lab';
export type TurntableTab = 'deck' | 'queue';
export type DialogName = 'add' | 'commands' | 'sleep' | 'shortcuts';

/** Qué canciones muestra la vista de lista: todas o una colección calculada. */
export type Collection =
  | { kind: 'all' }
  | { kind: 'favorites' }
  | { kind: 'genre'; value: string }
  | { kind: 'artist'; value: string };

interface DialogState {
  name: DialogName;
  /** Enlace o texto con el que se abre "Agregar canción". */
  prefill: string;
  /** Si "Comandos" debe empezar escuchando por el micrófono. */
  listen: boolean;
}

interface Ui {
  view: View;
  tab: PlaylistTab;
  collection: Collection;
  query: string;
  dialog: DialogState | null;
  turntableOpen: boolean;
  turntableTab: TurntableTab;
  miniOpen: boolean;
  canGoBack: boolean;
  /** Cambia cada vez que se pide buscar en YouTube (al enviar el buscador). */
  searchRequest: number;
  requestSearch(): void;
  go(view: View): void;
  back(): void;
  openPlaylist(collection?: Collection, tab?: PlaylistTab): void;
  setTab(tab: PlaylistTab): void;
  setQuery(query: string): void;
  openDialog(name: DialogName, options?: { prefill?: string; listen?: boolean }): void;
  closeDialog(): void;
  setTurntableOpen(open: boolean): void;
  setTurntableTab(tab: TurntableTab): void;
  toggleMini(): void;
}

const UiContext = createContext<Ui | null>(null);

/** Estado de navegación de la interfaz (qué vista, qué pestaña, qué diálogo). */
export function UiProvider({ children }: { children: ReactNode }) {
  const [view, setView] = useState<View>('playlist');
  const [tab, setTab] = useState<PlaylistTab>('songs');
  const [collection, setCollection] = useState<Collection>({ kind: 'all' });
  const [query, setQuery] = useState('');
  const [dialog, setDialog] = useState<DialogState | null>(null);
  const [turntableOpen, setTurntableOpen] = useState(false);
  const [turntableTab, setTurntableTab] = useState<TurntableTab>('deck');
  const [miniOpen, setMiniOpen] = useState(false);
  const [historySize, setHistorySize] = useState(0);
  const [searchRequest, setSearchRequest] = useState(0);
  // El botón "atrás" usa una pila (LIFO) de vistas visitadas, hecha con la lista doble.
  const visited = useRef(new Stack<View>(20));

  const go = useCallback((next: View) => {
    setView((current) => {
      if (current !== next) {
        visited.current.push(current);
        setHistorySize(visited.current.size);
      }
      return next;
    });
    setTurntableOpen(false);
  }, []);

  const back = useCallback(() => {
    const previous = visited.current.pop();
    setHistorySize(visited.current.size);
    if (previous !== null) setView(previous);
  }, []);

  const openPlaylist = useCallback(
    (nextCollection: Collection = { kind: 'all' }, nextTab: PlaylistTab = 'songs') => {
      setCollection(nextCollection);
      setTab(nextTab);
      go('playlist');
    },
    [go],
  );

  const openDialog = useCallback((name: DialogName, options: { prefill?: string; listen?: boolean } = {}) => {
    setDialog({ name, prefill: options.prefill ?? '', listen: options.listen ?? false });
  }, []);

  const closeDialog = useCallback(() => setDialog(null), []);
  const toggleMini = useCallback(() => setMiniOpen((open) => !open), []);
  const requestSearch = useCallback(() => setSearchRequest((count) => count + 1), []);

  const value = useMemo<Ui>(
    () => ({
      view,
      tab,
      collection,
      query,
      dialog,
      turntableOpen,
      turntableTab,
      miniOpen,
      canGoBack: historySize > 0,
      searchRequest,
      requestSearch,
      go,
      back,
      openPlaylist,
      setTab,
      setQuery,
      openDialog,
      closeDialog,
      setTurntableOpen,
      setTurntableTab,
      toggleMini,
    }),
    [view, tab, collection, query, dialog, turntableOpen, turntableTab, miniOpen, historySize, searchRequest, requestSearch, go, back, openPlaylist, openDialog, closeDialog, toggleMini],
  );

  return <UiContext.Provider value={value}>{children}</UiContext.Provider>;
}

export function useUi(): Ui {
  const ui = useContext(UiContext);
  if (ui === null) throw new Error('useUi debe usarse dentro de UiProvider');
  return ui;
}
