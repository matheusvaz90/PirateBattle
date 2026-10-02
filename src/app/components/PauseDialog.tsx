import { useEffect, useRef } from 'react';

interface Props {
  onResume: () => void;
  onMenu: () => void;
}

export function PauseDialog({ onResume, onMenu }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const resumeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
    resumeRef.current?.focus();
    return () => { dialog?.close(); };
  }, []);

  return (
    <dialog ref={dialogRef} className="pause-dialog" aria-labelledby="pause-heading" aria-describedby="pause-description" onCancel={(event) => event.preventDefault()}>
      <p className="eyebrow">ÂNCORA LANÇADA</p><h2 id="pause-heading">Jogo pausado</h2>
      <p id="pause-description">Seu navio e o cronômetro estão esperando. Continue quando estiver pronto.</p>
      <div className="dialog-actions">
        <button ref={resumeRef} className="button primary" onClick={() => { dialogRef.current?.close(); onResume(); }}>Continuar</button>
        <button className="button secondary" onClick={onMenu}>Menu principal</button>
      </div>
    </dialog>
  );
}
