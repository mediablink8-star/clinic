import { useState, useCallback, useRef } from 'react';
import ConfirmDialog from '../components/ConfirmDialog';

export function useConfirm() {
  const resolveRef = useRef(null);
  const [dialogProps, setDialogProps] = useState(null);

  const confirm = useCallback((message, options = {}) => {
    return new Promise((resolve) => {
      resolveRef.current = resolve;
      setDialogProps({
        isOpen: true,
        title: options.title || 'Επιβεβαίωση',
        message,
        confirmLabel: options.confirmLabel || 'Επιβεβαίωση',
        cancelLabel: options.cancelLabel || 'Ακύρωση',
        variant: options.variant || 'danger',
      });
    });
  }, []);

  const handleClose = useCallback(() => {
    resolveRef.current?.(false);
    resolveRef.current = null;
    setDialogProps(null);
  }, []);

  const handleConfirm = useCallback(() => {
    resolveRef.current?.(true);
    resolveRef.current = null;
    setDialogProps(null);
  }, []);

  const dialog = dialogProps ? (
    <ConfirmDialog
      isOpen={dialogProps.isOpen}
      onClose={handleClose}
      onConfirm={handleConfirm}
      title={dialogProps.title}
      message={dialogProps.message}
      confirmLabel={dialogProps.confirmLabel}
      cancelLabel={dialogProps.cancelLabel}
      variant={dialogProps.variant}
    />
  ) : null;

  return { confirm, dialog };
}

export default useConfirm;
