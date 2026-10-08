import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { memoryAddress } from '../lib/format';
import { usePlayer } from '../player/usePlayer';
import { ArrowLeftIcon, ArrowRightIcon } from './icons';
import { useFlip } from './useFlip';

/** Como máximo se iluminan estos nodos al animar un recorrido, para que dure menos de un segundo. */
const MAX_TRACE = 10;

const clock = new Intl.DateTimeFormat('es', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

/**
 * Visualizador de la estructura: cada tarjeta es un nodo con sus punteros `prev` y `next`,
 * unidos por flechas en ambos sentidos. Marca head, tail y current, y se anima al insertar,
 * eliminar o mover (los nodos se deslizan a su nuevo lugar y el recorrido se ilumina).
 */
export function NodeVisualizer() {
  const player = usePlayer();
  const [reversed, setReversed] = useState(false);
  const chainRef = useRef<HTMLOListElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const list = player.list;
  // toArray() y toArrayReversed() solo se usan aquí para pintar: el segundo camina por prev.
  const songs = reversed ? list.toArrayReversed() : list.toArray();
  const ordered = reversed ? [...songs].reverse() : songs;
  const size = list.size;
  const currentId = list.current?.value.id ?? null;
  const headId = list.head?.value.id ?? null;
  const tailId = list.tail?.value.id ?? null;
  const trace = player.trace;
  const lastLog = player.log.toArray().at(-1) ?? null;

  useFlip(chainRef, songs.map((song) => song.id).join('|'));

  // El nodo actual se mantiene a la vista dentro de la cadena.
  useEffect(() => {
    const scroller = scrollRef.current;
    const node = scroller?.querySelector<HTMLElement>('[data-current="true"]');
    if (!scroller || !node) return;
    const target = node.offsetLeft - scroller.clientWidth / 2 + node.offsetWidth / 2;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    scroller.scrollTo({ left: Math.max(0, target), behavior: reduced ? 'auto' : 'smooth' });
  }, [currentId, reversed]);

  /** Orden en que se visitó cada nodo durante la última operación (o -1 si no se visitó). */
  function visitOrder(realIndex: number): number {
    if (trace === null || trace.from === null) return -1;
    const order = trace.from === 'head' ? realIndex : size - 1 - realIndex;
    return order <= Math.min(trace.steps, MAX_TRACE) ? order : -1;
  }

  return (
    <section className="nodes" aria-label="Visualizador de la lista doble">
      <dl className="nodes-stats">
        <div>
          <dt>size</dt>
          <dd className="mono">{size}</dd>
        </div>
        <div>
          <dt>head</dt>
          <dd className="mono">{headId ? memoryAddress(headId) : 'null'}</dd>
        </div>
        <div>
          <dt>tail</dt>
          <dd className="mono">{tailId ? memoryAddress(tailId) : 'null'}</dd>
        </div>
        <div>
          <dt>current</dt>
          <dd className="mono is-red">{currentId ? memoryAddress(currentId) : 'null'}</dd>
        </div>
        <div>
          <dt>forma</dt>
          <dd>{player.repeat === 'off' ? 'lineal' : 'circular al repetir'}</dd>
        </div>
      </dl>

      <div className="nodes-toolbar">
        <div className="tabs" role="tablist" aria-label="Sentido del recorrido">
          <button type="button" role="tab" className="tab" aria-selected={!reversed} onClick={() => setReversed(false)}>
            head a tail (next)
          </button>
          <button type="button" role="tab" className="tab" aria-selected={reversed} onClick={() => setReversed(true)}>
            tail a head (prev)
          </button>
        </div>
        <p className="muted nodes-hint">Toca un nodo para reproducirlo. Agrega, mueve o elimina canciones y mira cómo se reconectan.</p>
      </div>

      {size === 0 ? (
        <p className="chain-empty mono">head = null · tail = null · current = null</p>
      ) : (
        <div className="chain-scroll" ref={scrollRef} tabIndex={0} role="group" aria-label="Cadena de nodos, desplázate en horizontal">
          <ol className="chain" ref={chainRef}>
            <li className="chain-null mono" aria-hidden="true">
              null
            </li>
            {songs.map((song, position) => {
              const realIndex = ordered.indexOf(song);
              const previous = ordered[realIndex - 1];
              const following = ordered[realIndex + 1];
              const order = visitOrder(realIndex);
              const isCurrent = song.id === currentId;
              return (
                <li key={song.id} className="chain-item" data-flip={song.id}>
                  {position > 0 && (
                    <span className="chain-link" aria-hidden="true">
                      <span className="chain-arrow">
                        {reversed ? 'prev' : 'next'} <ArrowRightIcon size={14} weight="bold" />
                      </span>
                      <span className="chain-arrow is-back">
                        <ArrowLeftIcon size={14} weight="bold" /> {reversed ? 'next' : 'prev'}
                      </span>
                    </span>
                  )}
                  <button
                    type="button"
                    className="node"
                    data-current={isCurrent}
                    onClick={() => player.playSong(song.id)}
                    aria-label={`Nodo ${realIndex + 1}: ${song.title}${isCurrent ? ', canción actual' : ''}. Reproducir.`}
                  >
                    {order >= 0 && trace !== null && (
                      <i key={trace.key} className="node-visit" style={{ '--visit': order } as CSSProperties} />
                    )}
                    <span className="node-badges">
                      {song.id === headId && <span className="node-badge">head</span>}
                      {isCurrent && <span className="node-badge is-current">current</span>}
                      {song.id === tailId && <span className="node-badge">tail</span>}
                    </span>
                    <span className="node-addr mono">{memoryAddress(song.id)}</span>
                    <span className="node-title truncate">{song.title}</span>
                    <span className="node-pointer mono">
                      prev <b>{previous ? memoryAddress(previous.id) : 'null'}</b>
                    </span>
                    <span className="node-pointer mono">
                      next <b>{following ? memoryAddress(following.id) : 'null'}</b>
                    </span>
                  </button>
                </li>
              );
            })}
            <li className="chain-null mono" aria-hidden="true">
              null
            </li>
          </ol>
        </div>
      )}

      <p className="nodes-narration" role="status">
        {lastLog !== null ? (
          <>
            <span className="mono is-red">{lastLog.operation}</span> {lastLog.detail}
          </>
        ) : (
          'Aquí se explica cada operación en cuanto la ejecutes.'
        )}
      </p>

      <section className="console" aria-label="Consola de operaciones">
        <h3 className="console-title">Consola de operaciones</h3>
        {player.log.isEmpty() ? (
          <p className="muted mono">Sin operaciones todavía.</p>
        ) : (
          <ol className="console-list mono">
            {player.log
              .toArray()
              .reverse()
              .map((entry) => (
                <li key={entry.id} className="console-line">
                  <span className="muted">{clock.format(entry.time)}</span>
                  <span className="is-red">{entry.operation}</span>
                  <span className="muted">
                    {entry.from !== null ? `${entry.steps} ${entry.steps === 1 ? 'paso' : 'pasos'} desde ${entry.from}` : 'sin recorrer'}
                  </span>
                  <span className="console-cost">{entry.complexity}</span>
                </li>
              ))}
          </ol>
        )}
      </section>
    </section>
  );
}
