import type { Song } from './types';

type SeedSong = Omit<Song, 'id' | 'favorite'>;

/**
 * Catálogo inicial: videos oficiales de YouTube (se reproducen completos con el reproductor
 * oficial incrustado). La duración es aproximada; al cargar cada video se corrige con la real.
 */
const CATALOG: SeedSong[] = [
  { videoId: 'DUT5rEU6pqM', title: "Hips Don't Lie", artist: 'Shakira ft. Wyclef Jean', album: 'Oral Fixation, Vol. 2', duration: 218, genre: 'Latino', bpm: 100 },
  { videoId: 'pRpeEdMmmQ0', title: 'Waka Waka (This Time for Africa)', artist: 'Shakira', album: 'Sale el Sol', duration: 211, genre: 'Latino', bpm: 127 },
  { videoId: 'kJQP7kiw5Fk', title: 'Despacito', artist: 'Luis Fonsi ft. Daddy Yankee', album: 'Vida', duration: 282, genre: 'Reguetón', bpm: 89 },
  { videoId: 'wnJ6LuUFpMo', title: 'Mi Gente', artist: 'J Balvin, Willy William', album: 'Vibras', duration: 186, genre: 'Reguetón', bpm: 105 },
  { videoId: 'tbneQDc2H3I', title: 'Tusa', artist: 'KAROL G, Nicki Minaj', album: 'KG0516', duration: 201, genre: 'Reguetón', bpm: 101 },
  { videoId: 'fJ9rUzIMcZQ', title: 'Bohemian Rhapsody', artist: 'Queen', album: 'A Night at the Opera', duration: 359, genre: 'Rock', bpm: 72 },
  { videoId: '4NRXx6U8ABQ', title: 'Blinding Lights', artist: 'The Weeknd', album: 'After Hours', duration: 262, genre: 'Pop', bpm: 171 },
  { videoId: 'OPf0YbXqDm0', title: 'Uptown Funk', artist: 'Mark Ronson ft. Bruno Mars', album: 'Uptown Special', duration: 271, genre: 'Pop', bpm: 115 },
  { videoId: 'djV11Xbc914', title: 'Take On Me', artist: 'a-ha', album: 'Hunting High and Low', duration: 244, genre: 'Pop', bpm: 169 },
  { videoId: 'Zi_XLOBDo_Y', title: 'Billie Jean', artist: 'Michael Jackson', album: 'Thriller', duration: 295, genre: 'Pop', bpm: 117 },
  { videoId: 'YQHsXMglC9A', title: 'Hello', artist: 'Adele', album: '25', duration: 367, genre: 'Pop', bpm: 79 },
  { videoId: '60ItHLz5WEA', title: 'Faded', artist: 'Alan Walker', album: 'Different World', duration: 213, genre: 'Electrónica', bpm: 90 },
  { videoId: 'JGwWNGJdvx8', title: 'Shape of You', artist: 'Ed Sheeran', album: '÷ (Divide)', duration: 264, genre: 'Pop', bpm: 96 },
  { videoId: '2Vv-BfVoq4g', title: 'Perfect', artist: 'Ed Sheeran', album: '÷ (Divide)', duration: 280, genre: 'Pop', bpm: 95 },
  { videoId: '1w7OgIMMRc4', title: "Sweet Child O' Mine", artist: "Guns N' Roses", album: 'Appetite for Destruction', duration: 303, genre: 'Rock', bpm: 125 },
  { videoId: 'HyHNuVaZJ-k', title: 'Feel Good Inc.', artist: 'Gorillaz', album: 'Demon Days', duration: 254, genre: 'Hip hop', bpm: 139 },
  { videoId: 'hT_nvWreIhg', title: 'Counting Stars', artist: 'OneRepublic', album: 'Native', duration: 284, genre: 'Pop', bpm: 122 },
  { videoId: 'RgKAFK5djSk', title: 'See You Again', artist: 'Wiz Khalifa ft. Charlie Puth', album: 'Furious 7', duration: 238, genre: 'Hip hop', bpm: 80 },
  { videoId: '09R8_2nJtjg', title: 'Sugar', artist: 'Maroon 5', album: 'V', duration: 302, genre: 'Pop', bpm: 120 },
  { videoId: 'k2qgadSvNyU', title: 'New Rules', artist: 'Dua Lipa', album: 'Dua Lipa', duration: 225, genre: 'Pop', bpm: 116 },
];

/** Cuántas canciones del catálogo forman la lista inicial; el resto queda como sugerencias. */
const INITIAL_COUNT = 12;

const toSong = (seed: SeedSong): Song => ({ ...seed, id: `seed-${seed.videoId}`, favorite: false });

/** Canciones con las que empieza (y se restaura) la lista. */
export function initialSongs(): Song[] {
  return CATALOG.slice(0, INITIAL_COUNT).map(toSong);
}

/** Canciones sugeridas para agregar sin necesidad de buscar. */
export function suggestedSongs(): SeedSong[] {
  return CATALOG.slice(INITIAL_COUNT);
}

/** Géneros que ofrece el formulario al agregar una canción. */
export const GENRES = ['Latino', 'Reguetón', 'Pop', 'Rock', 'Electrónica', 'Hip hop', 'Otro'] as const;
