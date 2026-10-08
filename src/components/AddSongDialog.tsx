import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { extractYouTubeId, formatTime, parseDuration, splitVideoTitle } from '../lib/format';
import { GENRES, suggestedSongs } from '../player/seed';
import { usePlayer } from '../player/usePlayer';
import type { Placement } from '../player/types';
import { fetchVideoInfo, searchYouTube, type VideoResult } from '../player/youtubeApi';
import { Dialog } from './Dialog';
import { MinusIcon, PlusIcon, SearchIcon } from './icons';

type Where = 'start' | 'end' | 'index';

interface AddSongDialogProps {
  prefill: string;
  onClose: () => void;
}

/**
 * Agregar canción: se busca o se pega un enlace de YouTube, se revisan los datos y se elige
 * dónde insertar. Antes de confirmar se muestra la operación exacta que hará la lista doble.
 */
export function AddSongDialog({ prefill, onClose }: AddSongDialogProps) {
  const player = usePlayer();
  const size = player.list.size;
  const ids = { source: useId(), title: useId(), artist: useId(), album: useId(), duration: useId(), genre: useId(), position: useId(), error: useId() };

  const [source, setSource] = useState(prefill);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState('');
  const [results, setResults] = useState<VideoResult[]>([]);
  const [videoId, setVideoId] = useState('');
  const [title, setTitle] = useState('');
  const [artist, setArtist] = useState('');
  const [album, setAlbum] = useState('');
  const [duration, setDuration] = useState('');
  const [genre, setGenre] = useState<string>('Otro');
  const [bpm, setBpm] = useState<number | null>(null);
  const [where, setWhere] = useState<Where>('end');
  const [position, setPosition] = useState(Math.max(1, Math.ceil((size + 1) / 2)));
  const [error, setError] = useState('');
  const request = useRef<AbortController | null>(null);

  function fill(video: { videoId: string; title: string; artist: string; album?: string; seconds: number; genre?: string; bpm?: number | null }): void {
    setVideoId(video.videoId);
    setTitle(video.title);
    setArtist(video.artist);
    setAlbum(video.album ?? '');
    setDuration(video.seconds > 0 ? formatTime(video.seconds) : '');
    setGenre(video.genre ?? 'Otro');
    setBpm(video.bpm ?? null);
    setResults([]);
    setError('');
  }

  function choose(result: VideoResult): void {
    const parts = splitVideoTitle(result.title, result.channel);
    fill({ videoId: result.videoId, title: parts.title, artist: parts.artist, seconds: result.durationSeconds });
    setNotice(result.durationSeconds > 0 ? '' : 'La duración se completará sola cuando el video cargue.');
  }

  async function lookup(text: string): Promise<void> {
    const clean = text.trim();
    if (clean.length < 2) {
      setNotice('Escribe el nombre de una canción o pega un enlace de YouTube.');
      return;
    }
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    setLoading(true);
    setNotice('');
    setResults([]);
    const looksLikeLink = /youtu\.?be|^https?:\/\//i.test(clean);
    const linkId = looksLikeLink ? extractYouTubeId(clean) : null;
    if (looksLikeLink && linkId === null) {
      setLoading(false);
      setNotice('Ese enlace no es de un video de YouTube.');
      return;
    }
    if (linkId !== null) {
      const response = await fetchVideoInfo(linkId, controller.signal);
      if (controller.signal.aborted) return;
      setLoading(false);
      if (response.ok) choose(response.data);
      else setNotice(response.message);
      return;
    }
    const response = await searchYouTube(clean, controller.signal);
    if (controller.signal.aborted) return;
    setLoading(false);
    if (!response.ok) setNotice(response.message);
    else if (response.data.length === 0) setNotice('YouTube no encontró canciones con ese nombre.');
    else setResults(response.data);
  }

  // Si el diálogo se abre con un enlace pegado en el buscador, se consulta de una vez.
  useEffect(() => {
    if (prefill.trim() !== '') void lookup(prefill);
    return () => request.current?.abort();
    // Solo al abrir.
  }, []);

  // Posición final (base 0) y operación que ejecutará la lista.
  const index = where === 'start' ? 0 : where === 'end' ? size : position - 1;
  const positionValid = where !== 'index' || (Number.isInteger(position) && position >= 1 && position <= size + 1);
  let preview: string;
  if (index <= 0) preview = 'addFirst()   sin recorrer   O(1)';
  else if (index >= size) preview = 'addLast()   sin recorrer   O(1)';
  else {
    const cost = player.list.walkCost(index);
    preview = `insertAt(${index})   ${cost.steps} ${cost.steps === 1 ? 'paso' : 'pasos'} desde ${cost.from}   O(n)`;
  }

  function submit(event: FormEvent): void {
    event.preventDefault();
    if (!positionValid) {
      setError(`La posición debe estar entre 1 y ${size + 1}.`);
      return;
    }
    const seconds = duration.trim() === '' ? (videoId !== '' ? 0 : null) : parseDuration(duration);
    if (seconds === null) {
      setError('Escribe la duración como minutos:segundos, por ejemplo 3:38.');
      return;
    }
    const placement: Placement = where === 'index' ? { at: 'index', index } : { at: where };
    const result = player.addSong({ title, artist, album, duration: seconds, videoId, genre, bpm }, placement);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    player.toast(result.message, true);
    onClose();
  }

  return (
    <Dialog title="Agregar canción" onClose={onClose}>
      <form onSubmit={submit} noValidate className="dialog-form">
        <div className="dialog-body">
          <div className="field">
            <label htmlFor={ids.source}>Canción de YouTube</label>
            <div className="lookup">
              <input
                id={ids.source}
                className="input"
                value={source}
                onChange={(event) => setSource(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    void lookup(source);
                  }
                }}
                placeholder="Nombre de la canción o enlace…"
                name="source"
                autoComplete="off"
                autoFocus
              />
              <button type="button" className="btn" onClick={() => void lookup(source)} disabled={loading}>
                <SearchIcon size={18} aria-hidden="true" />
                {loading ? 'Buscando…' : 'Buscar'}
              </button>
            </div>
            <p className="field-hint" role="status">
              {notice}
            </p>
          </div>

          {loading && (
            <ul className="results" aria-hidden="true">
              {[0, 1, 2].map((item) => (
                <li key={item} className="result is-skeleton" />
              ))}
            </ul>
          )}

          {results.length > 0 && (
            <ul className="results" aria-label="Resultados de YouTube">
              {results.map((result) => (
                <li key={result.videoId}>
                  <button type="button" className="result" onClick={() => choose(result)}>
                    <img src={result.thumbnail} alt="" width={64} height={36} loading="lazy" />
                    <span className="result-text">
                      <span className="truncate result-title">{result.title}</span>
                      <span className="truncate muted">{result.channel}</span>
                    </span>
                    <span className="mono muted">{result.durationSeconds > 0 ? formatTime(result.durationSeconds) : ''}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}

          {videoId === '' && results.length === 0 && !loading && (
            <div className="field">
              <span className="field-label">Sugerencias</span>
              <ul className="chips">
                {suggestedSongs().map((song) => (
                  <li key={song.videoId}>
                    <button type="button" className="chip" onClick={() => fill({ ...song, seconds: song.duration })}>
                      {song.title}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="form-grid">
            <div className="field">
              <label htmlFor={ids.title}>Título</label>
              <input id={ids.title} className="input" name="title" autoComplete="off" value={title} onChange={(event) => setTitle(event.target.value)} maxLength={120} required />
            </div>
            <div className="field">
              <label htmlFor={ids.artist}>Artista</label>
              <input id={ids.artist} className="input" name="artist" autoComplete="off" value={artist} onChange={(event) => setArtist(event.target.value)} maxLength={120} required />
            </div>
            <div className="field">
              <label htmlFor={ids.album}>Álbum (opcional)</label>
              <input id={ids.album} className="input" name="album" autoComplete="off" value={album} onChange={(event) => setAlbum(event.target.value)} maxLength={120} />
            </div>
            <div className="field form-pair">
              <div className="field">
                <label htmlFor={ids.duration}>Duración</label>
                <input
                  id={ids.duration}
                  className="input mono"
                  value={duration}
                  onChange={(event) => setDuration(event.target.value)}
                  placeholder="3:38"
                  name="duration"
                  autoComplete="off"
                  inputMode="numeric"
                  maxLength={8}
                />
              </div>
              <div className="field">
                <label htmlFor={ids.genre}>Género</label>
                <select id={ids.genre} name="genre" className="input" value={genre} onChange={(event) => setGenre(event.target.value)}>
                  {GENRES.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
          <p className="field-hint">
            {videoId !== '' ? 'Sonará completa con el reproductor oficial de YouTube.' : 'Sin video de YouTube, la reproducción es simulada (sin audio).'}
          </p>

          <fieldset className="placement">
            <legend className="field-label">Dónde insertar</legend>
            <div className="tabs" role="radiogroup" aria-label="Dónde insertar">
              {(
                [
                  ['start', 'Al inicio'],
                  ['end', 'Al final'],
                  ['index', 'En la posición'],
                ] as const
              ).map(([value, label]) => (
                <button key={value} type="button" role="radio" className="tab" aria-checked={where === value} onClick={() => setWhere(value)}>
                  {label}
                </button>
              ))}
            </div>
            {where === 'index' && (
              <div className="stepper">
                <button type="button" className="icon-btn is-outlined is-small" onClick={() => setPosition((value) => Math.max(1, value - 1))} disabled={position <= 1} aria-label="Una posición antes">
                  <MinusIcon size={16} aria-hidden="true" />
                </button>
                <label htmlFor={ids.position} className="sr-only">
                  Posición, de 1 a {size + 1}
                </label>
                <input
                  id={ids.position}
                  className="input mono stepper-input"
                  type="number"
                  min={1}
                  max={size + 1}
                  value={Number.isNaN(position) ? '' : position}
                  onChange={(event) => setPosition(event.target.valueAsNumber)}
                  aria-invalid={!positionValid}
                />
                <button type="button" className="icon-btn is-outlined is-small" onClick={() => setPosition((value) => Math.min(size + 1, (Number.isNaN(value) ? 0 : value) + 1))} disabled={position >= size + 1} aria-label="Una posición después">
                  <PlusIcon size={16} aria-hidden="true" />
                </button>
                <span className="muted">de {size + 1}</span>
              </div>
            )}
            <p className="operation mono" aria-label="Operación que se va a ejecutar">
              {positionValid ? preview : `Posición inválida: debe estar entre 1 y ${size + 1}.`}
            </p>
          </fieldset>

          {error !== '' && (
            <p id={ids.error} className="field-error" role="alert">
              {error}
            </p>
          )}
        </div>
        <div className="dialog-foot">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancelar
          </button>
          <button type="submit" className="btn btn-primary">
            Agregar
          </button>
        </div>
      </form>
    </Dialog>
  );
}
