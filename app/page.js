'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    supabase.auth
      .getSession()
      .then(({ data: { session } }) => {
        // Logado: passa por /preparando, que monta o plano do quiz (se houver) e segue para o Início.
        // É por aqui que chega quem confirma o e-mail do cadastro.
        router.replace(session ? '/preparando' : '/login');
      })
      .catch(() => router.replace('/login'));
  }, [router]);

  return null;
}
