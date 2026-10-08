import { useEffect, useRef, useState } from 'react';
import { ShortcutList } from '../components/Dialogs';
import {
  CommandIcon,
  HeartIcon,
  LabIcon,
  LogoutIcon,
  NodesIcon,
  SettingsIcon,
  ShelfIcon,
  StackIcon,
  SummaryIcon,
  TimerIcon,
  VoiceIcon,
} from '../components/icons';
import { usePlayer } from '../player/usePlayer';
import { fetchHealth } from '../player/youtubeApi';
import { useUi } from '../ui';

type KeyStatus = 'checking' | 'ready' | 'missing' | 'offline';

const KEY_MESSAGES: Record<KeyStatus, string> = {
  checking: 'Comprobando el servidor…',
  ready: 'Clave configurada: puedes buscar canciones por nombre.',
  missing: 'Falta la clave YOUTUBE_API_KEY en el servidor. Por ahora agrega canciones pegando el enlace.',
  offline: 'No se pudo contactar al servidor.',
};

/** Ajustes: perfil, apariencia, datos de la lista, estado de YouTube y atajos. */
export function SettingsView() {
  const player = usePlayer();
  const [keyStatus, setKeyStatus] = useState<KeyStatus>('checking');
  const [importNotice, setImportNotice] = useState('');
  const [confirmClear, setConfirmClear] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let alive = true;
    void fetchHealth().then((response) => {
      if (!alive) return;
      setKeyStatus(!response.ok ? 'offline' : response.data.youtubeKey ? 'ready' : 'missing');
    });
    return () => {
      alive = false;
    };
  }, []);

  async function onImport(file: File | undefined): Promise<void> {
    if (!file) return;
    const result = player.importJson(await file.text());
    setImportNotice(result.message);
    if (fileInput.current) fileInput.current.value = '';
  }

  function exportList(): void {
    const url = URL.createObjectURL(new Blob([player.exportJson()], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'rep-naick-lista.json';
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="view settings">
      <h1 className="display view-title">Ajustes</h1>

      <section className="settings-group">
        <h2 className="section-title">Perfil</h2>
        <div className="setting">
          <div>
            <p className="setting-name">{player.profileName}</p>
            <p className="muted">Perfil local: vive solo en este navegador, sin contraseña.</p>
          </div>
          <button type="button" className="btn btn-ghost" onClick={() => player.logout()}>
            Cerrar sesión
          </button>
        </div>
      </section>

      <section className="settings-group">
        <h2 className="section-title">Apariencia</h2>
        <div className="setting">
          <div>
            <p className="setting-name">Modo claro</p>
            <p className="muted">La app recuerda tu elección.</p>
          </div>
          <label className="switch">
            <input type="checkbox" checked={player.theme === 'light'} onChange={(event) => player.setTheme(event.target.checked ? 'light' : 'dark')} />
            <span className="switch-track" aria-hidden="true" />
            <span className="sr-only">Modo claro</span>
          </label>
        </div>
      </section>

      <section className="settings-group">
        <h2 className="section-title">Tus datos</h2>
        <div className="setting">
          <div>
            <p className="setting-name">Canciones iniciales</p>
            <p className="muted">Vuelve a las 12 canciones con las que empieza la lista. Se puede deshacer.</p>
          </div>
          <button type="button" className="btn" onClick={() => player.restoreSeed()}>
            Restaurar
          </button>
        </div>
        <div className="setting">
          <div>
            <p className="setting-name">Exportar e importar</p>
            <p className="muted">Guarda la lista en un archivo JSON o carga una guardada.</p>
            <p className="field-hint" role="status">
              {importNotice}
            </p>
          </div>
          <div className="setting-actions">
            <button type="button" className="btn" onClick={exportList}>
              Exportar
            </button>
            <button type="button" className="btn" onClick={() => fileInput.current?.click()}>
              Importar
            </button>
            <input ref={fileInput} type="file" accept="application/json,.json" className="sr-only" tabIndex={-1} aria-label="Archivo JSON para importar" onChange={(event) => void onImport(event.target.files?.[0])} />
          </div>
        </div>
        <div className="setting">
          <div>
            <p className="setting-name">Vaciar la lista</p>
            <p className="muted">Elimina todos los nodos. Se puede deshacer.</p>
          </div>
          {confirmClear ? (
            <div className="setting-actions">
              <button type="button" className="btn btn-primary" onClick={() => { player.clearList(); setConfirmClear(false); }}>
                Sí, vaciar
              </button>
              <button type="button" className="btn btn-ghost" onClick={() => setConfirmClear(false)}>
                Cancelar
              </button>
            </div>
          ) : (
            <button type="button" className="btn" onClick={() => setConfirmClear(true)} disabled={player.list.isEmpty()}>
              Vaciar
            </button>
          )}
        </div>
      </section>

      <section className="settings-group">
        <h2 className="section-title">YouTube</h2>
        <div className="setting">
          <div>
            <p className="setting-name">Búsqueda por nombre</p>
            <p className="muted" role="status">
              {KEY_MESSAGES[keyStatus]}
            </p>
          </div>
          <span className={keyStatus === 'ready' ? 'tag tag-red' : 'tag'}>{keyStatus === 'ready' ? 'Activa' : keyStatus === 'checking' ? 'Comprobando' : 'Inactiva'}</span>
        </div>
      </section>

      <section className="settings-group">
        <h2 className="section-title">Atajos de teclado</h2>
        <ShortcutList />
      </section>
    </div>
  );
}

/** Más (celular): reúne lo que en escritorio está en el riel y en los pads. */
export function MoreView() {
  const player = usePlayer();
  const ui = useUi();
  const items = [
    { label: 'Estante', Icon: ShelfIcon, run: () => ui.go('shelf') },
    { label: 'Lista doble', Icon: NodesIcon, run: () => ui.openPlaylist({ kind: 'all' }, 'nodes') },
    { label: 'Pilas y cola', Icon: StackIcon, run: () => ui.openPlaylist({ kind: 'all' }, 'stacks') },
    { label: 'Laboratorio', Icon: LabIcon, run: () => ui.openPlaylist({ kind: 'all' }, 'lab') },
    { label: 'Favoritas', Icon: HeartIcon, run: () => ui.openPlaylist({ kind: 'favorites' }) },
    { label: 'Resumen', Icon: SummaryIcon, run: () => ui.go('summary') },
    { label: 'Comandos', Icon: CommandIcon, run: () => ui.openDialog('commands') },
    { label: 'Voz', Icon: VoiceIcon, run: () => ui.openDialog('commands', { listen: true }) },
    { label: 'Temporizador', Icon: TimerIcon, run: () => ui.openDialog('sleep') },
    { label: 'Ajustes', Icon: SettingsIcon, run: () => ui.go('settings') },
    { label: 'Cerrar sesión', Icon: LogoutIcon, run: () => player.logout() },
  ];
  return (
    <div className="view">
      <h1 className="display view-title">Más</h1>
      <ul className="more-grid">
        {items.map((item) => (
          <li key={item.label}>
            <button type="button" className="more-card" onClick={item.run}>
              <item.Icon size={24} aria-hidden="true" />
              {item.label}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
