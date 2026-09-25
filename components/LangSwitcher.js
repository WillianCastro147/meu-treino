'use client';

import { LANGS, useI18n } from '@/lib/i18n';

export default function LangSwitcher({ style }) {
  const { lang, setLang, t } = useI18n();

  return (
    <div className="lang-switch" role="group" aria-label={t('language')} style={style}>
      {LANGS.map((l) => (
        <button
          key={l.code}
          type="button"
          className={lang === l.code ? 'active' : ''}
          onClick={() => setLang(l.code)}
          title={l.label}
        >
          {l.short}
        </button>
      ))}
    </div>
  );
}
