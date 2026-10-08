import type { OperationReport } from '../lib/DoublyLinkedList';

/** Una canción de la lista. Es el valor que guarda cada nodo. */
export interface Song {
  /** Identificador único del nodo dentro de la app. */
  id: string;
  /** Id del video de YouTube. Vacío si la canción se agregó a mano (reproducción simulada). */
  videoId: string;
  title: string;
  artist: string;
  album: string;
  /** Duración en segundos. */
  duration: number;
  genre: string;
  /** Ritmo aproximado en pulsos por minuto (null si no se conoce). */
  bpm: number | null;
  favorite: boolean;
}

/** Datos que pide el formulario para crear una canción. */
export type NewSong = Pick<Song, 'title' | 'artist' | 'duration'> &
  Partial<Pick<Song, 'album' | 'videoId' | 'genre' | 'bpm'>>;

/** Dónde insertar: al inicio, al final o en una posición (base 0). */
export type Placement = { at: 'start' } | { at: 'end' } | { at: 'index'; index: number } | { at: 'afterCurrent' };

export type Theme = 'dark' | 'light';

/** Una línea de la consola de operaciones. */
export interface LogEntry extends OperationReport {
  id: string;
  time: number;
}

/** Recorrido que la interfaz anima sobre el visualizador de nodos. */
export interface Trace {
  key: number;
  from: 'head' | 'tail' | null;
  steps: number;
  operation: string;
}

/** Aviso temporal en la parte baja de la pantalla. */
export interface Toast {
  id: string;
  message: string;
  /** Si es true, el aviso ofrece el botón "Deshacer". */
  undoable: boolean;
}

/** Lo escuchado de una canción, para la vista "Tu resumen". */
export interface StatEntry {
  title: string;
  artist: string;
  genre: string;
  bpm: number | null;
  seconds: number;
  plays: number;
}

/** Temporizador de apagado: a una hora concreta o al terminar la canción. */
export type SleepTimer = { mode: 'time'; endsAt: number } | { mode: 'song' } | null;

/** Resultado de una acción que puede fallar por validación. */
export interface ActionResult {
  ok: boolean;
  message: string;
}

/** Motor de reproducción: el reproductor de YouTube o el temporizador simulado. */
export interface PlaybackEngine {
  load(song: Song, autoplay: boolean): void;
  play(): void;
  pause(): void;
  seek(seconds: number): void;
  setVolume(volume: number, muted: boolean): void;
  stop(): void;
}

export type EngineError = 'blocked' | 'not_found' | 'unknown';

/** Lo que el motor le avisa al reproductor. */
export interface EngineEvents {
  onTime(position: number, duration: number): void;
  onEnded(): void;
  onError(reason: EngineError): void;
  onPlayingChange(playing: boolean): void;
}
