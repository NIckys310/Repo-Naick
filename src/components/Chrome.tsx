import { useEffect, useRef, useState, type FormEvent } from 'react';
import { extractYouTubeId } from '../lib/format';
import { usePlayer } from '../player/usePlayer';
import { useUi, type View } from '../ui';
import {
  BackIcon,
  DjIcon,
  GridIcon,
  HomeIcon,
  ListIcon,
  LogoutIcon,
  MoonIcon,
  PlusIcon,
  RedoIcon,
  SearchIcon,
  SettingsIcon,
  ShelfIcon,
  SummaryIcon,
  SunIcon,
  UndoIcon,
  VoiceIcon,
} from './icons';

interface NavItem {
  view: View;
  label: string;
  Icon: typeof HomeIcon;
}

const RAIL_ITEMS: NavItem[] = [
  { view: 'home', label: 'Inicio', Icon: HomeIcon },
  { view: 'search', label: 'Buscar', Icon: SearchIcon },
  { view: 'playlist', label: 'Lista', Icon: ListIcon },
  { view: 'dj', label: 'DJ', Icon: DjIcon },
  { view: 'shelf', label: 'Estante', Icon: ShelfIcon },
  { view: 'summary', label: 'Resumen', Icon: SummaryIcon },
  { view: 'settings', label: 'Ajustes', Icon: SettingsIcon },
];

const DOCK_ITEMS: NavItem[] = [
  { view: 'home', label: 'Inicio', Icon: HomeIcon },
  { view: 'search', label: 'Buscar', Icon: SearchIcon },
  { view: 'playlist', label: 'Lista', Icon: ListIcon },
  { view: 'dj', label: 'DJ', Icon: DjIcon },
  { view: 'more', label: 'Más', Icon: GridIcon },
];

function NavButton({ item, className }: { item: NavItem; className: string }) {
  const ui = useUi();
  const active = ui.view === item.view;
  return (
    <button
      type="button"
      className={className}
      aria-current={active ? 'page' : undefined}
      onClick={() => (item.view === 'playlist' ? ui.openPlaylist() : ui.go(item.view))}
    >
      <span className="nav-pill">
        <item.Icon size={22} weight={active ? 'fill' : 'regular'} aria-hidden="true" />
      </span>
      <span className="nav-label">{item.label}</span>
    </button>
  );
}

/** Riel lateral (escritorio y tablet). */
export function Rail() {
  const ui = useUi();
  const player = usePlayer();
  return (
    <nav className="rail panel" aria-label="Secciones">
      <img className="rail-logo" src={player.theme === 'dark' ? '/brand/logo-oscuro.svg' : '/brand/logo-claro.svg'} alt="rep-Naick" width={48} height={48} />
      <ul className="rail-list">
        {RAIL_ITEMS.map((item) => (
          <li key={item.view}>
            <NavButton item={item} className="rail-item" />
          </li>
        ))}
      </ul>
      <button type="button" className="rail-add" onClick={() => ui.openDialog('add')} aria-label="Agregar canción">
        <PlusIcon size={20} aria-hidden="true" />
      </button>
    </nav>
  );
}

/** Dock flotante (celular). */
export function Dock() {
  return (
    <nav className="dock" aria-label="Secciones">
      {DOCK_ITEMS.map((item) => (
        <NavButton key={item.view} item={item} className="dock-item" />
      ))}
    </nav>
  );
}

/** Barra superior: atrás, deshacer, rehacer, buscador, agregar, perfil y tema. */
export function TopBar() {
  const player = usePlayer();
  const ui = useUi();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const profile = player.profileName ?? '';
  const badge = profile
    .split(' ')
    .map((word) => word[0] ?? '')
    .join('')
    .slice(0, 2)
    .toUpperCase();

  // El menú del perfil se cierra al hacer clic fuera o con Escape.
  useEffect(() => {
    if (!menuOpen) return;
    const close = (event: PointerEvent | KeyboardEvent): void => {
      if (event instanceof KeyboardEvent ? event.key === 'Escape' : !menuRef.current?.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('pointerdown', close);
    document.addEventListener('keydown', close);
    return () => {
      document.removeEventListener('pointerdown', close);
      document.removeEventListener('keydown', close);
    };
  }, [menuOpen]);

  function onSearchChange(value: string): void {
    ui.setQuery(value);
    // Fuera de la lista, escribir lleva a la vista Buscar.
    if (value.trim() !== '' && ui.view !== 'playlist' && ui.view !== 'search') ui.go('search');
  }

  function onSearchSubmit(event: FormEvent): void {
    event.preventDefault();
    const text = ui.query.trim();
    if (text === '') return;
    if (extractYouTubeId(text) !== null && text.length > 11) {
      ui.openDialog('add', { prefill: text });
      ui.setQuery('');
    } else {
      ui.go('search');
      ui.requestSearch();
    }
  }

  return (
    <header className="topbar">
      <div className="topbar-nav">
        <button type="button" className="icon-btn is-outlined" onClick={ui.back} disabled={!ui.canGoBack} aria-label="Volver a la vista anterior">
          <BackIcon size={18} weight="bold" aria-hidden="true" />
        </button>
        <button
          type="button"
          className="icon-btn"
          onClick={() => player.undo()}
          disabled={!player.canUndo}
          aria-label={player.undoLabel ? `Deshacer: ${player.undoLabel}` : 'Deshacer'}
          title={player.undoLabel ? `Deshacer: ${player.undoLabel}` : 'Nada que deshacer'}
        >
          <UndoIcon size={18} aria-hidden="true" />
        </button>
        <button
          type="button"
          className="icon-btn"
          onClick={() => player.redo()}
          disabled={!player.canRedo}
          aria-label={player.redoLabel ? `Rehacer: ${player.redoLabel}` : 'Rehacer'}
          title={player.redoLabel ? `Rehacer: ${player.redoLabel}` : 'Nada que rehacer'}
        >
          <RedoIcon size={18} aria-hidden="true" />
        </button>
      </div>

      <form className="search" role="search" onSubmit={onSearchSubmit}>
        <SearchIcon size={18} aria-hidden="true" className="search-icon" />
        <input
          id="global-search"
          className="search-input"
          type="search"
          value={ui.query}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder="Busca o pega un enlace de YouTube…"
          name="q"
          spellCheck={false}
          aria-label="Buscar canciones o pegar un enlace de YouTube"
          autoComplete="off"
        />
        <button type="button" className="kbd search-kbd" onClick={() => ui.openDialog('commands')} aria-label="Abrir comandos (Ctrl K)">
          Ctrl K
        </button>
        <button type="button" className="search-voice" onClick={() => ui.openDialog('commands', { listen: true })} aria-label="Control por voz">
          <VoiceIcon size={18} weight="bold" aria-hidden="true" />
        </button>
      </form>

      <div className="topbar-actions">
        <button type="button" className="btn btn-primary topbar-add" onClick={() => ui.openDialog('add')}>
          <PlusIcon size={18} weight="bold" aria-hidden="true" />
          <span className="topbar-add-label">Agregar</span>
        </button>
        <div className="profile" ref={menuRef}>
          <button
            type="button"
            className="avatar"
            onClick={() => setMenuOpen((open) => !open)}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            aria-label={`Menú de ${profile}`}
          >
            {badge}
          </button>
          {menuOpen && (
            <div className="menu" role="menu">
              <p className="menu-name truncate">{profile}</p>
              <button type="button" role="menuitem" className="menu-item" onClick={() => { setMenuOpen(false); ui.go('settings'); }}>
                <SettingsIcon size={18} aria-hidden="true" /> Ajustes
              </button>
              <button type="button" role="menuitem" className="menu-item" onClick={() => { setMenuOpen(false); ui.openDialog('shortcuts'); }}>
                <span className="kbd">?</span> Atajos de teclado
              </button>
              <button type="button" role="menuitem" className="menu-item" onClick={() => player.logout()}>
                <LogoutIcon size={18} aria-hidden="true" /> Cerrar sesión
              </button>
            </div>
          )}
        </div>
        <button
          type="button"
          className="icon-btn is-outlined"
          onClick={() => player.setTheme(player.theme === 'dark' ? 'light' : 'dark')}
          aria-label={player.theme === 'dark' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
        >
          {player.theme === 'dark' ? <SunIcon size={18} aria-hidden="true" /> : <MoonIcon size={18} aria-hidden="true" />}
        </button>
      </div>
    </header>
  );
}
