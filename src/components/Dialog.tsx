import { useEffect, useId, useRef, type ReactNode } from 'react';
import { CloseIcon } from './icons';

interface DialogProps {
  title: string;
  onClose: () => void;
  children: ReactNode;
  /** Sin animación de entrada (para lo que se abre con el teclado, como los comandos). */
  instant?: boolean;
}

/**
 * Diálogo modal sobre el elemento nativo <dialog>: el navegador se encarga de atrapar
 * el foco, de cerrar con Escape y de devolver el foco al botón que lo abrió.
 */
export function Dialog({ title, onClose, children, instant = false }: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (dialog !== null && !dialog.open) dialog.showModal();
    return () => dialog?.close();
  }, []);

  return (
    <dialog
      ref={ref}
      className={`dialog ${instant ? 'is-instant' : ''}`}
      aria-labelledby={titleId}
      onClose={() => {
        // Si el diálogo volvió a abrirse (doble montaje de React en desarrollo), se ignora el cierre anterior.
        if (!ref.current?.open) onClose();
      }}
      onClick={(event) => {
        // Un clic en el velo (fuera del contenido) cierra el diálogo.
        if (event.target === ref.current) onClose();
      }}
    >
      <div className="dialog-head">
        <h2 id={titleId} className="display dialog-title">
          {title}
        </h2>
        <button type="button" className="icon-btn is-small" onClick={onClose} aria-label="Cerrar">
          <CloseIcon size={18} aria-hidden="true" />
        </button>
      </div>
      {children}
    </dialog>
  );
}
