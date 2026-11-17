'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { LangProvider } from '@/lib/i18n';
import { CatalogProvider } from '@/lib/catalog';
import { DialogProvider } from '@/components/Dialog';
import { supabase } from '@/lib/supabase';
import '@/lib/install'; // começa a escutar o "instalar app" do Android desde a abertura

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
    <CatalogProvider>
    <LangProvider>
      <DialogProvider>
        <RecoveryListener />
        {children}
      </DialogProvider>
    </LangProvider>
    </CatalogProvider>
  );
}
