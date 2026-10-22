import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import * as AlertDialog from '@radix-ui/react-alert-dialog';
import { AnimatePresence, m, useDragControls } from 'motion/react';
import { CheckCircle2, Undo2, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button, IconButton } from './primitives.jsx';
import { useReducedMotion } from './PreferencesProvider.jsx';

export function Sheet({ open, onOpenChange, title, description, children }) {
  const { t } = useTranslation();
  const reduce = useReducedMotion();
  const controls = useDragControls();
  const opener = useRef(null);
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange} modal={false}>
      <Dialog.Portal forceMount>
        <AnimatePresence>
          {open && (
            <m.div
              key="backdrop"
              className="sheet-backdrop"
              aria-hidden="true"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onPointerDown={() => onOpenChange(false)}
            />
          )}
          {open && (
            <Dialog.Content
              forceMount
              asChild
              onOpenAutoFocus={() => {
                opener.current = document.activeElement;
              }}
              onCloseAutoFocus={(event) => {
                event.preventDefault();
                opener.current?.focus();
              }}
              onInteractOutside={(event) => {
                if (event.detail.originalEvent.type === 'focusin') event.preventDefault();
              }}
            >
              <m.section
                key="sheet"
                className="sheet"
                initial={{ opacity: 0, transform: reduce ? 'none' : 'translateY(100%)' }}
                animate={{ opacity: 1, transform: 'translateY(0%)' }}
                exit={{ opacity: 0, transform: reduce ? 'none' : 'translateY(100%)' }}
                transition={
                  reduce ? { duration: 0.12 } : { type: 'spring', stiffness: 300, damping: 30 }
                }
                drag="y"
                dragControls={controls}
                dragListener={false}
                dragConstraints={{ top: 0, bottom: 0 }}
                dragElastic={{ top: 0, bottom: 0.4 }}
                dragSnapToOrigin
                onDragEnd={(_event, info) => {
                  if (info.offset.y > 100 || info.velocity.y > 700) onOpenChange(false);
                }}
              >
                <button
                  type="button"
                  className="sheet-handle"
                  aria-label={t('common.close')}
                  onPointerDown={(event) => controls.start(event)}
                  onClick={() => onOpenChange(false)}
                >
                  <span />
                </button>
                <div className="row between sheet-title">
                  <Dialog.Title>{title}</Dialog.Title>
                  <Dialog.Close asChild>
                    <IconButton icon={X} label={t('common.close')} />
                  </Dialog.Close>
                </div>
                <Dialog.Description className={description ? 'muted' : 'sr-only'}>
                  {description || title}
                </Dialog.Description>
                <div className="sheet-body">{children}</div>
              </m.section>
            </Dialog.Content>
          )}
        </AnimatePresence>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export function ConfirmDialog({ open, onOpenChange, title, description, onConfirm, confirmLabel }) {
  const { t } = useTranslation();
  return (
    <AlertDialog.Root open={open} onOpenChange={onOpenChange}>
      <AlertDialog.Portal>
        <AlertDialog.Overlay className="sheet-backdrop" />
        <AlertDialog.Content className="confirm-dialog">
          <AlertDialog.Title>{title}</AlertDialog.Title>
          <AlertDialog.Description>{description}</AlertDialog.Description>
          <div className="row">
            <AlertDialog.Cancel asChild>
              <Button variant="ghost">{t('common.cancel')}</Button>
            </AlertDialog.Cancel>
            <AlertDialog.Action asChild>
              <Button variant="action" onClick={onConfirm}>
                {confirmLabel || t('common.reset')}
              </Button>
            </AlertDialog.Action>
          </div>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}

export function Toast({ message, undo, onClose }) {
  const { t } = useTranslation();
  const reduce = useReducedMotion();
  return (
    <m.div
      className="toast"
      role="status"
      initial={{ opacity: 0, transform: reduce ? 'none' : 'translateY(16px)' }}
      animate={{ opacity: 1, transform: 'none' }}
      exit={{ opacity: 0, transform: reduce ? 'none' : 'translateY(16px)' }}
      transition={{ duration: 0.2 }}
    >
      <CheckCircle2 size={20} className="toast-icon" />
      <span>{message}</span>
      {undo && (
        <Button
          variant="quiet"
          icon={Undo2}
          onClick={() => {
            undo();
            onClose();
          }}
        >
          {t('common.undo')}
        </Button>
      )}
      <IconButton icon={X} label={t('controls.dismiss')} onClick={onClose} />
    </m.div>
  );
}

const UiContext = createContext(null);
export const useUi = () => useContext(UiContext);
export function UiProvider({ children }) {
  const { t } = useTranslation();
  const [toast, setToast] = useState(null);
  const [preview, setPreview] = useState(null);
  const timer = useRef();
  const notify = useCallback((message, undo) => {
    clearTimeout(timer.current);
    setToast({ message, undo, id: Date.now() });
    // Undo is persistent so a slow reader never loses the recovery action.
    if (!undo) timer.current = setTimeout(() => setToast(null), 5000);
  }, []);
  useEffect(() => () => clearTimeout(timer.current), []);
  const read = useCallback((text) => setPreview(typeof text === 'function' ? text() : text), []);
  return (
    <UiContext.Provider value={{ notify, read }}>
      {children}
      <div className="toast-region">
        <AnimatePresence mode="wait">
          {toast && <Toast key={toast.id} {...toast} onClose={() => setToast(null)} />}
        </AnimatePresence>
      </div>
      <Sheet
        open={preview !== null}
        onOpenChange={(open) => {
          if (!open) setPreview(null);
        }}
        title={t('prototype.listen')}
        description={t('prototype.listenBody')}
      >
        <p className="read-preview">{preview}</p>
        <p className="phase-note">{t('prototype.voice')}</p>
      </Sheet>
    </UiContext.Provider>
  );
}
