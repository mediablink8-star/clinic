import { useState, useCallback, useRef } from 'react';
import ConfirmDialog from '../components/ConfirmDialog';

export function useConfirm() {
  const resolveRef = useRef(null);
  const [dialogProps, setDialogProps] = useState(null);
  const [loading, setLoading] = useState(false);

  const confirm = useCallback((message, options = {}) => {
    return new Promise((resolve) => {
      resolveRef.current = resolve;
      setLoading(false);
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
    if (loading) return; // prevent closing while loading
    resolveRef.current?.(false);
    resolveRef.current = null;
    setDialogProps(null);
    setLoading(false);
  }, [loading]);

  const handleConfirm = useCallback(async () => {
    setLoading(true);
    resolveRef.current?.(true);
    // Don't close immediately — let the caller close after async work
    // Caller should call setDialogProps(null) or we auto-close after a tick
    setTimeout(() => {
      resolveRef.current = null;
      setDialogProps(null);
      setLoading(false);
    }, 300);
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
      loading={loading}
    />
  ) : null;

  return { confirm, dialog };
}

export default useConfirm;
