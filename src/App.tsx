import { useEffect } from 'react';
import { AddSongDialog } from './components/AddSongDialog';
import { Dock, Rail, TopBar } from './components/Chrome';
import { CommandDialog, ShortcutsDialog, SleepDialog } from './components/Dialogs';
import { CloseIcon } from './components/icons';
import { FloatingDisc, MiniPlayer, Turntable } from './components/Turntable';
import { store, usePlayer } from './player/usePlayer';
import { UiProvider, useUi } from './ui';
import { Access } from './views/Access';
import { DjView } from './views/DjView';
import { HomeView } from './views/HomeView';
import { ShelfView, SummaryView } from './views/LibraryViews';
import { PlaylistView } from './views/PlaylistView';
import { SearchView } from './views/SearchView';
import { MoreView, SettingsView } from './views/SettingsViews';

/** Avisos temporales. Cada uno desaparece solo a los 4 segundos. */
function Toasts() {
  const player = usePlayer();
  const toasts = player.toasts.toArray();
  const newest = toasts.at(-1)?.id;

  useEffect(() => {
    if (newest === undefined) return;
    const timer = setTimeout(() => {
      // Sale el aviso más antiguo: la cola de avisos es FIFO.
      const oldest = store.toasts.peek();
      if (oldest !== null) store.dismissToast(oldest.id);
    }, 4000);
    return () => clearTimeout(timer);
  }, [newest, toasts.length]);

  return (
    <div className="toasts" role="status" aria-live="polite">
      {toasts.map((toast) => (
        <div key={toast.id} className="toast">
          <span>{toast.message}</span>
          {toast.undoable && player.canUndo && (
            <button
              type="button"
              className="toast-action"
              onClick={() => {
                player.dismissToast(toast.id);
                player.undo();
              }}
            >
              Deshacer
            </button>
          )}
          <button type="button" className="toast-close" onClick={() => player.dismissToast(toast.id)} aria-label="Cerrar aviso">
            <CloseIcon size={14} weight="bold" aria-hidden="true" />
          </button>
        </div>
      ))}
    </div>
  );
}

/** true si el foco está en algo donde se escribe o que ya reacciona a esa tecla. */
function isTyping(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName);
}

/** Estructura con sesión iniciada: riel, vista central, tornamesa y capas flotantes. */
function Shell() {
  const ui = useUi();

  // Atajos de teclado globales.
  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      const key = event.key.toLowerCase();
      if ((event.ctrlKey || event.metaKey) && key === 'k') {
        event.preventDefault();
        ui.openDialog('commands');
        return;
      }
      if (isTyping(event.target) || document.querySelector('dialog[open]') !== null) return;
      if ((event.ctrlKey || event.metaKey) && key === 'z') {
        event.preventDefault();
        if (event.shiftKey) store.redo();
        else store.undo();
        return;
      }
      if ((event.ctrlKey || event.metaKey) && key === 'y') {
        event.preventDefault();
        store.redo();
        return;
      }
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      const onButton = event.target instanceof HTMLElement && event.target.closest('button, a, [role="tab"]') !== null;
      if (event.key === ' ' && !onButton) {
        event.preventDefault();
        store.togglePlay();
      } else if (event.key === 'ArrowRight') {
        event.preventDefault();
        store.next();
      } else if (event.key === 'ArrowLeft') {
        event.preventDefault();
        store.previous();
      } else if (key === 'l') {
        const song = store.list.current?.value;
        if (song) store.toggleFavorite(song.id);
      } else if (key === 'm') {
        store.toggleMute();
      } else if (event.key === '/') {
        event.preventDefault();
        document.getElementById('global-search')?.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [ui]);

  return (
    <div className="shell">
      <a className="skip-link" href="#main">
        Saltar al contenido
      </a>
      <Rail />
      <main className="main panel" id="main">
        <TopBar />
        <div className="main-scroll" key={ui.view}>
          {ui.view === 'home' && <HomeView />}
          {ui.view === 'search' && <SearchView />}
          {ui.view === 'playlist' && <PlaylistView />}
          {ui.view === 'dj' && <DjView />}
          {ui.view === 'shelf' && <ShelfView />}
          {ui.view === 'summary' && <SummaryView />}
          {ui.view === 'settings' && <SettingsView />}
          {ui.view === 'more' && <MoreView />}
        </div>
      </main>
      <Turntable />
      <Dock />
      <FloatingDisc />
      <MiniPlayer />

      {ui.dialog?.name === 'add' && <AddSongDialog prefill={ui.dialog.prefill} onClose={ui.closeDialog} />}
      {ui.dialog?.name === 'commands' && <CommandDialog listen={ui.dialog.listen} onClose={ui.closeDialog} />}
      {ui.dialog?.name === 'sleep' && <SleepDialog onClose={ui.closeDialog} />}
      {ui.dialog?.name === 'shortcuts' && <ShortcutsDialog onClose={ui.closeDialog} />}
    </div>
  );
}

export function App() {
  const player = usePlayer();

  // El tema se aplica al documento completo y a la barra del navegador en el celular.
  useEffect(() => {
    document.documentElement.dataset.theme = player.theme;
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', player.theme === 'dark' ? '#000000' : '#e9e9e9');
  }, [player.theme]);

  return (
    <>
      {player.profileName === null ? (
        <Access />
      ) : (
        <UiProvider>
          <Shell />
        </UiProvider>
      )}
      <Toasts />
    </>
  );
}
