import { parseCommand } from '../lib/commands';
import { normalize, splitVideoTitle } from '../lib/format';
import type { Placement, Song } from './types';
import { store } from './usePlayer';
import { searchYouTube } from './youtubeApi';

/** Busca en la lista la primera canción cuyo título o artista contenga el texto. */
function findInList(query: string): Song | null {
  const wanted = normalize(query);
  return store.list.toArray().find((song) => normalize(`${song.title} ${song.artist}`).includes(wanted)) ?? null;
}

/** Busca la canción en YouTube (primer resultado) y la agrega a la lista. */
async function addFromYouTube(query: string, placement: Placement): Promise<{ message: string; song: Song | null }> {
  const response = await searchYouTube(query);
  if (!response.ok) return { message: response.message, song: null };
  const video = response.data[0];
  if (!video) return { message: `YouTube no encontró "${query}".`, song: null };
  const { title, artist } = splitVideoTitle(video.title, video.channel);
  const result = store.addSong({ title, artist, duration: video.durationSeconds, videoId: video.videoId }, placement);
  const added = store.list.toArray().find((song) => song.videoId === video.videoId && song.title === title) ?? null;
  return { message: result.message, song: result.ok ? added : null };
}

/** Interpreta y ejecuta un comando escrito o dictado. Devuelve la respuesta para mostrar. */
export async function runCommand(text: string): Promise<string> {
  const command = parseCommand(text);
  switch (command.type) {
    case 'next':
      store.next();
      return 'Siguiente canción.';
    case 'previous':
      store.previous();
      return 'Canción anterior.';
    case 'pause':
      store.pause();
      return 'En pausa.';
    case 'play':
      store.play();
      return 'Reproduciendo.';
    case 'shuffle':
      store.toggleShuffle();
      return store.shuffle ? 'Aleatorio activado.' : 'Aleatorio desactivado.';
    case 'repeat':
      store.cycleRepeat();
      return { off: 'Repetir apagado.', all: 'Repetir toda la lista.', one: 'Repetir una canción.' }[store.repeat];
    case 'undo':
      store.undo();
      return 'Listo.';
    case 'redo':
      store.redo();
      return 'Listo.';
    case 'restore':
      store.restoreSeed();
      return 'Lista restaurada.';
    case 'favorite': {
      const song = store.list.current?.value;
      if (!song) return 'No hay una canción actual.';
      store.toggleFavorite(song.id);
      return song.favorite ? `"${song.title}" ya no es favorita.` : `"${song.title}" es favorita.`;
    }
    case 'theme':
      store.setTheme(command.theme);
      return command.theme === 'light' ? 'Tema claro.' : 'Tema oscuro.';
    case 'volume':
      store.setVolume(command.value);
      return `Volumen en ${command.value}.`;
    case 'sleep':
      store.setSleep(command.minutes);
      return `Temporizador de ${command.minutes} min.`;
    case 'sort':
      store.sortBy(command.key);
      return 'Lista ordenada.';
    case 'playSong': {
      const found = findInList(command.query);
      if (found) {
        store.playSong(found.id);
        return `Suena "${found.title}".`;
      }
      // No está en la lista: se agrega justo después de la actual y se reproduce.
      const { message, song } = await addFromYouTube(command.query, { at: 'afterCurrent' });
      if (song) store.playSong(song.id);
      return song ? `Agregada y sonando: "${song.title}".` : message;
    }
    case 'add': {
      const { message } = await addFromYouTube(command.query, command.placement);
      return message;
    }
    case 'remove': {
      const found = findInList(command.query);
      if (!found) return `No encontré "${command.query}" en la lista.`;
      store.removeSong(found.id);
      return `Eliminada "${found.title}".`;
    }
    default:
      return 'No entendí ese comando. Prueba con uno de los ejemplos.';
  }
}
