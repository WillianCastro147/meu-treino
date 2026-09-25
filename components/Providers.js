'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { LangProvider } from '@/lib/i18n';
import { DialogProvider } from '@/components/Dialog';
import { supabase } from '@/lib/supabase';

// Leva o usuário para a tela de nova senha quando ele abre o link de recuperação
function RecoveryListener() {
  const router = useRouter();
  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') router.replace('/redefinir-senha');
    });
    return () => data.subscription.unsubscribe();
  }, [router]);
  return null;
}

export default function Providers({ children }) {
  return (
    <LangProvider>
      <DialogProvider>
        <RecoveryListener />
        {children}
      </DialogProvider>
    </LangProvider>
  );
}
