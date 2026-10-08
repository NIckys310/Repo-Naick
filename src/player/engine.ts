import type { EngineError, EngineEvents, PlaybackEngine, Song } from './types';

const TICK_MS = 250;

/**
 * Motor simulado: no suena nada, solo avanza un temporizador. Se usa para las canciones
 * agregadas a mano (sin video) y como respaldo si YouTube no carga.
 */
export class SimulatedEngine implements PlaybackEngine {
  private timer: ReturnType<typeof setInterval> | null = null;
  private position = 0;
  private duration = 0;

  constructor(private readonly events: EngineEvents) {}

  load(song: Song, autoplay: boolean): void {
    this.pause();
    this.position = 0;
    this.duration = song.duration > 0 ? song.duration : 180;
    this.events.onTime(0, this.duration);
    if (autoplay) this.play();
  }

  play(): void {
    if (this.timer !== null || this.duration === 0) return;
    this.timer = setInterval(() => {
      this.position += TICK_MS / 1000;
      if (this.position >= this.duration) {
        this.pause();
        this.events.onTime(this.duration, this.duration);
        this.events.onEnded();
        return;
      }
      this.events.onTime(this.position, this.duration);
    }, TICK_MS);
  }

  pause(): void {
    if (this.timer !== null) clearInterval(this.timer);
    this.timer = null;
  }

  seek(seconds: number): void {
    this.position = Math.max(0, Math.min(seconds, this.duration));
  }

  setVolume(): void {
    // El volumen es solo visual cuando no hay audio.
  }

  stop(): void {
    this.pause();
    this.position = 0;
    this.duration = 0;
  }
}

/** Parte mínima de la YouTube IFrame Player API que usa la app. */
interface YouTubePlayer {
  loadVideoById(videoId: string): void;
  cueVideoById(videoId: string): void;
  playVideo(): void;
  pauseVideo(): void;
  stopVideo(): void;
  seekTo(seconds: number, allowSeekAhead: boolean): void;
  setVolume(volume: number): void;
  mute(): void;
  unMute(): void;
  getCurrentTime(): number;
  getDuration(): number;
  getPlayerState(): number;
  destroy(): void;
}

interface YouTubeNamespace {
  Player: new (
    element: HTMLElement,
    options: {
      width: string;
      height: string;
      playerVars: Record<string, string | number>;
      events: {
        onReady: () => void;
        onStateChange: (event: { data: number }) => void;
        onError: (event: { data: number }) => void;
      };
    },
  ) => YouTubePlayer;
}

declare global {
  interface Window {
    YT?: YouTubeNamespace;
    onYouTubeIframeAPIReady?: () => void;
  }
}

const STATE = { ended: 0, playing: 1, paused: 2 } as const;
let apiPromise: Promise<YouTubeNamespace> | null = null;

/** Carga una sola vez el script oficial de YouTube. Falla si no responde en 10 s. */
function loadYouTubeApi(): Promise<YouTubeNamespace> {
  apiPromise ??= new Promise<YouTubeNamespace>((resolve, reject) => {
    if (window.YT?.Player) {
      resolve(window.YT);
      return;
    }
    const timeout = setTimeout(() => reject(new Error('timeout')), 10_000);
    window.onYouTubeIframeAPIReady = () => {
      clearTimeout(timeout);
      if (window.YT) resolve(window.YT);
    };
    const script = document.createElement('script');
    script.src = 'https://www.youtube.com/iframe_api';
    script.async = true;
    script.onerror = () => {
      clearTimeout(timeout);
      reject(new Error('blocked'));
    };
    document.head.append(script);
  });
  return apiPromise;
}

/**
 * Motor de YouTube: reproduce la canción completa con el reproductor oficial incrustado.
 * El video queda visible en la tornamesa, como piden las condiciones de uso de YouTube;
 * la app nunca descarga ni extrae el audio.
 */
export class YouTubeEngine implements PlaybackEngine {
  private player: YouTubePlayer | null = null;
  private ready = false;
  private pending: { song: Song; autoplay: boolean } | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private volume = 80;
  private muted = false;
  private destroyed = false;

  constructor(
    host: HTMLElement,
    private readonly events: EngineEvents,
    onUnavailable: () => void,
  ) {
    // YouTube reemplaza el elemento que recibe por su iframe: se le da un hijo desechable.
    const mount = document.createElement('div');
    host.replaceChildren(mount);
    loadYouTubeApi()
      .then((api) => {
        if (this.destroyed) return;
        this.player = new api.Player(mount, {
          width: '100%',
          height: '100%',
          playerVars: { controls: 0, rel: 0, playsinline: 1, modestbranding: 1, iv_load_policy: 3, origin: window.location.origin },
          events: {
            onReady: () => this.handleReady(),
            onStateChange: (event) => this.handleState(event.data),
            onError: (event) => this.events.onError(toEngineError(event.data)),
          },
        });
      })
      .catch(() => {
        if (!this.destroyed) onUnavailable();
      });
  }

  private handleReady(): void {
    this.ready = true;
    this.applyVolume();
    if (this.pending !== null) {
      const { song, autoplay } = this.pending;
      this.pending = null;
      this.load(song, autoplay);
    }
    this.timer = setInterval(() => {
      if (this.player?.getPlayerState() === STATE.playing) {
        this.events.onTime(this.player.getCurrentTime(), this.player.getDuration());
      }
    }, TICK_MS);
  }

  private handleState(state: number): void {
    if (state === STATE.ended) this.events.onEnded();
    else if (state === STATE.playing) this.events.onPlayingChange(true);
    else if (state === STATE.paused) this.events.onPlayingChange(false);
  }

  private applyVolume(): void {
    if (!this.ready || this.player === null) return;
    // Con volumen 0 se silencia de verdad. Y unMute() va ANTES de setVolume(): si va después,
    // YouTube restaura su volumen anterior y el deslizador parece no hacer nada.
    if (this.muted || this.volume === 0) {
      this.player.mute();
      return;
    }
    this.player.unMute();
    this.player.setVolume(this.volume);
  }

  load(song: Song, autoplay: boolean): void {
    if (!this.ready || this.player === null) {
      this.pending = { song, autoplay };
      return;
    }
    if (autoplay) this.player.loadVideoById(song.videoId);
    else this.player.cueVideoById(song.videoId);
  }

  play(): void {
    if (this.ready) this.player?.playVideo();
    else if (this.pending !== null) this.pending.autoplay = true;
  }

  pause(): void {
    if (this.ready) this.player?.pauseVideo();
    else if (this.pending !== null) this.pending.autoplay = false;
  }

  seek(seconds: number): void {
    if (this.ready) this.player?.seekTo(seconds, true);
  }

  setVolume(volume: number, muted: boolean): void {
    this.volume = volume;
    this.muted = muted;
    this.applyVolume();
  }

  stop(): void {
    this.pending = null;
    if (this.ready) this.player?.stopVideo();
  }

  destroy(): void {
    this.destroyed = true;
    if (this.timer !== null) clearInterval(this.timer);
    this.player?.destroy();
    this.player = null;
  }
}

/** Códigos de error de YouTube: 101 y 150 = el dueño no permite insertarlo; 100 = no existe. */
function toEngineError(code: number): EngineError {
  if (code === 101 || code === 150) return 'blocked';
  if (code === 100) return 'not_found';
  return 'unknown';
}

/**
 * Motor combinado: usa YouTube si la canción tiene video y el reproductor está disponible;
 * si no, usa el temporizador simulado. La app solo habla con este motor.
 */
export class HybridEngine implements PlaybackEngine {
  private readonly simulated: SimulatedEngine;
  private readonly youtube: YouTubeEngine | null;
  private youtubeFailed = false;
  private active: PlaybackEngine;
  private current: { song: Song; autoplay: boolean } | null = null;
  private volume = 80;
  private muted = false;

  constructor(
    host: HTMLElement,
    events: EngineEvents,
    private readonly onModeChange: (simulated: boolean) => void,
    options: { forceSimulated?: boolean; onFallback?: () => void } = {},
  ) {
    this.simulated = new SimulatedEngine(events);
    this.active = this.simulated;
    if (options.forceSimulated) {
      this.youtube = null;
      this.youtubeFailed = true;
      return;
    }
    this.youtube = new YouTubeEngine(host, events, () => {
      // YouTube no cargó (sin conexión o bloqueado): se sigue con la reproducción simulada.
      this.youtubeFailed = true;
      options.onFallback?.();
      if (this.current !== null) this.load(this.current.song, this.current.autoplay);
    });
  }

  private pick(song: Song): PlaybackEngine {
    return song.videoId !== '' && this.youtube !== null && !this.youtubeFailed ? this.youtube : this.simulated;
  }

  load(song: Song, autoplay: boolean): void {
    this.current = { song, autoplay };
    const next = this.pick(song);
    if (next !== this.active) this.active.stop();
    this.active = next;
    this.onModeChange(next === this.simulated);
    next.setVolume(this.volume, this.muted);
    next.load(song, autoplay);
  }

  play(): void {
    if (this.current !== null) this.current.autoplay = true;
    this.active.play();
  }

  pause(): void {
    if (this.current !== null) this.current.autoplay = false;
    this.active.pause();
  }

  seek(seconds: number): void {
    this.active.seek(seconds);
  }

  setVolume(volume: number, muted: boolean): void {
    this.volume = volume;
    this.muted = muted;
    this.active.setVolume(volume, muted);
  }

  stop(): void {
    this.current = null;
    this.active.stop();
  }

  destroy(): void {
    this.simulated.stop();
    this.youtube?.destroy();
  }
}
