import { describe, expect, it } from 'vitest';
import { parseCommand } from '../commands';

describe('parseCommand', () => {
  it('entiende los controles básicos sin importar tildes ni mayúsculas', () => {
    expect(parseCommand('Siguiente')).toEqual({ type: 'next' });
    expect(parseCommand('  ATRÁS ')).toEqual({ type: 'previous' });
    expect(parseCommand('pausa.')).toEqual({ type: 'pause' });
    expect(parseCommand('reproduce')).toEqual({ type: 'play' });
    expect(parseCommand('aleatorio')).toEqual({ type: 'shuffle' });
    expect(parseCommand('repetir')).toEqual({ type: 'repeat' });
    expect(parseCommand('deshacer')).toEqual({ type: 'undo' });
    expect(parseCommand('rehacer')).toEqual({ type: 'redo' });
    expect(parseCommand('restaurar')).toEqual({ type: 'restore' });
    expect(parseCommand('me gusta')).toEqual({ type: 'favorite' });
  });

  it('entiende pon y elimina con el nombre de la canción', () => {
    expect(parseCommand('pon Tusa')).toEqual({ type: 'playSong', query: 'Tusa' });
    expect(parseCommand('reproduce Bohemian Rhapsody')).toEqual({ type: 'playSong', query: 'Bohemian Rhapsody' });
    expect(parseCommand('elimina Faded')).toEqual({ type: 'remove', query: 'Faded' });
  });

  it('entiende agrega con la posición', () => {
    expect(parseCommand('agrega Shape of You')).toEqual({ type: 'add', query: 'Shape of You', placement: { at: 'end' } });
    expect(parseCommand('agrega Perfect al inicio')).toEqual({ type: 'add', query: 'Perfect', placement: { at: 'start' } });
    expect(parseCommand('añade Sugar al final')).toEqual({ type: 'add', query: 'Sugar', placement: { at: 'end' } });
    expect(parseCommand('agrega New Rules en la posición 3')).toEqual({
      type: 'add',
      query: 'New Rules',
      placement: { at: 'index', index: 2 },
    });
  });

  it('entiende ajustes con valores', () => {
    expect(parseCommand('tema claro')).toEqual({ type: 'theme', theme: 'light' });
    expect(parseCommand('tema oscuro')).toEqual({ type: 'theme', theme: 'dark' });
    expect(parseCommand('volumen 40')).toEqual({ type: 'volume', value: 40 });
    expect(parseCommand('volumen 250')).toEqual({ type: 'volume', value: 100 });
    expect(parseCommand('temporizador 15')).toEqual({ type: 'sleep', minutes: 15 });
    expect(parseCommand('ordenar por ritmo')).toEqual({ type: 'sort', key: 'bpm' });
    expect(parseCommand('ordena por género')).toEqual({ type: 'sort', key: 'genre' });
  });

  it('devuelve unknown si no entiende', () => {
    expect(parseCommand('')).toEqual({ type: 'unknown' });
    expect(parseCommand('haz café')).toEqual({ type: 'unknown' });
    expect(parseCommand('volumen alto')).toEqual({ type: 'unknown' });
    expect(parseCommand('temporizador 0')).toEqual({ type: 'unknown' });
    expect(parseCommand('ordenar por color')).toEqual({ type: 'unknown' });
  });
});
