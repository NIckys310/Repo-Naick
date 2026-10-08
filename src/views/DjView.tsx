import { useState } from 'react';
import { usePlayer } from '../player/usePlayer';
import type { SortKey } from '../player/store';
import type { Song } from '../player/types';

const OPTIONS: { key: SortKey; label: string; hint: string }[] = [
  { key: 'bpm', label: 'Por ritmo', hint: 'De la más lenta a la más rápida, para que la mezcla suba de energía.' },
  { key: 'genre', label: 'Por género', hint: 'Agrupa los géneros y, dentro de cada uno, ordena por ritmo.' },
  { key: 'duration', label: 'Por duración', hint: 'De la más corta a la más larga.' },
  { key: 'artist', label: 'Por artista', hint: 'Orden alfabético de artista.' },
];

/** Vista previa del orden resultante. Es solo para pintar: la lista real se ordena moviendo nodos. */
function previewOrder(songs: Song[], key: SortKey, descending: boolean): Song[] {
  const direction = descending ? -1 : 1;
  return [...songs].sort((a, b) => {
    if (key === 'bpm') return ((a.bpm ?? 999) - (b.bpm ?? 999)) * direction;
    if (key === 'duration') return (a.duration - b.duration) * direction;
    return a[key].localeCompare(b[key], 'es') * direction || (a.bpm ?? 999) - (b.bpm ?? 999);
  });
}

/** Modo DJ: reordena toda la lista con un ordenamiento por inserción sobre los nodos. */
export function DjView() {
  const player = usePlayer();
  const [key, setKey] = useState<SortKey>('bpm');
  const [descending, setDescending] = useState(false);
  const songs = player.list.toArray();
  const preview = previewOrder(songs, key, descending);
  const fastest = Math.max(...preview.map((song) => song.bpm ?? 0), 1);
  const option = OPTIONS.find((item) => item.key === key) ?? OPTIONS[0];
  const alreadySorted = preview.every((song, index) => song.id === songs[index]?.id);

  return (
    <div className="view dj">
      <header className="dj-hero">
        <div className="dj-disc" aria-hidden="true">
          <span className="display">DJ</span>
        </div>
        <div>
          <h1 className="display view-title">Modo DJ</h1>
          <p className="muted dj-lead">
            Reordena la lista completa con un ordenamiento por inserción: cada nodo se desenlaza y se vuelve a enlazar en su lugar. La canción que suena no se interrumpe.
          </p>
        </div>
      </header>

      <div className="dj-controls">
        <div className="tabs" role="radiogroup" aria-label="Criterio de la mezcla">
          {OPTIONS.map((item) => (
            <button key={item.key} type="button" role="radio" className="tab" aria-checked={key === item.key} onClick={() => setKey(item.key)}>
              {item.label}
            </button>
          ))}
        </div>
        <label className="switch">
          <input type="checkbox" checked={descending} onChange={(event) => setDescending(event.target.checked)} />
          <span className="switch-track" aria-hidden="true" />
          Orden inverso
        </label>
      </div>
      <p className="muted">{option?.hint}</p>

      {songs.length < 2 ? (
        <p className="muted">Hacen falta al menos dos canciones para armar una mezcla.</p>
      ) : (
        <>
          <h2 className="section-title">Así quedaría la lista</h2>
          <ol className="bpm-chart">
            {preview.map((song, index) => (
              <li key={song.id} className="bpm-row">
                <span className="mono muted bpm-index">{String(index + 1).padStart(2, '0')}</span>
                <span className="truncate bpm-title">{song.title}</span>
                <span className="bpm-bar" style={{ width: `${Math.max(4, ((song.bpm ?? 0) / fastest) * 100)}%` }} aria-hidden="true" />
                <span className="mono bpm-value">{song.bpm !== null ? `${song.bpm} BPM` : 'sin dato'}</span>
              </li>
            ))}
          </ol>
          <div className="dj-apply">
            <button type="button" className="btn btn-primary" onClick={() => player.sortBy(key, descending)} disabled={alreadySorted}>
              {alreadySorted ? 'La lista ya tiene este orden' : 'Aplicar la mezcla'}
            </button>
            <span className="mono muted">sort() O(n²), se puede deshacer</span>
          </div>
        </>
      )}
    </div>
  );
}
