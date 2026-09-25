'use client';

import { createContext, useCallback, useContext, useRef, useState } from 'react';
import { useI18n } from '@/lib/i18n';

// Janelas de confirmação e aviso no visual do app (substituem alert/confirm do navegador)
const DialogContext = createContext(null);

export function DialogProvider({ children }) {
  const { t } = useI18n();
  const [dialog, setDialog] = useState(null); // { type, message, danger }
  const resolver = useRef(null);

  const open = useCallback((type, message, opts = {}) => {
    return new Promise((resolve) => {
      resolver.current = resolve;
      setDialog({ type, message, ...opts });
    });
  }, []);

  const close = (value) => {
    setDialog(null);
    if (resolver.current) resolver.current(value);
    resolver.current = null;
  };

  const api = {
    confirm: (message, opts) => open('confirm', message, opts),
    alert: (message, opts) => open('alert', message, opts),
  };

  return (
    <DialogContext.Provider value={api}>
      {children}
      {dialog && (
        <div className="dialog-overlay" onClick={() => close(dialog.type === 'alert' ? true : false)}>
          <div className="dialog" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
            <p className="dialog-msg">{dialog.message}</p>
            <div className="dialog-actions">
              {dialog.type === 'confirm' && (
                <button className="btn secondary" onClick={() => close(false)}>
                  {t('cancel')}
                </button>
              )}
              <button
                className={`btn ${dialog.danger ? 'danger-solid' : ''}`}
                onClick={() => close(true)}
                autoFocus
              >
                {dialog.type === 'confirm' ? dialog.confirmLabel || t('confirm') : t('ok')}
              </button>
            </div>
          </div>
        </div>
      )}
    </DialogContext.Provider>
  );
}

export function useDialog() {
  return (
    useContext(DialogContext) || {
      confirm: async (m) => window.confirm(m),
      alert: async (m) => window.alert(m),
    }
  );
}
