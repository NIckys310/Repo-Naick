import { describe, expect, it } from 'vitest';
import {
  extractYouTubeId,
  formatTime,
  formatTotal,
  initials,
  memoryAddress,
  normalize,
  parseDuration,
  parseIsoDuration,
  splitArtists,
  splitVideoTitle,
} from '../format';

describe('tiempo', () => {
  it('formatTime da m:ss y h:mm:ss', () => {
    expect(formatTime(0)).toBe('0:00');
    expect(formatTime(218)).toBe('3:38');
    expect(formatTime(3725)).toBe('1:02:05');
    expect(formatTime(-4)).toBe('0:00');
    expect(formatTime(Number.NaN)).toBe('0:00');
  });

  it('formatTotal resume en minutos u horas', () => {
    expect(formatTotal(43 * 60)).toBe('43 min');
    expect(formatTotal(72 * 60)).toBe('1 h 12 min');
  });

  it('parseDuration acepta m:ss, h:mm:ss y segundos', () => {
    expect(parseDuration('3:38')).toBe(218);
    expect(parseDuration('1:02:05')).toBe(3725);
    expect(parseDuration('200')).toBe(200);
    expect(parseDuration('3:75')).toBeNull();
    expect(parseDuration('0:00')).toBeNull();
    expect(parseDuration('abc')).toBeNull();
    expect(parseDuration('')).toBeNull();
  });

  it('parseIsoDuration lee el formato de YouTube', () => {
    expect(parseIsoDuration('PT4M13S')).toBe(253);
    expect(parseIsoDuration('PT1H2M')).toBe(3720);
    expect(parseIsoDuration('PT45S')).toBe(45);
    expect(parseIsoDuration('nada')).toBe(0);
  });
});

describe('texto', () => {
  it('normalize ignora tildes y mayúsculas', () => {
    expect(normalize('  Reguetón ')).toBe('regueton');
  });

  it('initials toma las dos primeras palabras', () => {
    expect(initials("Hips Don't Lie")).toBe('HD');
    expect(initials('Despacito')).toBe('D');
    expect(initials('Waka Waka (This Time for Africa)')).toBe('WW');
    expect(initials('')).toBe('?');
  });

  it('memoryAddress es estable y tiene forma 0xXXXX', () => {
    expect(memoryAddress('abc')).toMatch(/^0x[0-9A-F]{4}$/);
    expect(memoryAddress('abc')).toBe(memoryAddress('abc'));
    expect(memoryAddress('abc')).not.toBe(memoryAddress('abd'));
  });

  it('splitArtists separa colaboraciones', () => {
    expect(splitArtists('Shakira ft. Wyclef Jean')).toEqual(['Shakira', 'Wyclef Jean']);
    expect(splitArtists('KAROL G, Nicki Minaj')).toEqual(['KAROL G', 'Nicki Minaj']);
    expect(splitArtists('Queen')).toEqual(['Queen']);
  });
});

describe('YouTube', () => {
  it('extractYouTubeId entiende los formatos de enlace comunes', () => {
    expect(extractYouTubeId('https://www.youtube.com/watch?v=kJQP7kiw5Fk')).toBe('kJQP7kiw5Fk');
    expect(extractYouTubeId('https://youtu.be/kJQP7kiw5Fk?t=10')).toBe('kJQP7kiw5Fk');
    expect(extractYouTubeId('https://music.youtube.com/watch?v=kJQP7kiw5Fk&list=x')).toBe('kJQP7kiw5Fk');
    expect(extractYouTubeId('youtube.com/shorts/kJQP7kiw5Fk')).toBe('kJQP7kiw5Fk');
    expect(extractYouTubeId('https://www.youtube.com/embed/kJQP7kiw5Fk')).toBe('kJQP7kiw5Fk');
    expect(extractYouTubeId('kJQP7kiw5Fk')).toBe('kJQP7kiw5Fk');
  });

  it('extractYouTubeId rechaza lo que no es de YouTube', () => {
    expect(extractYouTubeId('https://vimeo.com/123')).toBeNull();
    expect(extractYouTubeId('hola mundo')).toBeNull();
    expect(extractYouTubeId('https://www.youtube.com/watch?v=corto')).toBeNull();
  });

  it('splitVideoTitle limpia adornos y separa artista y título', () => {
    expect(splitVideoTitle('KAROL G, Nicki Minaj - Tusa (Official Video)', 'KAROL G')).toEqual({
      artist: 'KAROL G, Nicki Minaj',
      title: 'Tusa',
    });
    expect(splitVideoTitle('Faded', 'Alan Walker')).toEqual({ artist: 'Alan Walker', title: 'Faded' });
    expect(splitVideoTitle('Tema [Audio Oficial]', 'ArtistaVEVO')).toEqual({ artist: 'Artista', title: 'Tema' });
  });
});
