import { normalize } from './format';

/** Orden entendida a partir de un texto escrito o dictado. */
export type Command =
  | { type: 'next' | 'previous' | 'pause' | 'play' | 'shuffle' | 'repeat' | 'undo' | 'redo' | 'restore' | 'favorite' }
  | { type: 'playSong'; query: string }
  | { type: 'add'; query: string; placement: { at: 'start' } | { at: 'end' } | { at: 'index'; index: number } }
  | { type: 'remove'; query: string }
  | { type: 'theme'; theme: 'light' | 'dark' }
  | { type: 'volume'; value: number }
  | { type: 'sleep'; minutes: number }
  | { type: 'sort'; key: 'bpm' | 'genre' | 'title' | 'artist' | 'duration' }
  | { type: 'unknown' };

const SORT_KEYS: Record<string, 'bpm' | 'genre' | 'title' | 'artist' | 'duration'> = {
  ritmo: 'bpm',
  bpm: 'bpm',
  genero: 'genre',
  titulo: 'title',
  nombre: 'title',
  artista: 'artist',
  duracion: 'duration',
};

/** Quita la primera palabra (el verbo) conservando mayúsculas y tildes del resto. */
function afterFirstWord(text: string): string {
  return text.trim().replace(/^\S+\s*/, '').trim();
}

/**
 * Intérprete de comandos en español. Ignora tildes y mayúsculas en los verbos.
 * Ejemplos: "siguiente", "pon Tusa", "agrega Faded en la posición 3", "volumen 40".
 */
export function parseCommand(input: string): Command {
  const text = normalize(input).replace(/[.!?¡¿]/g, '').replace(/\s+/g, ' ');
  if (text === '') return { type: 'unknown' };
  const [verb = '', ...restWords] = text.split(' ');
  const rest = restWords.join(' ');
  const argument = afterFirstWord(input.replace(/[.!?¡¿]/g, ''));

  if (['siguiente', 'adelanta', 'adelantar', 'next'].includes(text)) return { type: 'next' };
  if (['anterior', 'atras', 'retrocede', 'retroceder'].includes(text)) return { type: 'previous' };
  if (['pausa', 'pausar', 'para', 'detener', 'alto'].includes(text)) return { type: 'pause' };
  if (['reproduce', 'reproducir', 'play', 'continua', 'continuar', 'suena'].includes(text)) return { type: 'play' };
  if (['aleatorio', 'mezclar', 'shuffle'].includes(text)) return { type: 'shuffle' };
  if (['repetir', 'repite', 'repeticion'].includes(text)) return { type: 'repeat' };
  if (text === 'deshacer' || text === 'deshaz') return { type: 'undo' };
  if (text === 'rehacer' || text === 'rehaz') return { type: 'redo' };
  if (text === 'restaurar' || text === 'restaura') return { type: 'restore' };
  if (text === 'me gusta' || text === 'favorita' || text === 'favorito') return { type: 'favorite' };

  if (verb === 'tema' && (rest === 'claro' || rest === 'oscuro')) {
    return { type: 'theme', theme: rest === 'claro' ? 'light' : 'dark' };
  }
  if (verb === 'volumen' && /^\d{1,3}$/.test(rest)) {
    return { type: 'volume', value: Math.min(100, Number(rest)) };
  }
  if (verb === 'temporizador' && /^\d{1,3}( min(utos)?)?$/.test(rest)) {
    const minutes = Number.parseInt(rest, 10);
    return minutes > 0 ? { type: 'sleep', minutes } : { type: 'unknown' };
  }
  if ((verb === 'ordenar' || verb === 'ordena') && rest.startsWith('por ')) {
    const key = SORT_KEYS[rest.slice(4)];
    return key ? { type: 'sort', key } : { type: 'unknown' };
  }

  if (['pon', 'reproduce', 'toca', 'escuchar'].includes(verb) && argument !== '') {
    return { type: 'playSong', query: argument };
  }
  if (['elimina', 'eliminar', 'quita', 'borra', 'borrar'].includes(verb) && argument !== '') {
    return { type: 'remove', query: argument };
  }
  if (['agrega', 'agregar', 'anade', 'anadir', 'suma'].includes(verb) && argument !== '') {
    const start = /^(.*?)\s+al (inicio|principio)$/i.exec(argument);
    if (start?.[1]) return { type: 'add', query: start[1].trim(), placement: { at: 'start' } };
    const end = /^(.*?)\s+al final$/i.exec(argument);
    if (end?.[1]) return { type: 'add', query: end[1].trim(), placement: { at: 'end' } };
    const position = /^(.*?)\s+en la posici[oó]n (\d{1,4})$/i.exec(argument);
    if (position?.[1] && position[2]) {
      // La persona cuenta desde 1; la lista, desde 0.
      return { type: 'add', query: position[1].trim(), placement: { at: 'index', index: Math.max(0, Number(position[2]) - 1) } };
    }
    return { type: 'add', query: argument, placement: { at: 'end' } };
  }
  return { type: 'unknown' };
}
