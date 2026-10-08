import { DoublyLinkedList, type RepeatMode } from '../lib/DoublyLinkedList';
import { Queue } from '../lib/Queue';
import { Stack } from '../lib/Stack';
import { initialSongs } from './seed';
import type {
  ActionResult,
  EngineError,
  EngineEvents,
  LogEntry,
  NewSong,
  Placement,
  PlaybackEngine,
  SleepTimer,
  Song,
  StatEntry,
  Theme,
  Toast,
  Trace,
} from './types';

const STORAGE_KEY = 'rep-naick:v1';
/** Segundos tras los cuales "anterior" reinicia la canción en vez de retroceder. */
const RESTART_THRESHOLD = 3;

type StorageLike = Pick<Storage, 'getItem' | 'setItem'>;

export interface StoreOptions {
  storage?: StorageLike | null;
  /** Generador de números en [0, 1). Las pruebas lo reemplazan para que el azar sea predecible. */
  random?: () => number;
  now?: () => number;
  prefersLight?: boolean;
}

/** Una operación que se puede deshacer: guarda cómo aplicarla y cómo revertirla. */
interface UndoCommand {
  label: string;
  undo(): void;
  redo(): void;
}

/** Canción en la cola "Reproducir a continuación". */
export interface QueuedSong {
  id: string;
  song: Song;
}

export type SortKey = 'bpm' | 'genre' | 'title' | 'artist' | 'duration';

/**
 * REPRODUCTOR
 *
 * Guarda todo el estado de la app alrededor de UNA lista doblemente enlazada (`list`), cuyo
 * puntero `current` es la canción que suena. A su lado trabajan tres estructuras construidas
 * sobre la misma lista doble:
 *   - `upNext`  (cola FIFO): "Reproducir a continuación".
 *   - `history` (pila LIFO): lo escuchado; el modo aleatorio la usa para retroceder.
 *   - pilas de deshacer y rehacer: cada entrada guarda la operación y su inversa.
 *
 * La interfaz se suscribe con `subscribe` y solo lee; nunca toca los nodos.
 */
export class PlayerStore implements EngineEvents {
  list: DoublyLinkedList<Song>;
  readonly upNext = new Queue<QueuedSong>(50);
  readonly history = new Stack<Song>(30);
  readonly log = new Queue<LogEntry>(50);
  readonly toasts = new Queue<Toast>(3);
  private readonly undoStack = new Stack<UndoCommand>(25);
  private readonly redoStack = new Stack<UndoCommand>(25);

  profileName: string | null = null;
  theme: Theme;
  isPlaying = false;
  repeat: RepeatMode = 'off';
  shuffle = false;
  volume = 80;
  muted = false;
  /** Canción que suena sacada de la cola (no es un nodo de la lista). */
  queuedSong: Song | null = null;
  sleep: SleepTimer = null;
  trace: Trace | null = null;
  stats: Record<string, StatEntry> = {};
  /** true cuando lo que suena usa el temporizador simulado en vez del video de YouTube. */
  simulated = false;
  /** Segundos transcurridos y duración de lo que suena. Cambian varias veces por segundo. */
  position = 0;
  duration = 0;

  private engine: PlaybackEngine | null = null;
  private version = 0;
  private counter = 0;
  private consecutiveErrors = 0;
  private unsavedSeconds = 0;
  private readonly listeners = new Set<() => void>();
  private readonly progressListeners = new Set<() => void>();
  private readonly storage: StorageLike | null;
  private readonly random: () => number;
  private readonly now: () => number;

  constructor(options: StoreOptions = {}) {
    this.storage = options.storage ?? null;
    this.random = options.random ?? Math.random;
    this.now = options.now ?? Date.now;
    this.theme = options.prefersLight ? 'light' : 'dark';
    this.list = DoublyLinkedList.from(initialSongs());
    this.load();
  }

  // ───────────────────────── Suscripción ─────────────────────────

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  getVersion = (): number => this.version;

  /** Canal aparte para el progreso, así la barra de tiempo no repinta toda la app. */
  subscribeProgress = (listener: () => void): (() => void) => {
    this.progressListeners.add(listener);
    return () => this.progressListeners.delete(listener);
  };

  getPosition = (): number => this.position;

  private emit(): void {
    this.version++;
    this.save();
    this.listeners.forEach((listener) => listener());
  }

  private emitProgress(): void {
    this.progressListeners.forEach((listener) => listener());
  }

  // ───────────────────────── Lectura ─────────────────────────

  /** Lo que suena ahora: la canción sacada de la cola o la del puntero `current`. */
  get nowPlaying(): Song | null {
    return this.queuedSong ?? this.list.current?.value ?? null;
  }

  get canUndo(): boolean {
    return !this.undoStack.isEmpty();
  }

  get canRedo(): boolean {
    return !this.redoStack.isEmpty();
  }

  get undoLabel(): string | null {
    return this.undoStack.peek()?.label ?? null;
  }

  get redoLabel(): string | null {
    return this.redoStack.peek()?.label ?? null;
  }

  /** Etiquetas de las pilas de deshacer y rehacer, del tope al fondo (para pintarlas). */
  undoLabels(): string[] {
    return this.undoStack.toArray().map((command) => command.label);
  }

  redoLabels(): string[] {
    return this.redoStack.toArray().map((command) => command.label);
  }

  private nextId(prefix: string): string {
    this.counter++;
    return `${prefix}-${this.now().toString(36)}-${this.counter}`;
  }

  // ───────────────────────── Perfil y apariencia ─────────────────────────

  login(name: string): ActionResult {
    const clean = name.trim().replace(/\s+/g, ' ');
    if (clean.length < 2 || clean.length > 30) {
      return { ok: false, message: 'Escribe un nombre de 2 a 30 caracteres.' };
    }
    this.profileName = clean;
    this.emit();
    return { ok: true, message: `Hola, ${clean}.` };
  }

  logout(): void {
    this.pause();
    this.profileName = null;
    this.emit();
  }

  setTheme(theme: Theme): void {
    this.theme = theme;
    this.emit();
  }

  // ───────────────────────── Avisos y consola ─────────────────────────

  toast(message: string, undoable = false): void {
    this.toasts.enqueue({ id: this.nextId('toast'), message, undoable });
    this.emit();
  }

  dismissToast(id: string): void {
    if (this.toasts.removeById(id) !== null) this.emit();
  }

  /** Anota en la consola la última operación de la lista y prepara su animación. */
  private record(): void {
    const operation = this.list.lastOperation;
    if (operation === null) return;
    this.log.enqueue({ ...operation, id: this.nextId('log'), time: this.now() });
    this.trace = { key: this.counter, from: operation.from, steps: operation.steps, operation: operation.operation };
  }

  /** Ejecuta una operación y la deja en la pila de deshacer. Rehacer se vacía. */
  private run(command: UndoCommand): void {
    command.redo();
    this.undoStack.push(command);
    this.redoStack.clear();
  }

  // ───────────────────────── Agregar, eliminar y mover ─────────────────────────

  /** Valida los datos y agrega la canción al inicio, al final o en una posición. */
  addSong(input: NewSong, placement: Placement): ActionResult {
    const title = input.title.trim();
    const artist = input.artist.trim();
    const album = (input.album ?? '').trim();
    const videoId = (input.videoId ?? '').trim();
    if (title.length === 0 || title.length > 120) return { ok: false, message: 'El título es obligatorio (máximo 120 caracteres).' };
    if (artist.length === 0 || artist.length > 120) return { ok: false, message: 'El artista es obligatorio (máximo 120 caracteres).' };
    if (album.length > 120) return { ok: false, message: 'El álbum admite máximo 120 caracteres.' };
    const durationUnknown = videoId !== '' && input.duration === 0;
    if (!durationUnknown && (!Number.isFinite(input.duration) || input.duration < 1 || input.duration > 36_000)) {
      return { ok: false, message: 'La duración debe estar entre 0:01 y 10 horas.' };
    }

    let index: number;
    if (placement.at === 'start') index = 0;
    else if (placement.at === 'end') index = this.list.size;
    else if (placement.at === 'afterCurrent') index = this.list.current === null ? this.list.size : this.list.currentIndex() + 1;
    else index = placement.index;
    if (!Number.isInteger(index) || index < 0 || index > this.list.size) {
      return { ok: false, message: `La posición debe estar entre 1 y ${this.list.size + 1}.` };
    }

    const song: Song = {
      id: this.nextId('song'),
      videoId,
      title,
      artist,
      album,
      duration: Math.round(input.duration),
      genre: input.genre?.trim() || 'Otro',
      bpm: input.bpm ?? null,
      favorite: false,
    };
    this.run({
      label: `Agregar "${title}"`,
      redo: () => {
        const target = Math.min(index, this.list.size);
        if (target === 0) this.list.addFirst(song);
        else if (target === this.list.size) this.list.addLast(song);
        else this.list.insertAt(target, song);
        this.record();
      },
      undo: () => {
        this.list.removeById(song.id);
        this.record();
        this.syncEngine();
      },
    });
    this.emit();
    return { ok: true, message: `Agregada "${title}" en la posición ${index + 1}.` };
  }

  /** Elimina una canción. Si era la que sonaba, la lista ya movió `current` a la vecina. */
  removeSong(id: string): ActionResult {
    const index = this.list.indexOf(id);
    const song = this.list.getAt(index);
    if (song === null) return { ok: false, message: 'Esa canción ya no está en la lista.' };
    this.run({
      label: `Eliminar "${song.title}"`,
      redo: () => {
        this.list.removeById(id);
        this.record();
        this.syncEngine();
      },
      undo: () => {
        this.list.insertAt(Math.min(index, this.list.size), song);
        this.record();
      },
    });
    this.toast(`Eliminada "${song.title}".`, true);
    return { ok: true, message: `Eliminada "${song.title}".` };
  }

  moveUp(id: string): boolean {
    const index = this.list.indexOf(id);
    if (index <= 0) return false;
    this.run({
      label: 'Subir una posición',
      redo: () => {
        this.list.moveUp(index);
        this.record();
      },
      undo: () => {
        this.list.moveDown(index - 1);
        this.record();
      },
    });
    this.emit();
    return true;
  }

  moveDown(id: string): boolean {
    const index = this.list.indexOf(id);
    if (index === -1 || index >= this.list.size - 1) return false;
    this.run({
      label: 'Bajar una posición',
      redo: () => {
        this.list.moveDown(index);
        this.record();
      },
      undo: () => {
        this.list.moveUp(index + 1);
        this.record();
      },
    });
    this.emit();
    return true;
  }

  /** Mueve una canción de una posición a otra (arrastrar y soltar). */
  moveTo(from: number, to: number): boolean {
    const size = this.list.size;
    const valid = (index: number): boolean => Number.isInteger(index) && index >= 0 && index < size;
    if (!valid(from) || !valid(to) || from === to) return false;
    this.run({
      label: `Mover de la posición ${from + 1} a la ${to + 1}`,
      redo: () => {
        this.list.moveTo(from, to);
        this.record();
      },
      undo: () => {
        this.list.moveTo(to, from);
        this.record();
      },
    });
    this.emit();
    return true;
  }

  toggleFavorite(id: string): void {
    if (this.list.update(id, (song) => ({ ...song, favorite: !song.favorite })) !== null) this.emit();
  }

  // ───────────────────────── Cambios de toda la lista ─────────────────────────

  /**
   * Cambia la lista entera por otra. Deshacer es O(1): se guarda la lista anterior completa
   * (con sus nodos y su puntero `current`) y basta con volver a apuntar a ella.
   */
  private replaceList(next: DoublyLinkedList<Song>, label: string): void {
    const previous = this.list;
    this.run({
      label,
      redo: () => {
        this.list = next;
        this.queuedSong = null;
        this.syncEngine();
      },
      undo: () => {
        this.list = previous;
        this.queuedSong = null;
        this.syncEngine();
      },
    });
  }

  /** Vuelve a las canciones iniciales. */
  restoreSeed(): void {
    this.replaceList(DoublyLinkedList.from(initialSongs()), 'Restaurar canciones iniciales');
    this.toast('Lista restaurada con las canciones iniciales.', true);
  }

  clearList(): void {
    if (this.list.isEmpty()) return;
    this.replaceList(new DoublyLinkedList<Song>(), 'Vaciar la lista');
    this.toast('La lista quedó vacía.', true);
  }

  /** Ordena una copia de la lista (por inserción, moviendo nodos) y la pone en su lugar. */
  sortBy(key: SortKey, descending = false): void {
    if (this.list.size < 2) return;
    const sorted = this.list.clone();
    const direction = descending ? -1 : 1;
    sorted.sort((a, b) => {
      if (key === 'bpm') return ((a.bpm ?? 999) - (b.bpm ?? 999)) * direction;
      if (key === 'duration') return (a.duration - b.duration) * direction;
      return a[key].localeCompare(b[key], 'es') * direction || (a.bpm ?? 999) - (b.bpm ?? 999);
    });
    const labels: Record<SortKey, string> = { bpm: 'ritmo', genre: 'género', title: 'título', artist: 'artista', duration: 'duración' };
    this.replaceList(sorted, `Ordenar por ${labels[key]}`);
    const operation = sorted.lastOperation;
    if (operation !== null) {
      this.log.enqueue({ ...operation, id: this.nextId('log'), time: this.now() });
    }
    this.toast(`Lista ordenada por ${labels[key]}.`, true);
  }

  /** Texto JSON con la lista, para descargarla. */
  exportJson(): string {
    return JSON.stringify({ format: 'rep-naick', version: 1, songs: this.list.toArray() }, null, 2);
  }

  /** Reemplaza la lista con la de un archivo exportado. */
  importJson(text: string): ActionResult {
    let data: unknown;
    try {
      data = JSON.parse(text);
    } catch {
      return { ok: false, message: 'El archivo no es un JSON válido.' };
    }
    const raw = typeof data === 'object' && data !== null && 'songs' in data ? (data as { songs: unknown }).songs : null;
    if (!Array.isArray(raw)) return { ok: false, message: 'El archivo no tiene una lista de canciones.' };
    const next = new DoublyLinkedList<Song>();
    for (const item of raw) {
      // Al importar siempre se asignan ids nuevos, para que no choquen con los existentes.
      const song = sanitizeSong(item, '');
      if (song !== null) next.addLast({ ...song, id: this.nextId('song') });
    }
    if (next.isEmpty()) return { ok: false, message: 'El archivo no tiene canciones válidas.' };
    this.replaceList(next, 'Importar lista');
    this.toast(`Importadas ${next.size} canciones.`, true);
    return { ok: true, message: `Importadas ${next.size} canciones.` };
  }

  // ───────────────────────── Deshacer y rehacer ─────────────────────────

  undo(): void {
    const command = this.undoStack.pop();
    if (command === null) {
      this.toast('No hay nada que deshacer.');
      return;
    }
    command.undo();
    this.redoStack.push(command);
    this.toast(`Deshecho: ${command.label}.`);
  }

  redo(): void {
    const command = this.redoStack.pop();
    if (command === null) {
      this.toast('No hay nada que rehacer.');
      return;
    }
    command.redo();
    this.undoStack.push(command);
    this.toast(`Rehecho: ${command.label}.`);
  }

  // ───────────────────────── Reproducción ─────────────────────────

  /** Conecta (o desconecta) el motor que de verdad hace sonar la música. */
  attachEngine(engine: PlaybackEngine | null): void {
    this.engine = engine;
    if (engine === null) {
      this.isPlaying = false;
      return;
    }
    engine.setVolume(this.volume, this.muted);
    const song = this.nowPlaying;
    if (song !== null) {
      this.loadedId = song.id;
      this.duration = song.duration;
      engine.load(song, false);
    }
  }

  /** El motor avisa si la canción actual suena con YouTube o con el temporizador simulado. */
  setSimulated = (simulated: boolean): void => {
    if (this.simulated === simulated) return;
    this.simulated = simulated;
    this.emit();
  };

  private loadedId: string | null = null;

  /**
   * Hace que el motor refleje la canción actual: si cambió, carga la nueva; si ya no hay
   * ninguna, se detiene. Se llama después de cualquier operación que pueda mover `current`.
   */
  private syncEngine(force = false): void {
    const song = this.nowPlaying;
    if (song === null) {
      this.loadedId = null;
      this.isPlaying = false;
      this.position = 0;
      this.duration = 0;
      this.engine?.stop();
      this.emitProgress();
      return;
    }
    if (!force && song.id === this.loadedId) return;
    this.loadedId = song.id;
    this.position = 0;
    this.duration = song.duration;
    this.engine?.load(song, this.isPlaying);
    this.emitProgress();
  }

  /** Empieza a sonar lo que marque `nowPlaying` y anota la canción anterior en el historial. */
  private startTrack(previous: Song | null, keepHistory = true): void {
    const song = this.nowPlaying;
    if (song === null) return;
    if (keepHistory && previous !== null && previous.id !== song.id) this.history.push(previous);
    this.isPlaying = true;
    const key = song.videoId || song.id;
    const entry = this.stats[key] ?? { title: song.title, artist: song.artist, genre: song.genre, bpm: song.bpm, seconds: 0, plays: 0 };
    this.stats[key] = { ...entry, plays: entry.plays + 1 };
    this.syncEngine(true);
    this.emit();
  }

  /** Reproduce una canción concreta de la lista (al tocar una fila). */
  playSong(id: string): void {
    const previous = this.nowPlaying;
    this.queuedSong = null;
    if (this.list.setCurrentById(id) === null) return;
    this.record();
    this.startTrack(previous);
  }

  play(): void {
    if (this.nowPlaying === null) {
      if (this.list.isEmpty()) {
        this.toast('La lista está vacía. Agrega una canción para empezar.');
        return;
      }
      this.list.next();
      this.record();
      this.startTrack(null);
      return;
    }
    if (this.isPlaying) return;
    this.isPlaying = true;
    this.engine?.play();
    this.emit();
  }

  pause(): void {
    if (!this.isPlaying) return;
    this.isPlaying = false;
    this.engine?.pause();
    this.emit();
  }

  togglePlay(): void {
    if (this.isPlaying) this.pause();
    else this.play();
  }

  /**
   * Adelanta. Primero sale el frente de la cola "A continuación"; si está vacía, en modo
   * aleatorio salta a otra posición y, si no, sigue el puntero `next` de la lista.
   * `auto` indica que la canción terminó sola: ahí aplican "repetir una" y el temporizador.
   */
  next(auto = false): void {
    const previous = this.nowPlaying;
    if (auto && this.sleep?.mode === 'song') {
      this.sleep = null;
      this.isPlaying = false;
      this.engine?.pause();
      this.toast('Temporizador: la música se detuvo al terminar la canción.');
      return;
    }
    if (auto && this.repeat === 'one' && previous !== null) {
      this.startTrack(previous, false);
      return;
    }

    const queued = this.upNext.dequeue();
    if (queued !== null) {
      this.queuedSong = queued.song;
      this.startTrack(previous);
      return;
    }

    const wasQueued = this.queuedSong !== null;
    const mode: RepeatMode = this.repeat === 'off' ? 'off' : 'all';
    let song: Song | null;
    if (this.shuffle && this.list.size > 1) {
      let index = Math.min(this.list.size - 1, Math.floor(this.random() * this.list.size));
      if (index === this.list.currentIndex()) index = (index + 1) % this.list.size;
      song = this.list.setCurrentAt(index);
    } else {
      song = this.list.next(mode);
    }
    this.record();

    if (song === null) {
      if (this.list.isEmpty()) {
        this.toast('La lista está vacía.');
        return;
      }
      if (wasQueued) {
        // Sonaba una canción de la cola y no hay más lista: se vuelve al nodo actual, en pausa.
        this.queuedSong = null;
        this.isPlaying = false;
        this.syncEngine(true);
        this.emit();
        return;
      }
      if (auto) {
        this.isPlaying = false;
        this.engine?.pause();
        this.toast('Fin de la lista.');
      } else {
        this.toast('Es la última canción. Activa repetir para volver al inicio.');
      }
      return;
    }
    this.queuedSong = null;
    this.startTrack(previous);
  }

  /**
   * Retrocede por el puntero `prev`. Si la canción lleva más de 3 s, la reinicia.
   * En modo aleatorio vuelve a lo último escuchado sacándolo de la pila de historial.
   */
  previous(): void {
    const current = this.nowPlaying;
    if (current !== null && this.position > RESTART_THRESHOLD) {
      this.seek(0);
      return;
    }
    if (this.queuedSong !== null && this.list.current !== null) {
      this.queuedSong = null;
      this.startTrack(current, false);
      return;
    }
    if (this.shuffle) {
      let recent = this.history.pop();
      while (recent !== null && this.list.indexOf(recent.id) === -1) recent = this.history.pop();
      if (recent !== null) {
        this.list.setCurrentById(recent.id);
        this.record();
        this.startTrack(current, false);
        return;
      }
    }
    const song = this.list.previous(this.repeat === 'off' ? 'off' : 'all');
    this.record();
    if (song === null) {
      if (current !== null) {
        this.seek(0);
        this.toast('Es la primera canción: se reinicia.');
      } else {
        this.toast('La lista está vacía.');
      }
      return;
    }
    this.startTrack(current);
  }

  seek(seconds: number): void {
    if (this.nowPlaying === null) return;
    const limit = this.duration > 0 ? this.duration : seconds;
    this.position = Math.max(0, Math.min(seconds, limit));
    this.engine?.seek(this.position);
    this.emitProgress();
  }

  toggleShuffle(): void {
    this.shuffle = !this.shuffle;
    this.emit();
  }

  /** Pasa por apagado, toda la lista y una canción. */
  cycleRepeat(): void {
    const order: Record<RepeatMode, RepeatMode> = { off: 'all', all: 'one', one: 'off' };
    this.repeat = order[this.repeat];
    this.emit();
  }

  setVolume(volume: number): void {
    this.volume = Math.max(0, Math.min(100, Math.round(volume)));
    this.muted = false;
    this.engine?.setVolume(this.volume, this.muted);
    this.emit();
  }

  toggleMute(): void {
    this.muted = !this.muted;
    this.engine?.setVolume(this.volume, this.muted);
    this.emit();
  }

  // ───────────────────────── Cola "A continuación" ─────────────────────────

  enqueue(id: string): void {
    const song = this.list.getAt(this.list.indexOf(id));
    if (song === null) return;
    this.upNext.enqueue({ id: this.nextId('queue'), song });
    this.toast(`"${song.title}" sonará a continuación.`);
  }

  removeFromQueue(queueId: string): void {
    if (this.upNext.removeById(queueId) !== null) this.emit();
  }

  // ───────────────────────── Temporizador de apagado ─────────────────────────

  setSleep(minutes: number | 'song' | null): void {
    if (minutes === null) this.sleep = null;
    else if (minutes === 'song') this.sleep = { mode: 'song' };
    else this.sleep = { mode: 'time', endsAt: this.now() + minutes * 60_000 };
    this.toast(
      minutes === null
        ? 'Temporizador cancelado.'
        : minutes === 'song'
          ? 'La música se detendrá al terminar esta canción.'
          : `La música se detendrá en ${minutes} min.`,
    );
  }

  private checkSleep(): void {
    if (this.sleep?.mode === 'time' && this.now() >= this.sleep.endsAt) {
      this.sleep = null;
      this.pause();
      this.toast('Temporizador: la música se detuvo.');
    }
  }

  // ───────────────────────── Avisos del motor ─────────────────────────

  onTime(position: number, duration: number): void {
    const song = this.nowPlaying;
    if (song === null) return;
    const delta = position - this.position;
    if (this.isPlaying && delta > 0 && delta < 2) {
      const key = song.videoId || song.id;
      const entry = this.stats[key];
      if (entry) entry.seconds += delta;
      this.unsavedSeconds += delta;
    }
    this.position = position;
    if (duration > 0) {
      this.duration = duration;
      // La duración real del video reemplaza a la aproximada guardada en el nodo.
      if (Math.abs(duration - song.duration) > 1 && this.queuedSong === null) {
        this.list.update(song.id, (value) => ({ ...value, duration: Math.round(duration) }));
        this.emit();
      }
    }
    if (this.unsavedSeconds > 10) {
      this.unsavedSeconds = 0;
      this.save();
    }
    this.emitProgress();
    this.checkSleep();
  }

  onEnded(): void {
    this.consecutiveErrors = 0;
    this.next(true);
  }

  onError(reason: EngineError): void {
    const song = this.nowPlaying;
    this.consecutiveErrors++;
    const title = song ? `"${song.title}"` : 'El video';
    const why = reason === 'blocked' ? 'su dueño no permite reproducirlo fuera de YouTube' : 'no está disponible';
    if (this.consecutiveErrors >= Math.max(1, this.list.size) || this.list.size <= 1) {
      this.isPlaying = false;
      this.engine?.pause();
      this.toast(`${title} no se puede reproducir: ${why}.`);
      return;
    }
    this.toast(`${title} no se puede reproducir: ${why}. Se salta a la siguiente.`);
    this.next(false);
    if (this.nowPlaying?.id === song?.id) {
      // No había a dónde saltar (última canción sin repetir): se detiene.
      this.isPlaying = false;
      this.engine?.pause();
      this.emit();
    }
  }

  onPlayingChange(playing: boolean): void {
    if (playing) this.consecutiveErrors = 0;
    if (this.isPlaying === playing) return;
    this.isPlaying = playing;
    this.emit();
  }

  // ───────────────────────── Persistencia (localStorage) ─────────────────────────

  /**
   * Guarda el estado. JSON no puede guardar punteros, así que aquí la lista se serializa
   * con `toArray()` y al cargar se reconstruye nodo por nodo con `addLast`.
   */
  private save(): void {
    if (this.storage === null) return;
    const data = {
      version: 1,
      profileName: this.profileName,
      theme: this.theme,
      songs: this.list.toArray(),
      currentId: this.list.current?.value.id ?? null,
      repeat: this.repeat,
      shuffle: this.shuffle,
      volume: this.volume,
      muted: this.muted,
      stats: this.stats,
    };
    try {
      this.storage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch {
      // Almacenamiento lleno o bloqueado: la app sigue funcionando sin guardar.
    }
  }

  private load(): void {
    if (this.storage === null) return;
    let data: Record<string, unknown>;
    try {
      const text = this.storage.getItem(STORAGE_KEY);
      if (text === null) return;
      const parsed: unknown = JSON.parse(text);
      if (typeof parsed !== 'object' || parsed === null) return;
      data = parsed as Record<string, unknown>;
    } catch {
      return;
    }
    if (typeof data.profileName === 'string') this.profileName = data.profileName;
    if (data.theme === 'light' || data.theme === 'dark') this.theme = data.theme;
    if (data.repeat === 'off' || data.repeat === 'all' || data.repeat === 'one') this.repeat = data.repeat;
    if (typeof data.shuffle === 'boolean') this.shuffle = data.shuffle;
    if (typeof data.volume === 'number') this.volume = Math.max(0, Math.min(100, data.volume));
    if (typeof data.muted === 'boolean') this.muted = data.muted;
    if (typeof data.stats === 'object' && data.stats !== null) this.stats = data.stats as Record<string, StatEntry>;
    if (Array.isArray(data.songs)) {
      const list = new DoublyLinkedList<Song>();
      for (const item of data.songs) {
        const song = sanitizeSong(item, this.nextId('song'));
        if (song !== null) list.addLast(song);
      }
      this.list = list;
      if (typeof data.currentId === 'string') this.list.setCurrentById(data.currentId);
    }
  }
}

/** Convierte un dato desconocido (de localStorage o de un archivo) en una canción válida, o null. */
function sanitizeSong(raw: unknown, fallbackId: string): Song | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const item = raw as Record<string, unknown>;
  const text = (value: unknown, max = 120): string => (typeof value === 'string' ? value.trim().slice(0, max) : '');
  const title = text(item.title);
  const artist = text(item.artist);
  const duration = typeof item.duration === 'number' && Number.isFinite(item.duration) ? Math.round(item.duration) : -1;
  const videoId = /^[\w-]{11}$/.test(text(item.videoId)) ? text(item.videoId) : '';
  if (title === '' || artist === '' || duration < 0 || duration > 36_000) return null;
  if (duration === 0 && videoId === '') return null;
  return {
    id: text(item.id, 80) || fallbackId,
    videoId,
    title,
    artist,
    album: text(item.album),
    duration,
    genre: text(item.genre, 40) || 'Otro',
    bpm: typeof item.bpm === 'number' && item.bpm > 0 && item.bpm < 400 ? Math.round(item.bpm) : null,
    favorite: item.favorite === true,
  };
}
