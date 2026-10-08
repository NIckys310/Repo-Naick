import type { CSSProperties } from 'react';
import { splitArtists } from '../lib/format';
import { usePlayer } from '../player/usePlayer';
import type { Song } from '../player/types';
import { useUi, type Collection } from '../ui';

interface Spine {
  label: string;
  count: number;
  collection: Collection;
}

/** Cuenta cuántas canciones tiene cada género o artista. Es un cálculo para pintar. */
function countBy(songs: Song[], keysOf: (song: Song) => string[]): { name: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const song of songs) {
    for (const key of keysOf(song)) counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'es'));
}

function SpineRow({ title, spines }: { title: string; spines: Spine[] }) {
  const ui = useUi();
  const tallest = Math.max(...spines.map((spine) => spine.count), 1);
  return (
    <section>
      <h2 className="section-title">{title}</h2>
      <ul className="spines">
        {spines.map((spine, index) => (
          <li key={spine.label}>
            <button
              type="button"
              className="spine"
              data-tone={index % 4}
              style={{ '--height': `${130 + (spine.count / tallest) * 90}px` } as CSSProperties}
              onClick={() => ui.openPlaylist(spine.collection)}
              aria-label={`${spine.label}, ${spine.count} ${spine.count === 1 ? 'canción' : 'canciones'}`}
            >
              <span className="spine-name display">{spine.label}</span>
              <span className="spine-count mono">{spine.count}</span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Estante: la lista y sus colecciones automáticas como lomos de discos. */
export function ShelfView() {
  const player = usePlayer();
  const songs = player.list.toArray();
  const favorites = songs.filter((song) => song.favorite).length;
  const genres = countBy(songs, (song) => [song.genre]);
  const artists = countBy(songs, (song) => splitArtists(song.artist)).slice(0, 12);

  return (
    <div className="view">
      <h1 className="display view-title">Tu estante</h1>
      <p className="muted">Las colecciones se calculan solas a partir de las canciones de la lista.</p>
      <SpineRow
        title="Listas"
        spines={[
          { label: 'rep-Naick Mix', count: songs.length, collection: { kind: 'all' } },
          { label: 'Tus favoritas', count: favorites, collection: { kind: 'favorites' } },
        ]}
      />
      {genres.length > 0 && (
        <SpineRow title="Por género" spines={genres.map((genre) => ({ label: genre.name, count: genre.count, collection: { kind: 'genre', value: genre.name } }))} />
      )}
      {artists.length > 0 && (
        <SpineRow title="Por artista" spines={artists.map((artist) => ({ label: artist.name, count: artist.count, collection: { kind: 'artist', value: artist.name } }))} />
      )}
    </div>
  );
}

/** Tu resumen: lo escuchado en este navegador. */
export function SummaryView() {
  const player = usePlayer();
  const entries = Object.values(player.stats).filter((entry) => entry.plays > 0);
  const seconds = entries.reduce((sum, entry) => sum + entry.seconds, 0);
  const mostPlayed = [...entries].sort((a, b) => b.plays - a.plays || b.seconds - a.seconds)[0];

  const genreSeconds = new Map<string, number>();
  const artistSeconds = new Map<string, number>();
  for (const entry of entries) {
    genreSeconds.set(entry.genre, (genreSeconds.get(entry.genre) ?? 0) + entry.seconds);
    for (const artist of splitArtists(entry.artist)) artistSeconds.set(artist, (artistSeconds.get(artist) ?? 0) + entry.seconds);
  }
  const favoriteGenre = [...genreSeconds].sort((a, b) => b[1] - a[1])[0]?.[0];
  const topArtists = [...artistSeconds].sort((a, b) => b[1] - a[1]).slice(0, 5);
  const longest = Math.max(topArtists[0]?.[1] ?? 0, 1);
  const withBpm = entries.filter((entry) => entry.bpm !== null);
  const averageBpm = withBpm.length > 0 ? Math.round(withBpm.reduce((sum, entry) => sum + (entry.bpm ?? 0), 0) / withBpm.length) : null;

  if (entries.length === 0) {
    return (
      <div className="view">
        <h1 className="display view-title">Tu resumen</h1>
        <div className="empty">
          <h2 className="display empty-title">Todavía no hay datos</h2>
          <p className="muted">Reproduce algunas canciones y aquí verás cuánto y qué escuchas.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="view">
      <h1 className="display view-title">Tu resumen</h1>
      <section className="summary-hero">
        <p className="display summary-number">{Math.floor(seconds / 60)}</p>
        <p>{Math.floor(seconds / 60) === 1 ? 'minuto escuchado' : 'minutos escuchados'} en este navegador</p>
      </section>
      <dl className="summary-grid">
        <div className="summary-card">
          <dt>Canciones distintas</dt>
          <dd className="display">{entries.length}</dd>
        </div>
        <div className="summary-card">
          <dt>La más repetida</dt>
          <dd className="display truncate">{mostPlayed?.title ?? 'Ninguna'}</dd>
        </div>
        <div className="summary-card">
          <dt>Género favorito</dt>
          <dd className="display truncate">{favoriteGenre ?? 'Ninguno'}</dd>
        </div>
        <div className="summary-card">
          <dt>Ritmo promedio</dt>
          <dd className="display">{averageBpm !== null ? `${averageBpm} BPM` : 'Sin dato'}</dd>
        </div>
      </dl>
      <h2 className="section-title">Artistas más escuchados</h2>
      <ol className="artist-bars">
        {topArtists.map(([artist, time]) => (
          <li key={artist}>
            <span className="truncate">{artist}</span>
            <span className="artist-bar" style={{ width: `${Math.max(3, (time / longest) * 100)}%` }} aria-hidden="true" />
            <span className="mono muted">{Math.max(1, Math.round(time / 60))} min</span>
          </li>
        ))}
      </ol>
    </div>
  );
}
