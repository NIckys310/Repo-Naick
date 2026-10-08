import { Cover } from '../components/Cover';
import { ArrowLeftIcon, ArrowRightIcon, DjIcon } from '../components/icons';
import { memoryAddress } from '../lib/format';
import { usePlayer } from '../player/usePlayer';
import { useUi } from '../ui';

function greeting(hour: number): string {
  if (hour >= 5 && hour < 12) return 'Buenos días';
  if (hour >= 12 && hour < 19) return 'Buenas tardes';
  return 'Buenas noches';
}

/** Inicio: saludo, "la cinta" (la lista como cadena de nodos), acceso al DJ y lo escuchado. */
export function HomeView() {
  const player = usePlayer();
  const ui = useUi();
  const songs = player.list.toArray();
  const currentId = player.list.current?.value.id ?? null;
  const recent = player.history.toArray().slice(0, 6);

  return (
    <div className="view home">
      <h1 className="display view-title">
        {greeting(new Date().getHours())}, {player.profileName}
      </h1>

      <section aria-labelledby="tape-title">
        <h2 id="tape-title" className="section-title">
          La cinta
        </h2>
        {songs.length === 0 ? (
          <p className="muted">La lista está vacía. Agrega una canción para ver sus nodos aquí.</p>
        ) : (
          <div className="tape" tabIndex={0} role="group" aria-label="La lista como cadena de nodos, desplázate en horizontal">
            <ol className="tape-chain">
              {songs.map((song, index) => (
                <li key={song.id} className="tape-item">
                  {index > 0 && (
                    <span className="tape-link" aria-hidden="true">
                      <ArrowRightIcon size={14} weight="bold" />
                      <ArrowLeftIcon size={14} weight="bold" />
                    </span>
                  )}
                  <button type="button" className="tape-card" data-current={song.id === currentId} onClick={() => player.playSong(song.id)} aria-label={`Reproducir ${song.title}`}>
                    <Cover song={song} className="tape-cover" />
                    <span className="tape-title truncate">{song.title}</span>
                    <span className="mono tape-addr">{memoryAddress(song.id)}</span>
                  </button>
                </li>
              ))}
            </ol>
          </div>
        )}
      </section>

      <section className="dj-card">
        <div>
          <h2 className="display dj-card-title">Modo DJ</h2>
          <p>Ordena la lista por ritmo o por género moviendo los nodos, no las canciones.</p>
        </div>
        <button type="button" className="btn dj-card-button" onClick={() => ui.go('dj')}>
          <DjIcon size={18} weight="fill" aria-hidden="true" /> Abrir el DJ
        </button>
      </section>

      <section aria-labelledby="recent-title">
        <h2 id="recent-title" className="section-title">
          Escuchado hace poco
        </h2>
        {recent.length === 0 ? (
          <p className="muted">Lo que escuches aparecerá aquí. Sale de la pila del historial.</p>
        ) : (
          <ul className="recent">
            {recent.map((song, index) => (
              <li key={`${song.id}-${index}`}>
                <button type="button" className="recent-card" onClick={() => player.list.indexOf(song.id) !== -1 && player.playSong(song.id)} aria-label={`Reproducir ${song.title}`}>
                  <Cover song={song} className="recent-cover" />
                  <span className="recent-text">
                    <span className="truncate recent-title">{song.title}</span>
                    <span className="truncate muted">{song.artist}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <ul className="chips">
        <li>
          <button type="button" className="chip" onClick={() => ui.openPlaylist({ kind: 'all' }, 'nodes')}>
            Ver la lista doble
          </button>
        </li>
        <li>
          <button type="button" className="chip" onClick={() => ui.openPlaylist({ kind: 'all' }, 'stacks')}>
            Pilas y cola
          </button>
        </li>
        <li>
          <button type="button" className="chip" onClick={() => ui.openPlaylist({ kind: 'favorites' })}>
            Tus favoritas
          </button>
        </li>
        <li>
          <button type="button" className="chip" onClick={() => ui.openDialog('commands')}>
            Comandos
          </button>
        </li>
      </ul>
    </div>
  );
}
