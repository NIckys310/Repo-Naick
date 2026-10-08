import { useEffect, useRef, useState } from 'react';
import { PlayIcon, PlusIcon, YouTubeIcon } from '../components/icons';
import { SongTable, type SongRow } from '../components/SongTable';
import { extractYouTubeId, formatTime, normalize, splitVideoTitle } from '../lib/format';
import { GENRES } from '../player/seed';
import { usePlayer } from '../player/usePlayer';
import { searchYouTube, type VideoResult } from '../player/youtubeApi';
import { useUi } from '../ui';

/** Última solicitud de búsqueda ya atendida (sobrevive a que la vista se desmonte). */
let handledRequest = 0;

/** Buscar: filtra la lista mientras escribes y, si lo pides, consulta YouTube por el backend. */
export function SearchView() {
  const player = usePlayer();
  const ui = useUi();
  const text = ui.query.trim();
  const query = normalize(text);
  const [results, setResults] = useState<VideoResult[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState('');
  const request = useRef<AbortController | null>(null);
  const isLink = /youtu\.?be/i.test(text) && extractYouTubeId(text) !== null;

  const rows: SongRow[] =
    query === ''
      ? []
      : player.list
          .toArray()
          .map((song, index) => ({ song, index }))
          .filter(({ song }) => normalize(`${song.title} ${song.artist} ${song.album} ${song.genre}`).includes(query));

  async function searchOnline(): Promise<void> {
    if (text.length < 2 || isLink) return;
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    setLoading(true);
    setNotice('');
    const response = await searchYouTube(text, controller.signal);
    if (controller.signal.aborted) return;
    setLoading(false);
    if (response.ok) {
      setResults(response.data);
      if (response.data.length === 0) setNotice('YouTube no encontró canciones con ese nombre.');
    } else {
      setResults(null);
      setNotice(response.message);
    }
  }

  // Al enviar el buscador (Enter) se consulta YouTube. Escribir no gasta cuota.
  useEffect(() => {
    if (ui.searchRequest !== handledRequest) {
      handledRequest = ui.searchRequest;
      void searchOnline();
    }
    return () => request.current?.abort();
    // Solo cuando se pide buscar.
  }, [ui.searchRequest]);

  // Si cambia el texto, los resultados anteriores ya no corresponden.
  useEffect(() => {
    setResults(null);
    setNotice('');
  }, [text]);

  function add(video: VideoResult, playNow: boolean): void {
    const { title, artist } = splitVideoTitle(video.title, video.channel);
    const result = player.addSong({ title, artist, duration: video.durationSeconds, videoId: video.videoId }, playNow ? { at: 'afterCurrent' } : { at: 'end' });
    player.toast(result.message, result.ok);
    if (result.ok && playNow) {
      const added = player.list.toArray().find((song) => song.videoId === video.videoId && song.title === title);
      if (added) player.playSong(added.id);
    }
  }

  if (text === '') {
    return (
      <div className="view">
        <h1 className="display view-title">Buscar</h1>
        <p className="muted">Escribe arriba para filtrar tu lista, o pega un enlace de YouTube para agregarlo.</p>
        <h2 className="section-title">Explorar por género</h2>
        <ul className="genres">
          {GENRES.slice(0, 6).map((genre, index) => (
            <li key={genre}>
              <button type="button" className="genre" data-tone={index % 4} onClick={() => ui.openPlaylist({ kind: 'genre', value: genre })}>
                <span className="display">{genre}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  return (
    <div className="view">
      <h1 className="display view-title">Resultados</h1>

      {isLink && (
        <section className="link-card">
          <YouTubeIcon size={28} weight="fill" aria-hidden="true" />
          <div>
            <h2 className="section-title">Enlace de YouTube detectado</h2>
            <p className="muted">Revisa sus datos y elige en qué posición insertarlo.</p>
          </div>
          <button type="button" className="btn btn-primary" onClick={() => ui.openDialog('add', { prefill: text })}>
            <PlusIcon size={18} weight="bold" aria-hidden="true" /> Agregar
          </button>
        </section>
      )}

      {!isLink && (
        <>
          <h2 className="section-title">En tu lista</h2>
          {rows.length === 0 ? <p className="muted">Ninguna canción de tu lista coincide con "{text}".</p> : <SongTable rows={rows} reorderable={false} />}

          <div className="search-online">
            <h2 className="section-title">En YouTube</h2>
            <button type="button" className="btn" onClick={() => void searchOnline()} disabled={loading || text.length < 2}>
              <YouTubeIcon size={18} weight="fill" aria-hidden="true" />
              {loading ? 'Buscando…' : `Buscar "${text.length > 24 ? `${text.slice(0, 24)}…` : text}"`}
            </button>
          </div>
          <p className="field-hint" role="status">
            {notice}
          </p>
          {loading && (
            <ul className="results" aria-hidden="true">
              {[0, 1, 2, 3].map((item) => (
                <li key={item} className="result is-skeleton" />
              ))}
            </ul>
          )}
          {results !== null && results.length > 0 && (
            <ul className="results">
              {results.map((video) => (
                <li key={video.videoId} className="result">
                  <img src={video.thumbnail} alt="" width={64} height={36} loading="lazy" />
                  <span className="result-text">
                    <span className="truncate result-title">{video.title}</span>
                    <span className="truncate muted">{video.channel}</span>
                  </span>
                  <span className="mono muted">{video.durationSeconds > 0 ? formatTime(video.durationSeconds) : ''}</span>
                  <button type="button" className="icon-btn is-small" onClick={() => add(video, true)} aria-label={`Reproducir ahora ${video.title}`}>
                    <PlayIcon size={16} weight="fill" aria-hidden="true" />
                  </button>
                  <button type="button" className="btn btn-small" onClick={() => add(video, false)}>
                    Agregar al final
                  </button>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
