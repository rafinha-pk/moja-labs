import { useEffect, useRef, type ReactNode } from 'react';
import { pt } from '../i18n/pt';
import { Button } from './Button';

interface ModalProps {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer: ReactNode;
}

export function Modal({ open, title, onClose, children, footer }: ModalProps) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      className="m-auto w-[min(28rem,calc(100vw-2rem))] rounded-md border border-line bg-overlay p-0 text-fg shadow-overlay backdrop:bg-black/60"
    >
      <div className="flex flex-col gap-4 p-4">
        <h2 className="text-base font-semibold">{title}</h2>
        {children}
        <div className="flex justify-end gap-2">{footer}</div>
      </div>
    </dialog>
  );
}

interface ConfirmProps {
  open: boolean;
  title: string;
  text: string;
  confirmLabel: string;
  busy?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

export function ConfirmDialog({
  open,
  title,
  text,
  confirmLabel,
  busy,
  onConfirm,
  onClose,
}: ConfirmProps) {
  return (
    <Modal
      open={open}
      title={title}
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>{pt.common.cancel}</Button>
          <Button variant="danger" disabled={busy} onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <p className="text-sm text-muted">{text}</p>
    </Modal>
  );
}
