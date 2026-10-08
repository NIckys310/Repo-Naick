import { useState } from 'react';
import { Cover } from '../components/Cover';
import { ExportIcon, PauseIcon, PlayIcon, PlusIcon, ShuffleIcon } from '../components/icons';
import { NodeVisualizer } from '../components/NodeVisualizer';
import { SongTable, type SongRow } from '../components/SongTable';
import { formatTotal, normalize, splitArtists } from '../lib/format';
import { runBenchmark, runSelfTest, type BenchmarkRow, type CheckResult } from '../lib/selfTest';
import { usePlayer } from '../player/usePlayer';
import { useUi, type Collection, type PlaylistTab } from '../ui';

const TABS: { id: PlaylistTab; label: string }[] = [
  { id: 'songs', label: 'Canciones' },
  { id: 'nodes', label: 'Lista doble' },
  { id: 'stacks', label: 'Pilas y cola' },
  { id: 'lab', label: 'Laboratorio' },
];

function describe(collection: Collection): { kind: string; title: string } {
  if (collection.kind === 'favorites') return { kind: 'Colección automática', title: 'Tus favoritas' };
  if (collection.kind === 'genre') return { kind: 'Colección automática por género', title: collection.value };
  if (collection.kind === 'artist') return { kind: 'Colección automática por artista', title: collection.value };
  return { kind: 'Lista de reproducción, doblemente enlazada', title: 'rep-Naick Mix' };
}

function belongs(row: SongRow, collection: Collection): boolean {
  if (collection.kind === 'favorites') return row.song.favorite;
  if (collection.kind === 'genre') return row.song.genre === collection.value;
  if (collection.kind === 'artist') return splitArtists(row.song.artist).includes(collection.value);
  return true;
}

/** Descarga un texto como archivo. */
function download(filename: string, text: string): void {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

/** Pestaña "Pilas y cola": las tres estructuras auxiliares, todas hechas con la lista doble. */
function StacksPanel() {
  const player = usePlayer();
  const queued = player.upNext.toArray();
  const history = player.history.toArray();
  const undo = player.undoLabels();
  const redo = player.redoLabels();
  return (
    <div className="stacks">
      <section className="stack-card">
        <h3 className="stack-title">Cola: a continuación</h3>
        <p className="muted">FIFO: sale primero la que entró primero.</p>
        {queued.length === 0 ? (
          <p className="stack-empty mono">cola vacía</p>
        ) : (
          <ol className="stack-list">
            {queued.map((item, position) => (
              <li key={item.id} className="stack-item" data-edge={position === 0}>
                <span className="truncate">{item.song.title}</span>
                {position === 0 && <span className="stack-edge mono">frente</span>}
              </li>
            ))}
          </ol>
        )}
      </section>
      <section className="stack-card">
        <h3 className="stack-title">Pila: historial</h3>
        <p className="muted">LIFO: el modo aleatorio retrocede sacando el tope.</p>
        {history.length === 0 ? (
          <p className="stack-empty mono">pila vacía</p>
        ) : (
          <ol className="stack-list">
            {history.slice(0, 8).map((song, position) => (
              <li key={`${song.id}-${position}`} className="stack-item" data-edge={position === 0}>
                <span className="truncate">{song.title}</span>
                {position === 0 && <span className="stack-edge mono">tope</span>}
              </li>
            ))}
          </ol>
        )}
      </section>
      <section className="stack-card">
        <h3 className="stack-title">Pilas: deshacer y rehacer</h3>
        <p className="muted">Cada operación guarda su inversa.</p>
        <p className="stack-count mono">
          deshacer {undo.length} · rehacer {redo.length}
        </p>
        {undo.length === 0 && redo.length === 0 ? (
          <p className="stack-empty mono">pilas vacías</p>
        ) : (
          <ol className="stack-list">
            {undo.slice(0, 5).map((label, position) => (
              <li key={`u-${position}-${label}`} className="stack-item" data-edge={position === 0}>
                <span className="truncate">{label}</span>
                {position === 0 && <span className="stack-edge mono">tope</span>}
              </li>
            ))}
            {redo.slice(0, 3).map((label, position) => (
              <li key={`r-${position}-${label}`} className="stack-item is-redo">
                <span className="truncate">{label}</span>
                <span className="stack-edge mono">rehacer</span>
              </li>
            ))}
          </ol>
        )}
        <div className="stack-actions">
          <button type="button" className="btn btn-small" onClick={() => player.undo()} disabled={!player.canUndo}>
            Deshacer
          </button>
          <button type="button" className="btn btn-small" onClick={() => player.redo()} disabled={!player.canRedo}>
            Rehacer
          </button>
        </div>
      </section>
    </div>
  );
}

/** Pestaña "Laboratorio": rendimiento contra un arreglo y pruebas automáticas en el navegador. */
function LabPanel() {
  const [benchmark, setBenchmark] = useState<BenchmarkRow[] | null>(null);
  const [checks, setChecks] = useState<CheckResult[] | null>(null);
  const slowest = benchmark ? Math.max(...benchmark.flatMap((row) => [row.listMs, row.arrayMs]), 0.01) : 1;
  const passed = checks?.filter((check) => check.passed).length ?? 0;
  return (
    <div className="lab">
      <section className="lab-card">
        <h3 className="stack-title">Prueba de rendimiento</h3>
        <p className="muted">Mide en tu navegador la lista doble frente a un arreglo, con 10.000 canciones.</p>
        <button type="button" className="btn btn-primary btn-small" onClick={() => setBenchmark(runBenchmark())}>
          Medir ahora
        </button>
        {benchmark?.map((row) => (
          <div key={row.name} className="bench">
            <p className="bench-name">{row.name}</p>
            <div className="bench-bar is-list" style={{ width: `${Math.max(2, (row.listMs / slowest) * 100)}%` }} />
            <p className="mono bench-value">lista doble {row.listMs.toFixed(2)} ms</p>
            <div className="bench-bar" style={{ width: `${Math.max(2, (row.arrayMs / slowest) * 100)}%` }} />
            <p className="mono bench-value">arreglo {row.arrayMs.toFixed(2)} ms</p>
            <p className="muted">{row.note}</p>
          </div>
        ))}
      </section>
      <section className="lab-card">
        <h3 className="stack-title">Pruebas automáticas</h3>
        <p className="muted">Un resumen de la batería de Vitest, ejecutado aquí mismo.</p>
        <button type="button" className="btn btn-primary btn-small" onClick={() => setChecks(runSelfTest())}>
          Ejecutar pruebas
        </button>
        {checks !== null && (
          <>
            <p className="lab-result mono" role="status">
              {passed} de {checks.length} pasan
            </p>
            <ol className="lab-checks">
              {checks.map((check) => (
                <li key={check.name} data-passed={check.passed}>
                  <span className="lab-mark" aria-hidden="true">
                    {check.passed ? '✓' : '✕'}
                  </span>
                  <span className="sr-only">{check.passed ? 'Pasa:' : 'Falla:'}</span>
                  {check.name}
                </li>
              ))}
            </ol>
          </>
        )}
      </section>
    </div>
  );
}

/** Vista principal: encabezado de la lista, acciones, pestañas y contenido. */
export function PlaylistView() {
  const player = usePlayer();
  const ui = useUi();
  const whole = ui.collection.kind === 'all';
  const { kind, title } = describe(ui.collection);
  const query = normalize(ui.query);

  const allRows: SongRow[] = player.list.toArray().map((song, index) => ({ song, index }));
  const inCollection = allRows.filter((row) => belongs(row, ui.collection));
  const rows = query === '' ? inCollection : inCollection.filter(({ song }) => normalize(`${song.title} ${song.artist} ${song.album}`).includes(query));
  const seconds = inCollection.reduce((sum, row) => sum + row.song.duration, 0);
  const favorites = inCollection.filter((row) => row.song.favorite).length;
  const mosaic = inCollection.slice(0, 4);
  const playingHere = player.isPlaying && inCollection.some((row) => row.song.id === player.nowPlaying?.id);

  function playAll(): void {
    if (playingHere) player.pause();
    else if (player.nowPlaying !== null && inCollection.some((row) => row.song.id === player.nowPlaying?.id)) player.play();
    else if (inCollection[0]) player.playSong(inCollection[0].song.id);
    else player.play();
  }

  return (
    <div className="view playlist">
      <header className="hero">
        <div className="mosaic" data-count={Math.min(4, mosaic.length)} aria-hidden="true">
          {mosaic.map((row) => (
            <Cover key={row.song.id} song={row.song} />
          ))}
        </div>
        <div className="hero-text">
          <p className="hero-kind">{kind}</p>
          <h1 className="display hero-title">{title}</h1>
          <p className="muted">
            {inCollection.length} {inCollection.length === 1 ? 'canción' : 'canciones'}, {formatTotal(seconds)}, {favorites}{' '}
            {favorites === 1 ? 'favorita' : 'favoritas'}
          </p>
          {!whole && (
            <button type="button" className="btn btn-small btn-ghost hero-back" onClick={() => ui.openPlaylist()}>
              Ver la lista completa
            </button>
          )}
        </div>
      </header>

      <div className="actions">
        <button type="button" className="play-big" onClick={playAll} aria-label={playingHere ? 'Pausar' : `Reproducir ${title}`}>
          {playingHere ? <PauseIcon size={24} weight="fill" aria-hidden="true" /> : <PlayIcon size={24} weight="fill" aria-hidden="true" />}
        </button>
        <button
          type="button"
          className={`icon-btn ${player.shuffle ? 'is-on' : ''}`}
          onClick={() => player.toggleShuffle()}
          aria-pressed={player.shuffle}
          aria-label="Aleatorio"
        >
          <ShuffleIcon size={22} aria-hidden="true" />
        </button>
        <button type="button" className="icon-btn" onClick={() => download('rep-naick-lista.json', player.exportJson())} aria-label="Exportar la lista a JSON">
          <ExportIcon size={22} aria-hidden="true" />
        </button>
        {whole && (
          <div className="tabs actions-tabs" role="tablist" aria-label="Secciones de la lista">
            {TABS.map((tab) => (
              <button key={tab.id} type="button" role="tab" className="tab" aria-selected={ui.tab === tab.id} onClick={() => ui.setTab(tab.id)}>
                {tab.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {(!whole || ui.tab === 'songs') && (
        <>
          <SongTable rows={rows} reorderable={whole && query === ''} />
          {player.list.isEmpty() && (
            <div className="empty">
              <h2 className="display empty-title">La lista está vacía</h2>
              <p className="muted">head, tail y current apuntan a null. Agrega una canción o vuelve a las iniciales.</p>
              <div className="empty-actions">
                <button type="button" className="btn btn-primary" onClick={() => ui.openDialog('add')}>
                  <PlusIcon size={18} weight="bold" aria-hidden="true" /> Agregar canción
                </button>
                <button type="button" className="btn btn-ghost" onClick={() => player.restoreSeed()}>
                  Restaurar canciones iniciales
                </button>
              </div>
            </div>
          )}
          {!player.list.isEmpty() && rows.length === 0 && (
            <div className="empty">
              <h2 className="display empty-title">{query !== '' ? 'Sin coincidencias' : 'Esta colección está vacía'}</h2>
              <p className="muted">
                {query !== '' ? `Ninguna canción de la lista coincide con "${ui.query.trim()}".` : 'Marca canciones como favoritas para verlas aquí.'}
              </p>
              {query !== '' && (
                <div className="empty-actions">
                  <button type="button" className="btn btn-primary" onClick={() => ui.go('search')}>
                    Buscar en YouTube
                  </button>
                  <button type="button" className="btn btn-ghost" onClick={() => ui.setQuery('')}>
                    Limpiar búsqueda
                  </button>
                </div>
              )}
            </div>
          )}
        </>
      )}
      {whole && ui.tab === 'nodes' && <NodeVisualizer />}
      {whole && ui.tab === 'stacks' && <StacksPanel />}
      {whole && ui.tab === 'lab' && <LabPanel />}
    </div>
  );
}
