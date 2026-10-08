import { useId, useState, type FormEvent } from 'react';
import { ArrowRightIcon } from '../components/icons';
import { store } from '../player/usePlayer';

/**
 * Pantalla de acceso. No hay cuentas ni contraseñas: el perfil es local y solo guarda
 * un nombre en este navegador. Mantiene el diseño de la referencia (panel rojo + formulario).
 */
export function Access() {
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const inputId = useId();
  const errorId = useId();

  function submit(event: FormEvent): void {
    event.preventDefault();
    const result = store.login(name);
    if (!result.ok) setError(result.message);
  }

  return (
    <main className="access">
      <section className="access-hero" aria-label="rep-Naick">
        <div className="access-brand">
          <img src="/brand/logo-sobre-rojo.svg" alt="" width={56} height={56} />
          <span className="display" translate="no">rep-Naick</span>
        </div>
        <h1 className="display access-headline">Tu música, enlazada en ambos sentidos.</h1>
        <ul className="access-benefits">
          <li>Canciones completas de YouTube en una sola lista.</li>
          <li>Agrega, mueve y elimina canciones como nodos enlazados.</li>
          <li>Mira por dentro cómo funciona la lista doble que la mueve.</li>
        </ul>
        <p className="access-foot">Taller de Estructuras de Datos, listas doblemente enlazadas</p>
        <div className="access-vinyl" aria-hidden="true" />
      </section>

      <section className="access-form-side">
        <form className="access-form" onSubmit={submit} noValidate>
          <h2 className="display access-title">Entra a tu tornamesa</h2>
          <p className="muted">
            Tu perfil es local: se guarda solo en este navegador, sin contraseña ni correo.
          </p>
          <div className="field">
            <label htmlFor={inputId}>Tu nombre</label>
            <input
              id={inputId}
              className="input"
              value={name}
              onChange={(event) => {
                setName(event.target.value);
                setError('');
              }}
              placeholder="Por ejemplo, Nicky…"
              name="name"
              spellCheck={false}
              autoComplete="given-name"
              maxLength={30}
              aria-invalid={error !== ''}
              aria-describedby={error !== '' ? errorId : undefined}
              autoFocus={window.matchMedia('(pointer: fine)').matches}
            />
            {error !== '' && (
              <p id={errorId} className="field-error" role="alert">
                {error}
              </p>
            )}
          </div>
          <button type="submit" className="btn btn-primary access-submit">
            Entrar
            <ArrowRightIcon size={18} weight="bold" aria-hidden="true" />
          </button>
        </form>
      </section>
    </main>
  );
}
