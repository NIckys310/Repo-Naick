import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { runCommand } from '../player/runCommand';
import { usePlayer } from '../player/usePlayer';
import { Dialog } from './Dialog';
import { MicIcon } from './icons';

/** Parte mínima de la Web Speech API que usa el control por voz. */
interface SpeechRecognitionLike {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((event: { results: { 0: { transcript: string } }[] }) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  abort(): void;
}

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

function speechRecognition(): SpeechRecognitionConstructor | null {
  const scope = window as unknown as { SpeechRecognition?: SpeechRecognitionConstructor; webkitSpeechRecognition?: SpeechRecognitionConstructor };
  return scope.SpeechRecognition ?? scope.webkitSpeechRecognition ?? null;
}

const EXAMPLES = ['pon Tusa', 'siguiente', 'agrega Shape of You al final', 'ordenar por ritmo', 'temporizador 15', 'tema claro', 'deshacer'];

/** Comandos y voz: un mismo intérprete entiende lo que se escribe y lo que se dicta. */
export function CommandDialog({ listen, onClose }: { listen: boolean; onClose: () => void }) {
  const [text, setText] = useState('');
  const [answer, setAnswer] = useState('');
  const [busy, setBusy] = useState(false);
  const [listening, setListening] = useState(false);
  const recognition = useRef<SpeechRecognitionLike | null>(null);
  const inputId = useId();
  const voiceAvailable = speechRecognition() !== null;

  async function execute(command: string): Promise<void> {
    if (command.trim() === '' || busy) return;
    setBusy(true);
    setAnswer(await runCommand(command));
    setBusy(false);
    setText('');
  }

  function startListening(): void {
    const Recognition = speechRecognition();
    if (Recognition === null) {
      setAnswer('Este navegador no permite el control por voz. Escribe el comando.');
      return;
    }
    recognition.current?.abort();
    const session = new Recognition();
    session.lang = 'es-419';
    session.interimResults = false;
    session.maxAlternatives = 1;
    session.onresult = (event) => {
      const heard = event.results[0]?.[0].transcript ?? '';
      setText(heard);
      void execute(heard);
    };
    session.onerror = (event) => {
      setAnswer(event.error === 'not-allowed' ? 'Permite el micrófono en el navegador para usar la voz.' : 'No te escuché bien. Intenta de nuevo o escribe el comando.');
    };
    session.onend = () => setListening(false);
    recognition.current = session;
    setListening(true);
    setAnswer('');
    session.start();
  }

  useEffect(() => {
    if (listen) startListening();
    return () => recognition.current?.abort();
    // Solo al abrir.
  }, []);

  function submit(event: FormEvent): void {
    event.preventDefault();
    void execute(text);
  }

  return (
    <Dialog title="Comandos y voz" onClose={onClose} instant>
      <div className="dialog-body">
        <form className="command-form" onSubmit={submit}>
          <button
            type="button"
            className="mic"
            data-listening={listening}
            onClick={startListening}
            disabled={!voiceAvailable}
            aria-label={listening ? 'Escuchando' : 'Hablar un comando'}
          >
            <MicIcon size={22} weight="fill" aria-hidden="true" />
          </button>
          <label htmlFor={inputId} className="sr-only">
            Comando
          </label>
          <input
            id={inputId}
            className="input"
            value={text}
            onChange={(event) => setText(event.target.value)}
            placeholder={listening ? 'Escuchando…' : 'Escribe un comando…'}
            name="command"
            autoComplete="off"
            spellCheck={false}
            autoFocus
          />
          <button type="submit" className="btn btn-primary" disabled={busy}>
            Ejecutar
          </button>
        </form>
        <p className="command-answer" role="status">
          {busy ? 'Trabajando…' : answer}
        </p>
        {!voiceAvailable && <p className="field-hint">El control por voz funciona en Chrome y Edge. Aquí puedes escribir los comandos.</p>}
        <div className="field">
          <span className="field-label">Ejemplos</span>
          <ul className="chips">
            {EXAMPLES.map((example) => (
              <li key={example}>
                <button type="button" className="chip mono" onClick={() => void execute(example)}>
                  {example}
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </Dialog>
  );
}

/** Temporizador de apagado. */
export function SleepDialog({ onClose }: { onClose: () => void }) {
  const player = usePlayer();
  const options: { label: string; value: number | 'song' }[] = [
    { label: '5 minutos', value: 5 },
    { label: '15 minutos', value: 15 },
    { label: '30 minutos', value: 30 },
    { label: '1 hora', value: 60 },
    { label: 'Al terminar la canción', value: 'song' },
  ];
  return (
    <Dialog title="Detener la música" onClose={onClose}>
      <div className="dialog-body">
        <ul className="option-list">
          {options.map((option) => (
            <li key={option.label}>
              <button
                type="button"
                className="option"
                onClick={() => {
                  player.setSleep(option.value);
                  onClose();
                }}
              >
                {option.label}
                {option.value === 'song' && player.sleep?.mode === 'song' && <span className="tag tag-red">Activo</span>}
              </button>
            </li>
          ))}
        </ul>
        {player.sleep !== null && (
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => {
              player.setSleep(null);
              onClose();
            }}
          >
            Cancelar el temporizador
          </button>
        )}
      </div>
    </Dialog>
  );
}

export const SHORTCUTS: { keys: string; action: string }[] = [
  { keys: 'Espacio', action: 'Reproducir o pausar' },
  { keys: '→', action: 'Canción siguiente' },
  { keys: '←', action: 'Canción anterior' },
  { keys: 'Ctrl K', action: 'Abrir comandos' },
  { keys: 'Ctrl Z', action: 'Deshacer' },
  { keys: 'Ctrl Y', action: 'Rehacer' },
  { keys: 'L', action: 'Marcar la canción actual como favorita' },
  { keys: 'M', action: 'Silenciar' },
  { keys: '/', action: 'Ir al buscador' },
];

export function ShortcutList() {
  return (
    <dl className="shortcuts">
      {SHORTCUTS.map((shortcut) => (
        <div key={shortcut.keys}>
          <dt>
            <span className="kbd">{shortcut.keys}</span>
          </dt>
          <dd>{shortcut.action}</dd>
        </div>
      ))}
    </dl>
  );
}

export function ShortcutsDialog({ onClose }: { onClose: () => void }) {
  return (
    <Dialog title="Atajos de teclado" onClose={onClose}>
      <div className="dialog-body">
        <ShortcutList />
        <p className="field-hint">Los atajos no se activan mientras escribes en un campo.</p>
      </div>
    </Dialog>
  );
}
