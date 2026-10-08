import { describe, expect, it } from 'vitest';
import { PlayerStore } from '../store';
import type { PlaybackEngine, Song } from '../types';

/** Motor falso: anota lo que el reproductor le pide, sin sonar nada. */
class FakeEngine implements PlaybackEngine {
  loaded: Song | null = null;
  autoplay = false;
  calls: string[] = [];
  load(song: Song, autoplay: boolean): void {
    this.loaded = song;
    this.autoplay = autoplay;
    this.calls.push(`load:${song.title}`);
  }
  play(): void {
    this.calls.push('play');
  }
  pause(): void {
    this.calls.push('pause');
  }
  seek(seconds: number): void {
    this.calls.push(`seek:${seconds}`);
  }
  setVolume(volume: number, muted: boolean): void {
    this.calls.push(`volume:${volume}:${muted}`);
  }
  stop(): void {
    this.loaded = null;
    this.calls.push('stop');
  }
}

/** Almacenamiento en memoria con la misma forma que localStorage. */
function memoryStorage(): { getItem(key: string): string | null; setItem(key: string, value: string): void } {
  const data = new Map<string, string>();
  return {
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => void data.set(key, value),
  };
}

function setup(random: () => number = () => 0): { store: PlayerStore; engine: FakeEngine } {
  const store = new PlayerStore({ random, now: () => 1_000 });
  const engine = new FakeEngine();
  store.attachEngine(engine);
  return { store, engine };
}

const titles = (store: PlayerStore): string[] => store.list.toArray().map((song) => song.title);
const sample = { title: 'Canción nueva', artist: 'Artista', duration: 200 };

describe('agregar canciones', () => {
  it('empieza con 12 canciones iniciales y ninguna sonando', () => {
    const { store } = setup();
    expect(store.list.size).toBe(12);
    expect(store.nowPlaying).toBeNull();
    expect(store.isPlaying).toBe(false);
  });

  it('agrega al inicio, al final y en una posición', () => {
    const { store } = setup();
    expect(store.addSong({ ...sample, title: 'Primera' }, { at: 'start' }).ok).toBe(true);
    expect(store.addSong({ ...sample, title: 'Última' }, { at: 'end' }).ok).toBe(true);
    expect(store.addSong({ ...sample, title: 'Tercera' }, { at: 'index', index: 2 }).ok).toBe(true);
    const all = titles(store);
    expect(all[0]).toBe('Primera');
    expect(all[2]).toBe('Tercera');
    expect(all[all.length - 1]).toBe('Última');
    expect(store.list.size).toBe(15);
    expect(store.list.isConsistent()).toBe(true);
  });

  it('valida título, artista, duración y posición', () => {
    const { store } = setup();
    expect(store.addSong({ ...sample, title: '   ' }, { at: 'end' }).ok).toBe(false);
    expect(store.addSong({ ...sample, artist: '' }, { at: 'end' }).ok).toBe(false);
    expect(store.addSong({ ...sample, duration: 0 }, { at: 'end' }).ok).toBe(false);
    expect(store.addSong({ ...sample, duration: Number.NaN }, { at: 'end' }).ok).toBe(false);
    expect(store.addSong(sample, { at: 'index', index: 13 }).ok).toBe(false);
    expect(store.addSong(sample, { at: 'index', index: -1 }).ok).toBe(false);
    expect(store.addSong(sample, { at: 'index', index: 1.5 }).ok).toBe(false);
    expect(store.list.size).toBe(12);
  });

  it('acepta duración desconocida solo si hay video de YouTube', () => {
    const { store } = setup();
    expect(store.addSong({ ...sample, duration: 0, videoId: 'kJQP7kiw5Fk' }, { at: 'end' }).ok).toBe(true);
  });

  it('inserta después de la canción actual', () => {
    const { store } = setup();
    store.play();
    store.addSong(sample, { at: 'afterCurrent' });
    expect(titles(store)[1]).toBe('Canción nueva');
  });
});

describe('eliminar canciones', () => {
  it('elimina y permite deshacer en la misma posición', () => {
    const { store } = setup();
    const before = titles(store);
    const third = store.list.getAt(2) as Song;
    expect(store.removeSong(third.id).ok).toBe(true);
    expect(store.list.size).toBe(11);
    store.undo();
    expect(titles(store)).toEqual(before);
    store.redo();
    expect(store.list.size).toBe(11);
    expect(store.list.isConsistent()).toBe(true);
  });

  it('si se elimina la que suena, pasa a la siguiente y el motor la carga', () => {
    const { store, engine } = setup();
    store.play();
    const first = store.nowPlaying as Song;
    const second = store.list.getAt(1) as Song;
    store.removeSong(first.id);
    expect(store.nowPlaying?.id).toBe(second.id);
    expect(engine.loaded?.id).toBe(second.id);
    expect(store.isPlaying).toBe(true);
  });

  it('si se elimina la última que sonaba, pasa a la anterior', () => {
    const { store } = setup();
    const last = store.list.getAt(11) as Song;
    const previous = store.list.getAt(10) as Song;
    store.playSong(last.id);
    store.removeSong(last.id);
    expect(store.nowPlaying?.id).toBe(previous.id);
  });

  it('si no queda ninguna, no hay canción actual y el motor se detiene', () => {
    const { store, engine } = setup();
    store.clearList();
    store.addSong(sample, { at: 'end' });
    store.play();
    store.removeSong((store.nowPlaying as Song).id);
    expect(store.nowPlaying).toBeNull();
    expect(store.isPlaying).toBe(false);
    expect(engine.calls.at(-1)).toBe('stop');
  });

  it('rechaza un id que no existe', () => {
    const { store } = setup();
    expect(store.removeSong('nope').ok).toBe(false);
  });
});

describe('adelantar y retroceder', () => {
  it('play empieza por la primera y next avanza', () => {
    const { store, engine } = setup();
    store.play();
    expect(store.nowPlaying?.title).toBe("Hips Don't Lie");
    expect(engine.autoplay).toBe(true);
    store.next();
    expect(store.nowPlaying?.title).toBe('Waka Waka (This Time for Africa)');
    store.previous();
    expect(store.nowPlaying?.title).toBe("Hips Don't Lie");
  });

  it('anterior reinicia la canción si ya pasaron más de 3 segundos', () => {
    const { store, engine } = setup();
    store.play();
    store.next();
    store.onTime(10, 200);
    store.previous();
    expect(store.nowPlaying?.title).toBe('Waka Waka (This Time for Africa)');
    expect(engine.calls.at(-1)).toBe('seek:0');
  });

  it('en la última con repetir apagado no avanza; al terminar sola se detiene', () => {
    const { store } = setup();
    const last = store.list.getAt(11) as Song;
    store.playSong(last.id);
    store.next();
    expect(store.nowPlaying?.id).toBe(last.id);
    store.onEnded();
    expect(store.isPlaying).toBe(false);
  });

  it('en la última con repetir todo vuelve a la primera', () => {
    const { store } = setup();
    store.cycleRepeat();
    store.playSong((store.list.getAt(11) as Song).id);
    store.onEnded();
    expect(store.list.currentIndex()).toBe(0);
    expect(store.isPlaying).toBe(true);
  });

  it('en la primera con repetir todo, anterior salta a la última', () => {
    const { store } = setup();
    store.cycleRepeat();
    store.play();
    store.previous();
    expect(store.list.currentIndex()).toBe(11);
  });

  it('repetir una: al terminar suena la misma; con el botón siguiente sí avanza', () => {
    const { store, engine } = setup();
    store.cycleRepeat();
    store.cycleRepeat();
    expect(store.repeat).toBe('one');
    store.play();
    const loadsBefore = engine.calls.filter((call) => call.startsWith('load')).length;
    store.onEnded();
    expect(store.list.currentIndex()).toBe(0);
    expect(engine.calls.filter((call) => call.startsWith('load')).length).toBe(loadsBefore + 1);
    store.next();
    expect(store.list.currentIndex()).toBe(1);
  });

  it('al terminar una canción pasa sola a la siguiente', () => {
    const { store } = setup();
    store.play();
    store.onEnded();
    expect(store.list.currentIndex()).toBe(1);
    expect(store.isPlaying).toBe(true);
  });

  it('pausa y reanuda', () => {
    const { store, engine } = setup();
    store.play();
    store.togglePlay();
    expect(store.isPlaying).toBe(false);
    expect(engine.calls.at(-1)).toBe('pause');
    store.togglePlay();
    expect(engine.calls.at(-1)).toBe('play');
  });

  it('con la lista vacía, play no falla', () => {
    const { store } = setup();
    store.clearList();
    store.play();
    store.next();
    store.previous();
    expect(store.nowPlaying).toBeNull();
    expect(store.isPlaying).toBe(false);
  });
});

describe('aleatorio y cola', () => {
  it('aleatorio salta a otra posición y anterior vuelve por el historial', () => {
    const { store } = setup(() => 0.5);
    store.play();
    store.toggleShuffle();
    store.next();
    expect(store.list.currentIndex()).toBe(6);
    store.next();
    expect(store.list.currentIndex()).toBe(7);
    store.previous();
    expect(store.list.currentIndex()).toBe(6);
    store.previous();
    expect(store.list.currentIndex()).toBe(0);
  });

  it('la cola "a continuación" suena primero, en orden de llegada', () => {
    const { store } = setup();
    store.play();
    const fifth = store.list.getAt(4) as Song;
    const ninth = store.list.getAt(8) as Song;
    store.enqueue(fifth.id);
    store.enqueue(ninth.id);
    store.next();
    expect(store.nowPlaying?.id).toBe(fifth.id);
    expect(store.list.currentIndex()).toBe(0);
    store.next();
    expect(store.nowPlaying?.id).toBe(ninth.id);
    store.next();
    expect(store.list.currentIndex()).toBe(1);
    expect(store.queuedSong).toBeNull();
  });

  it('se puede quitar una canción de la cola', () => {
    const { store } = setup();
    store.enqueue((store.list.getAt(2) as Song).id);
    const queued = store.upNext.toArray()[0];
    store.removeFromQueue(queued?.id ?? '');
    expect(store.upNext.isEmpty()).toBe(true);
  });
});

describe('reordenar y deshacer', () => {
  it('subir, bajar y mover cambian el orden y se pueden deshacer', () => {
    const { store } = setup();
    const before = titles(store);
    const second = store.list.getAt(1) as Song;
    expect(store.moveUp(second.id)).toBe(true);
    expect(titles(store)[0]).toBe(second.title);
    expect(store.moveDown(second.id)).toBe(true);
    expect(titles(store)).toEqual(before);
    expect(store.moveTo(0, 5)).toBe(true);
    expect(titles(store)[5]).toBe(before[0]);
    store.undo();
    expect(titles(store)).toEqual(before);
    store.undo();
    store.undo();
    expect(titles(store)).toEqual(before);
    expect(store.canUndo).toBe(false);
    expect(store.list.isConsistent()).toBe(true);
  });

  it('no mueve fuera de los límites', () => {
    const { store } = setup();
    expect(store.moveUp((store.list.getAt(0) as Song).id)).toBe(false);
    expect(store.moveDown((store.list.getAt(11) as Song).id)).toBe(false);
    expect(store.moveTo(0, 99)).toBe(false);
    expect(store.moveTo(3, 3)).toBe(false);
    expect(store.canUndo).toBe(false);
  });

  it('una operación nueva vacía la pila de rehacer', () => {
    const { store } = setup();
    store.addSong(sample, { at: 'end' });
    store.undo();
    expect(store.canRedo).toBe(true);
    store.addSong(sample, { at: 'start' });
    expect(store.canRedo).toBe(false);
  });

  it('ordenar por ritmo conserva la canción que suena y se puede deshacer', () => {
    const { store, engine } = setup();
    const before = titles(store);
    store.playSong((store.list.getAt(3) as Song).id);
    const playing = store.nowPlaying as Song;
    const loads = engine.calls.length;
    store.sortBy('bpm');
    const bpms = store.list.toArray().map((song) => song.bpm ?? 999);
    expect(bpms).toEqual([...bpms].sort((a, b) => a - b));
    expect(store.nowPlaying?.id).toBe(playing.id);
    expect(engine.calls.length).toBe(loads);
    store.undo();
    expect(titles(store)).toEqual(before);
  });

  it('restaurar vuelve a las canciones iniciales y se puede deshacer', () => {
    const { store } = setup();
    store.addSong(sample, { at: 'start' });
    store.restoreSeed();
    expect(store.list.size).toBe(12);
    store.undo();
    expect(store.list.size).toBe(13);
  });
});

describe('favoritas, volumen y temporizador', () => {
  it('marca y desmarca favoritas', () => {
    const { store } = setup();
    const first = store.list.getAt(0) as Song;
    store.toggleFavorite(first.id);
    expect(store.list.getAt(0)?.favorite).toBe(true);
    store.toggleFavorite(first.id);
    expect(store.list.getAt(0)?.favorite).toBe(false);
  });

  it('el volumen se limita a 0-100 y silenciar no lo pierde', () => {
    const { store, engine } = setup();
    store.setVolume(140);
    expect(store.volume).toBe(100);
    store.setVolume(-5);
    expect(store.volume).toBe(0);
    store.setVolume(35);
    store.toggleMute();
    expect(store.muted).toBe(true);
    expect(engine.calls.at(-1)).toBe('volume:35:true');
  });

  it('el temporizador "al terminar la canción" detiene la música', () => {
    const { store } = setup();
    store.play();
    store.setSleep('song');
    store.onEnded();
    expect(store.isPlaying).toBe(false);
    expect(store.list.currentIndex()).toBe(0);
    expect(store.sleep).toBeNull();
  });

  it('el temporizador por minutos detiene la música cuando vence', () => {
    let clock = 0;
    const store = new PlayerStore({ now: () => clock });
    store.attachEngine(new FakeEngine());
    store.play();
    store.setSleep(5);
    clock = 4 * 60_000;
    store.onTime(1, 200);
    expect(store.isPlaying).toBe(true);
    clock = 5 * 60_000;
    store.onTime(2, 200);
    expect(store.isPlaying).toBe(false);
  });
});

describe('motor y errores', () => {
  it('corrige la duración con la real del video', () => {
    const { store } = setup();
    store.play();
    store.onTime(1, 230);
    expect(store.list.getAt(0)?.duration).toBe(230);
  });

  it('si un video no se puede reproducir, salta al siguiente', () => {
    const { store } = setup();
    store.play();
    store.onError('blocked');
    expect(store.list.currentIndex()).toBe(1);
    expect(store.isPlaying).toBe(true);
  });

  it('si el video bloqueado es el último, se detiene', () => {
    const { store } = setup();
    store.playSong((store.list.getAt(11) as Song).id);
    store.onError('blocked');
    expect(store.isPlaying).toBe(false);
  });

  it('acumula lo escuchado para el resumen', () => {
    const { store } = setup();
    store.play();
    store.onTime(1, 200);
    store.onTime(2, 200);
    const entry = Object.values(store.stats)[0];
    expect(entry?.plays).toBe(1);
    expect(entry?.seconds).toBeCloseTo(2);
  });
});

describe('persistencia', () => {
  it('guarda y recupera lista, canción actual, perfil y ajustes', () => {
    const storage = memoryStorage();
    const first = new PlayerStore({ storage });
    first.login('  Nicky  ');
    first.addSong(sample, { at: 'start' });
    first.playSong((first.list.getAt(3) as Song).id);
    first.cycleRepeat();
    first.setVolume(42);
    first.setTheme('light');

    const second = new PlayerStore({ storage });
    expect(second.profileName).toBe('Nicky');
    expect(second.list.size).toBe(13);
    expect(second.list.getAt(0)?.title).toBe('Canción nueva');
    expect(second.list.currentIndex()).toBe(3);
    expect(second.repeat).toBe('all');
    expect(second.volume).toBe(42);
    expect(second.theme).toBe('light');
    expect(second.isPlaying).toBe(false);
    expect(second.list.isConsistent()).toBe(true);
  });

  it('ignora datos dañados y usa la lista inicial', () => {
    const storage = memoryStorage();
    storage.setItem('rep-naick:v1', '{esto no es json');
    expect(new PlayerStore({ storage }).list.size).toBe(12);
  });

  it('exporta e importa la lista en JSON', () => {
    const { store } = setup();
    store.addSong(sample, { at: 'end' });
    const text = store.exportJson();
    store.clearList();
    expect(store.importJson(text).ok).toBe(true);
    expect(store.list.size).toBe(13);
    expect(store.importJson('no es json').ok).toBe(false);
    expect(store.importJson('{"songs":[{"title":""}]}').ok).toBe(false);
  });

  it('el perfil valida el nombre', () => {
    const { store } = setup();
    expect(store.login('a').ok).toBe(false);
    expect(store.login('Nicky').ok).toBe(true);
    store.logout();
    expect(store.profileName).toBeNull();
  });
});
