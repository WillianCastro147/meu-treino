'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useI18n } from '@/lib/i18n';

export default function AuthGuard({ children }) {
  const router = useRouter();
  const { t } = useI18n();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth
      .getSession()
      .then(({ data: { session } }) => {
        if (!session) {
          router.replace('/login');
        } else {
          setUser(session.user);
        }
        setLoading(false);
      })
      .catch(() => router.replace('/login'));

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) router.replace('/login');
      else setUser(session.user);
    });

    return () => sub.subscription.unsubscribe();
  }, [router]);

  if (loading || !user) {
    return (
      <div className="auth-wrap">
        <p className="muted">{t('loading')}</p>
      </div>
    );
  }

  return children(user);
}
