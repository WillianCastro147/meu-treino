'use client';

import { useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useI18n } from '@/lib/i18n';
import { useDialog } from '@/components/Dialog';
import { catalogList, loadCatalog } from '@/lib/catalog';
import { fetchAllWorkouts, fetchBodyWeights } from '@/lib/data';
import { buildNameIndex, detectFormat, dropExisting, parseCsv, toWorkouts } from '@/lib/importCsv';

// Configurações → Dados: exportar tudo em JSON e importar histórico do Hevy/Strong (CSV)
export default function DataTools({ user }) {
  const { t, tf } = useI18n();
  const dialog = useDialog();
  const fileRef = useRef(null);
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  async function exportar() {
    setBusy(true);
    setMsg('');
    try {
      const [profile, routines, workouts, weights] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', user.id).single(),
        supabase.from('routines').select('*'),
        fetchAllWorkouts(),
        fetchBodyWeights().catch(() => ({ rows: [] })),
      ]);
      const data = {
        app: 'Moviq',
        exported_at: new Date().toISOString(),
        profile: profile.data,
        routines: routines.data || [],
        workouts,
        body_weights: weights.rows || [],
      };
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `moviq-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    } catch (e) {
      setMsg(t('errPrefix') + e.message);
    }
    setBusy(false);
  }

  async function importar(file) {
    if (!file) return;
    setMsg('');
    setBusy(true);
    try {
      const rows = parseCsv(await file.text());
      const format = detectFormat(rows);
      if (!format) {
        setBusy(false);
        return dialog.alert(t('importUnknown'));
      }
      await loadCatalog();
      const { workouts, unmatched } = toWorkouts(rows, format, buildNameIndex(catalogList()));
      const fresh = dropExisting(workouts, await fetchAllWorkouts());
      setBusy(false);
      if (!fresh.length) return dialog.alert(t('importNothing'));

      const ok = await dialog.confirm(
        tf('importConfirm', { n: fresh.length, app: format === 'hevy' ? 'Hevy' : 'Strong', unknown: unmatched.length }),
        { confirmLabel: t('importBtn') }
      );
      if (!ok) return;

      setBusy(true);
      for (let i = 0; i < fresh.length; i += 100) {
        const { error } = await supabase.from('workouts').insert(fresh.slice(i, i + 100).map((w) => ({ ...w, user_id: user.id })));
        if (error) throw error;
      }
      setMsg(tf('importDone', { n: fresh.length }));
    } catch (e) {
      setMsg(t('errPrefix') + e.message);
    }
    setBusy(false);
    if (fileRef.current) fileRef.current.value = '';
  }

  return (
    <div className="card">
      <p className="muted" style={{ marginBottom: 10 }}>{t('dataHint')}</p>
      <button className="btn secondary" onClick={exportar} disabled={busy}>
        {t('exportData')}
      </button>
      <button className="btn secondary" style={{ marginTop: 10 }} onClick={() => fileRef.current?.click()} disabled={busy}>
        {t('importCsv')}
      </button>
      <input ref={fileRef} type="file" accept=".csv,text/csv" hidden onChange={(e) => importar(e.target.files?.[0])} />
      {busy && <p className="muted" style={{ marginTop: 10 }}>{t('wait')}</p>}
      {msg && <p className={msg.startsWith(t('errPrefix')) ? 'error-msg' : 'success-msg'}>{msg}</p>}
    </div>
  );
}
