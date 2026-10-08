import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { formatTime, memoryAddress } from '../lib/format';
import { usePlayer } from '../player/usePlayer';
import type { Song } from '../player/types';
import { Cover } from './Cover';
import { DownIcon, GripIcon, HeartIcon, QueueIcon, TrashIcon, UpIcon } from './icons';
import { useFlip } from './useFlip';

export interface SongRow {
  song: Song;
  /** Posición real del nodo en la lista (base 0). */
  index: number;
}

interface SongTableProps {
  rows: SongRow[];
  /** Reordenar solo tiene sentido cuando se ve la lista completa, sin filtros. */
  reorderable: boolean;
}

/** Tres barras que laten en la fila de la canción que suena. */
function Equalizer({ playing }: { playing: boolean }) {
  return (
    <span className="eq" data-playing={playing} aria-hidden="true">
      <i />
      <i />
      <i />
    </span>
  );
}

/** Tabla de canciones: reproducir, favorita, encolar, subir, bajar, arrastrar y eliminar. */
export function SongTable({ rows, reorderable }: SongTableProps) {
  const player = usePlayer();
  const listRef = useRef<HTMLOListElement>(null);
  const [armedId, setArmedId] = useState<string | null>(null);
  const [drag, setDrag] = useState<{ from: number; over: number } | null>(null);
  const currentId = player.queuedSong === null ? (player.list.current?.value.id ?? null) : null;
  const total = player.list.size;

  useFlip(listRef, rows.map((row) => row.song.id).join('|'));

  // La confirmación de eliminar se desarma sola a los 3 segundos.
  useEffect(() => {
    if (armedId === null) return;
    const timer = setTimeout(() => setArmedId(null), 3000);
    return () => clearTimeout(timer);
  }, [armedId]);

  // Escape cancela un arrastre en curso.
  useEffect(() => {
    if (drag === null) return;
    const cancel = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') setDrag(null);
    };
    document.addEventListener('keydown', cancel);
    return () => document.removeEventListener('keydown', cancel);
  }, [drag]);

  /** Cuántas filas tienen su centro por encima del puntero. */
  function rowsAbove(clientY: number): number {
    let count = 0;
    listRef.current?.querySelectorAll<HTMLElement>('[data-row]').forEach((element) => {
      const rect = element.getBoundingClientRect();
      if (clientY > rect.top + rect.height / 2) count++;
    });
    return count;
  }

  function onGripDown(event: ReactPointerEvent<HTMLButtonElement>, position: number): void {
    if (!reorderable || event.button > 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    setDrag({ from: position, over: position });
  }

  function onGripMove(event: ReactPointerEvent<HTMLButtonElement>): void {
    if (drag === null) return;
    // Cerca de los bordes, la vista se desplaza para alcanzar filas que no se ven.
    const scroller = listRef.current?.closest('.main-scroll');
    if (scroller) {
      const bounds = scroller.getBoundingClientRect();
      if (event.clientY < bounds.top + 56) scroller.scrollBy(0, -14);
      else if (event.clientY > bounds.bottom - 56) scroller.scrollBy(0, 14);
    }
    // Al bajar, la propia fila arrastrada ya está contada entre las de arriba.
    const above = rowsAbove(event.clientY);
    const over = Math.max(0, Math.min(rows.length - 1, above > drag.from ? above - 1 : above));
    if (over !== drag.over) setDrag({ from: drag.from, over });
  }

  function onGripUp(): void {
    if (drag === null) return;
    const from = rows[drag.from];
    const to = rows[drag.over];
    setDrag(null);
    // El mismo nodo se desenlaza y se vuelve a enlazar en su nueva posición.
    if (from && to && from.index !== to.index) player.moveTo(from.index, to.index);
  }

  function onDelete(song: Song): void {
    if (armedId === song.id) {
      setArmedId(null);
      player.removeSong(song.id);
    } else {
      setArmedId(song.id);
    }
  }

  if (rows.length === 0) return null;

  return (
    <div className="table" data-dragging={drag !== null}>
      <div className="table-head" aria-hidden="true">
        <span />
        <span className="col-num">#</span>
        <span>Título</span>
        <span className="col-album">Álbum</span>
        <span className="col-source">Fuente</span>
        <span className="col-dur">Dur.</span>
        <span />
      </div>
      <ol className="table-body" ref={listRef}>
        {rows.map(({ song, index }, position) => {
          const isCurrent = song.id === currentId;
          const armed = armedId === song.id;
          const dropHint = drag !== null && drag.over === position && drag.over !== drag.from ? (drag.over > drag.from ? 'after' : 'before') : undefined;
          return (
            <li
              key={song.id}
              className="row"
              data-row
              data-flip={song.id}
              data-current={isCurrent}
              data-lifted={drag?.from === position}
              data-drop={dropHint}
            >
              <button
                type="button"
                className="row-grip"
                disabled={!reorderable}
                aria-label={`Arrastrar "${song.title}" para reordenar. Con teclado usa los botones subir y bajar.`}
                onPointerDown={(event) => onGripDown(event, position)}
                onPointerMove={onGripMove}
                onPointerUp={onGripUp}
                onPointerCancel={() => setDrag(null)}
              >
                <GripIcon size={18} weight="bold" aria-hidden="true" />
              </button>

              <span className="row-num">
                {isCurrent ? <Equalizer playing={player.isPlaying} /> : <span className="row-index mono">{String(index + 1).padStart(2, '0')}</span>}
                <span className="row-addr mono">{memoryAddress(song.id)}</span>
              </span>

              <button
                type="button"
                className="row-main"
                onClick={() => (isCurrent ? player.togglePlay() : player.playSong(song.id))}
                aria-label={`${isCurrent && player.isPlaying ? 'Pausar' : 'Reproducir'} ${song.title}, de ${song.artist}`}
              >
                <Cover song={song} className="row-cover" />
                <span className="row-text">
                  <span className="row-title truncate">{song.title}</span>
                  <span className="row-artist truncate">{song.artist}</span>
                </span>
              </button>

              <span className="row-album col-album truncate">{song.album || 'Sin álbum'}</span>
              <span className="col-source">
                <span className={song.videoId ? 'tag tag-red' : 'tag'}>{song.videoId ? 'YouTube' : 'Simulada'}</span>
              </span>
              <span className="row-dur col-dur mono">{song.duration > 0 ? formatTime(song.duration) : '--:--'}</span>

              <span className="row-actions">
                <button
                  type="button"
                  className={`icon-btn is-small ${song.favorite ? 'is-on' : ''}`}
                  onClick={() => player.toggleFavorite(song.id)}
                  aria-pressed={song.favorite}
                  aria-label={song.favorite ? `Quitar ${song.title} de favoritas` : `Marcar ${song.title} como favorita`}
                >
                  <HeartIcon size={16} weight={song.favorite ? 'fill' : 'regular'} aria-hidden="true" />
                </button>
                <button type="button" className="icon-btn is-small" onClick={() => player.enqueue(song.id)} aria-label={`Reproducir ${song.title} a continuación`}>
                  <QueueIcon size={16} aria-hidden="true" />
                </button>
                <button
                  type="button"
                  className="icon-btn is-small row-move"
                  onClick={() => player.moveUp(song.id)}
                  disabled={!reorderable || index === 0}
                  aria-label={`Subir ${song.title} una posición`}
                >
                  <UpIcon size={16} aria-hidden="true" />
                </button>
                <button
                  type="button"
                  className="icon-btn is-small row-move"
                  onClick={() => player.moveDown(song.id)}
                  disabled={!reorderable || index === total - 1}
                  aria-label={`Bajar ${song.title} una posición`}
                >
                  <DownIcon size={16} aria-hidden="true" />
                </button>
                <button
                  type="button"
                  className="row-delete"
                  data-armed={armed}
                  onClick={() => onDelete(song)}
                  onBlur={() => armed && setArmedId(null)}
                  aria-label={armed ? `Confirmar: eliminar ${song.title}` : `Eliminar ${song.title}`}
                >
                  <TrashIcon size={16} aria-hidden="true" />
                  <span className="row-delete-label" aria-hidden={!armed}>
                    Eliminar
                  </span>
                </button>
              </span>
            </li>
          );
        })}
      </ol>
      <p className="sr-only" role="status">
        {armedId !== null ? 'Pulsa de nuevo para confirmar la eliminación.' : ''}
      </p>
    </div>
  );
}
