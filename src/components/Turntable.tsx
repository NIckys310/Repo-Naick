import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { formatTime, memoryAddress } from '../lib/format';
import { HybridEngine } from '../player/engine';
import { store, usePlayer, useProgress } from '../player/usePlayer';
import type { Song } from '../player/types';
import { useUi } from '../ui';
import { Cover } from './Cover';
import {
  BpmIcon,
  CloseIcon,
  CollapseIcon,
  CommandIcon,
  DjIcon,
  HeartIcon,
  MiniIcon,
  MutedIcon,
  NextIcon,
  NodesIcon,
  PauseIcon,
  PlayIcon,
  PreviousIcon,
  QueueIcon,
  RepeatIcon,
  RepeatOneIcon,
  ShuffleIcon,
  TimerIcon,
  VoiceIcon,
  VolumeIcon,
} from './icons';

const RING = 2 * Math.PI * 47;

/** Fracción de la canción que ya sonó, entre 0 y 1. */
function useFraction(): number {
  const position = useProgress();
  const duration = store.duration;
  return duration > 0 ? Math.min(1, position / duration) : 0;
}

/** Tarjeta de un nodo vecino: el anterior (prev) arriba y el siguiente (next) abajo. */
function NeighborCard({ song, direction, onClick }: { song: Song | null; direction: 'prev' | 'next'; onClick: () => void }) {
  const arrow = direction === 'prev' ? '↑ anterior' : '↓ siguiente';
  if (song === null) {
    return (
      <div className="neighbor is-empty">
        <span className="neighbor-pointer mono">
          {arrow} <b>null</b>
        </span>
        <span className="neighbor-title muted">{direction === 'prev' ? 'No hay nodo anterior' : 'No hay nodo siguiente'}</span>
      </div>
    );
  }
  return (
    <button type="button" className="neighbor" onClick={onClick} aria-label={`${direction === 'prev' ? 'Retroceder a' : 'Adelantar a'} ${song.title}`}>
      <Cover song={song} className="neighbor-cover" />
      <span className="neighbor-text">
        <span className="neighbor-pointer mono">
          {arrow} <b>{memoryAddress(song.id)}</b>
        </span>
        <span className="neighbor-title truncate">{song.title}</span>
      </span>
    </button>
  );
}

/** Disco que gira mientras suena, con anillo de progreso y brazo que avanza hacia el centro. */
function Vinyl({ song, playing }: { song: Song | null; playing: boolean }) {
  const fraction = useFraction();
  // En reposo el brazo queda fuera del disco; al sonar se apoya y avanza con la canción.
  const armAngle = song !== null && (playing || fraction > 0) ? 16 + fraction * 20 : 0;
  return (
    <div className="vinyl-stage">
      <svg className="vinyl-ring" viewBox="0 0 100 100" aria-hidden="true">
        <circle className="vinyl-ring-track" cx="50" cy="50" r="47" />
        <circle className="vinyl-ring-fill" cx="50" cy="50" r="47" strokeDasharray={RING} strokeDashoffset={RING * (1 - fraction)} />
      </svg>
      <div className="vinyl" data-playing={playing}>
        <div className="vinyl-label">{song !== null ? <Cover song={song} /> : <img src="/brand/logo-sobre-rojo.svg" alt="" width={64} height={64} />}</div>
      </div>
      <div className="tonearm" style={{ transform: `rotate(${armAngle}deg)` }} aria-hidden="true">
        <span className="tonearm-head" />
      </div>
    </div>
  );
}

/** Barra de tiempo: se puede arrastrar o mover con las flechas para saltar. */
function ProgressBar({ disabled }: { disabled: boolean }) {
  const position = useProgress();
  const duration = store.duration;
  const fraction = duration > 0 ? Math.min(1, position / duration) : 0;
  return (
    <div className="progress">
      <span className="mono progress-time">{formatTime(position)}</span>
      <input
        className="slider"
        type="range"
        min={0}
        max={Math.max(1, Math.floor(duration))}
        step={1}
        value={Math.floor(position)}
        disabled={disabled}
        onChange={(event) => store.seek(Number(event.target.value))}
        style={{ '--fill': `${fraction * 100}%` } as CSSProperties}
        aria-label="Posición de la canción"
        aria-valuetext={`${formatTime(position)} de ${formatTime(duration)}`}
      />
      <span className="mono progress-time">{duration > 0 ? formatTime(duration) : '--:--'}</span>
    </div>
  );
}

/** Controles: aleatorio, anterior, play o pausa, siguiente y repetir. */
export function Transport({ compact = false }: { compact?: boolean }) {
  const player = usePlayer();
  const repeatLabels = { off: 'Repetir: apagado', all: 'Repetir: toda la lista', one: 'Repetir: una canción' } as const;
  return (
    <div className={`transport ${compact ? 'is-compact' : ''}`}>
      {!compact && (
        <button
          type="button"
          className={`icon-btn ${player.shuffle ? 'is-on' : ''}`}
          onClick={() => player.toggleShuffle()}
          aria-pressed={player.shuffle}
          aria-label="Aleatorio"
        >
          <ShuffleIcon size={20} aria-hidden="true" />
        </button>
      )}
      <button type="button" className="transport-step" onClick={() => player.previous()} aria-label="Canción anterior">
        <PreviousIcon size={20} weight="fill" aria-hidden="true" />
      </button>
      <button type="button" className="transport-play" onClick={() => player.togglePlay()} aria-label={player.isPlaying ? 'Pausar' : 'Reproducir'}>
        {player.isPlaying ? <PauseIcon size={compact ? 20 : 28} weight="fill" aria-hidden="true" /> : <PlayIcon size={compact ? 20 : 28} weight="fill" aria-hidden="true" />}
      </button>
      <button type="button" className="transport-step" onClick={() => player.next()} aria-label="Canción siguiente">
        <NextIcon size={20} weight="fill" aria-hidden="true" />
      </button>
      {!compact && (
        <button
          type="button"
          className={`icon-btn ${player.repeat !== 'off' ? 'is-on' : ''}`}
          onClick={() => player.cycleRepeat()}
          aria-label={repeatLabels[player.repeat]}
          title={repeatLabels[player.repeat]}
        >
          {player.repeat === 'one' ? <RepeatOneIcon size={20} aria-hidden="true" /> : <RepeatIcon size={20} aria-hidden="true" />}
        </button>
      )}
    </div>
  );
}

/** Cuenta regresiva del temporizador de apagado. */
function SleepBadge() {
  const player = usePlayer();
  const [, setTick] = useState(0);
  const sleep = player.sleep;
  useEffect(() => {
    if (sleep?.mode !== 'time') return;
    const timer = setInterval(() => setTick((tick) => tick + 1), 1000);
    return () => clearInterval(timer);
  }, [sleep]);
  if (sleep === null) return null;
  const text = sleep.mode === 'song' ? 'Se detiene al terminar la canción' : `Se detiene en ${formatTime(Math.max(0, (sleep.endsAt - Date.now()) / 1000))}`;
  return (
    <p className="sleep-badge">
      <TimerIcon size={16} aria-hidden="true" />
      <span className="mono">{text}</span>
      <button type="button" className="btn btn-small btn-ghost" onClick={() => player.setSleep(null)}>
        Cancelar
      </button>
    </p>
  );
}

/** Pestaña Cola: lo que suena, la cola FIFO y lo que viene siguiendo los punteros next. */
function QueuePanel() {
  const player = usePlayer();
  const now = player.nowPlaying;
  const queued = player.upNext.toArray();
  const all = player.list.toArray();
  const start = player.list.currentIndex() + 1;
  const upcoming = all.slice(start, start + 8);
  return (
    <div className="queue-panel">
      <h3 className="queue-heading">Sonando</h3>
      {now !== null ? (
        <div className="queue-item is-now">
          <Cover song={now} className="queue-cover" />
          <span className="queue-text">
            <span className="truncate queue-title">{now.title}</span>
            <span className="truncate muted">{now.artist}</span>
          </span>
        </div>
      ) : (
        <p className="muted">Nada suena todavía.</p>
      )}

      <h3 className="queue-heading">
        A continuación <span className="mono muted">cola FIFO · {queued.length}</span>
      </h3>
      {queued.length === 0 ? (
        <p className="muted">Usa el botón de encolar de una canción para que suene primero.</p>
      ) : (
        <ol className="queue-list">
          {queued.map((item, position) => (
            <li key={item.id} className="queue-item is-queued">
              <Cover song={item.song} className="queue-cover" />
              <span className="queue-text">
                <span className="truncate queue-title">{item.song.title}</span>
                <span className="truncate muted">{position === 0 ? 'frente de la cola' : item.song.artist}</span>
              </span>
              <button type="button" className="icon-btn is-small" onClick={() => player.removeFromQueue(item.id)} aria-label={`Quitar ${item.song.title} de la cola`}>
                <CloseIcon size={16} aria-hidden="true" />
              </button>
            </li>
          ))}
        </ol>
      )}

      <h3 className="queue-heading">
        Después <span className="mono muted">siguiendo next</span>
      </h3>
      {upcoming.length === 0 ? (
        <p className="muted">{player.repeat === 'off' ? 'No hay más nodos después del actual.' : 'Al terminar vuelve a head (lista circular).'}</p>
      ) : (
        <ol className="queue-list">
          {upcoming.map((song) => (
            <li key={song.id}>
              <button type="button" className="queue-item" onClick={() => player.playSong(song.id)} aria-label={`Reproducir ${song.title}`}>
                <Cover song={song} className="queue-cover" />
                <span className="queue-text">
                  <span className="truncate queue-title">{song.title}</span>
                  <span className="truncate muted">{song.artist}</span>
                </span>
                <span className="mono muted">{formatTime(song.duration)}</span>
              </button>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

/** La tornamesa: reproductor y lista doble hecha objeto (anterior, actual y siguiente). */
export function Turntable() {
  const player = usePlayer();
  const ui = useUi();
  const hostRef = useRef<HTMLDivElement>(null);
  const asideRef = useRef<HTMLElement>(null);
  const song = player.nowPlaying;
  const node = player.queuedSong === null ? player.list.current : null;
  const previous = node?.prev?.value ?? (player.repeat !== 'off' && node !== null ? (player.list.tail?.value ?? null) : null);
  const upcomingQueued = player.upNext.peek()?.song ?? null;
  const next = upcomingQueued ?? node?.next?.value ?? (player.repeat !== 'off' && node !== null ? (player.list.head?.value ?? null) : null);

  // El motor de reproducción vive mientras la tornamesa esté montada.
  useEffect(() => {
    const host = hostRef.current;
    if (host === null) return;
    const engine = new HybridEngine(host, store, store.setSimulated, {
      forceSimulated: new URLSearchParams(window.location.search).has('sim'),
      onFallback: () => store.toast('No se pudo cargar YouTube. La reproducción será simulada, sin audio.'),
    });
    store.attachEngine(engine);
    return () => {
      store.attachEngine(null);
      engine.destroy();
    };
  }, []);

  // En tablet y celular la tornamesa es una capa: cerrada, queda fuera del foco del teclado.
  useEffect(() => {
    const media = window.matchMedia('(max-width: 1180px)');
    const sync = (): void => {
      if (asideRef.current) asideRef.current.inert = media.matches && !ui.turntableOpen;
    };
    sync();
    media.addEventListener('change', sync);
    return () => media.removeEventListener('change', sync);
  }, [ui.turntableOpen]);

  const pads = [
    { label: 'DJ', Icon: DjIcon, on: ui.view === 'dj', run: () => ui.go('dj') },
    { label: 'Cola', Icon: QueueIcon, on: ui.turntableTab === 'queue', run: () => ui.setTurntableTab(ui.turntableTab === 'queue' ? 'deck' : 'queue') },
    { label: 'Nodos', Icon: NodesIcon, on: ui.view === 'playlist' && ui.tab === 'nodes', run: () => ui.openPlaylist({ kind: 'all' }, 'nodes') },
    { label: 'Apagado', Icon: TimerIcon, on: player.sleep !== null, run: () => ui.openDialog('sleep') },
    { label: 'Voz', Icon: VoiceIcon, on: false, run: () => ui.openDialog('commands', { listen: true }) },
    { label: 'Comandos', Icon: CommandIcon, on: false, run: () => ui.openDialog('commands') },
    { label: 'Me gusta', Icon: HeartIcon, on: song?.favorite === true, run: () => song && node !== null && player.toggleFavorite(song.id) },
    { label: 'Mini', Icon: MiniIcon, on: ui.miniOpen, run: () => ui.toggleMini() },
  ];

  return (
    <aside ref={asideRef} className="turntable panel" data-open={ui.turntableOpen} aria-label="Tornamesa">
      <div className="turntable-head">
        <button type="button" className="icon-btn turntable-close" onClick={() => ui.setTurntableOpen(false)} aria-label="Cerrar la tornamesa">
          <CollapseIcon size={20} weight="bold" aria-hidden="true" />
        </button>
        <div className="tabs" role="tablist" aria-label="Tornamesa o cola">
          <button type="button" role="tab" className="tab" aria-selected={ui.turntableTab === 'deck'} onClick={() => ui.setTurntableTab('deck')}>
            Tornamesa
          </button>
          <button type="button" role="tab" className="tab" aria-selected={ui.turntableTab === 'queue'} onClick={() => ui.setTurntableTab('queue')}>
            Cola
          </button>
        </div>
      </div>

      <div className="turntable-scroll">
        {/* El video de YouTube siempre queda visible mientras suena, como exigen sus condiciones de uso. */}
        <div className="video" data-idle={song === null || player.simulated}>
          <div className="video-host" ref={hostRef} />
          {(song === null || player.simulated) && (
            <p className="video-note">{song === null ? 'Elige una canción para ver su video' : 'Sin video: reproducción simulada, sin audio'}</p>
          )}
        </div>

        {ui.turntableTab === 'queue' ? (
          <QueuePanel />
        ) : (
          <>
            <NeighborCard song={previous} direction="prev" onClick={() => player.previous()} />
            <Vinyl song={song} playing={player.isPlaying} />
            <NeighborCard song={next} direction="next" onClick={() => player.next()} />
          </>
        )}

        <div className="now">
          <p className="now-pointer mono">{song !== null ? `nodo actual ${memoryAddress(song.id)}` : 'current = null'}</p>
          <h2 className="display now-title">{song?.title ?? 'Nada suena'}</h2>
          <p className="muted truncate">{song?.artist ?? 'Elige una canción de la lista'}</p>
          {song !== null && (
            <p className="now-tags">
              <span className={song.videoId && !player.simulated ? 'tag tag-red' : 'tag'}>{song.videoId && !player.simulated ? 'Completa en YouTube' : 'Simulada'}</span>
              {song.bpm !== null && (
                <span className="tag mono">
                  <BpmIcon size={12} weight="fill" aria-hidden="true" /> {song.bpm} BPM aprox.
                </span>
              )}
              <span className="tag">{song.genre}</span>
            </p>
          )}
        </div>

        <ProgressBar disabled={song === null} />
        <Transport />
        <SleepBadge />

        <ul className="pads">
          {pads.map((pad) => (
            <li key={pad.label}>
              <button type="button" className="pad" data-on={pad.on} aria-pressed={pad.on} onClick={pad.run}>
                <pad.Icon size={20} weight={pad.on ? 'fill' : 'regular'} aria-hidden="true" />
                <span>{pad.label}</span>
              </button>
            </li>
          ))}
        </ul>

        <div className="volume">
          <button type="button" className="icon-btn is-small" onClick={() => player.toggleMute()} aria-label={player.muted ? 'Activar sonido' : 'Silenciar'} aria-pressed={player.muted}>
            {player.muted || player.volume === 0 ? <MutedIcon size={18} aria-hidden="true" /> : <VolumeIcon size={18} aria-hidden="true" />}
          </button>
          <input
            className="slider"
            type="range"
            min={0}
            max={100}
            value={player.muted ? 0 : player.volume}
            onChange={(event) => player.setVolume(Number(event.target.value))}
            style={{ '--fill': `${player.muted ? 0 : player.volume}%` } as CSSProperties}
            aria-label="Volumen"
          />
          <span className="mono volume-value">{player.muted ? 0 : player.volume}</span>
        </div>
      </div>
    </aside>
  );
}

/** Disco flotante (tablet y celular): muestra el progreso y abre la tornamesa completa. */
export function FloatingDisc() {
  const player = usePlayer();
  const ui = useUi();
  const fraction = useFraction();
  const song = player.nowPlaying;
  return (
    <button type="button" className="floating-disc" onClick={() => ui.setTurntableOpen(true)} aria-label={song ? `Abrir la tornamesa. Suena ${song.title}` : 'Abrir la tornamesa'}>
      <svg viewBox="0 0 100 100" aria-hidden="true">
        <circle className="vinyl-ring-track" cx="50" cy="50" r="47" />
        <circle className="vinyl-ring-fill" cx="50" cy="50" r="47" strokeDasharray={RING} strokeDashoffset={RING * (1 - fraction)} />
      </svg>
      <span className="floating-disc-vinyl" data-playing={player.isPlaying}>
        {song !== null && <Cover song={song} />}
      </span>
      {!player.isPlaying && (
        <span className="floating-disc-play">
          <PlayIcon size={12} weight="fill" aria-hidden="true" />
        </span>
      )}
    </button>
  );
}

/** Mini reproductor flotante: carátula, título, progreso y controles básicos. */
export function MiniPlayer() {
  const player = usePlayer();
  const ui = useUi();
  const fraction = useFraction();
  const song = player.nowPlaying;
  if (!ui.miniOpen) return null;
  return (
    <section className="mini" aria-label="Mini reproductor">
      {song !== null ? <Cover song={song} className="mini-cover" /> : <span className="mini-cover cover cover-fallback">?</span>}
      <div className="mini-text">
        <p className="truncate mini-title">{song?.title ?? 'Nada suena'}</p>
        <div className="mini-bar" aria-hidden="true">
          <i style={{ transform: `scaleX(${fraction})` }} />
        </div>
      </div>
      <Transport compact />
      <button type="button" className="icon-btn is-small" onClick={ui.toggleMini} aria-label="Cerrar el mini reproductor">
        <CloseIcon size={16} aria-hidden="true" />
      </button>
    </section>
  );
}
