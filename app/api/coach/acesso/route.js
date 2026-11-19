// A página do Coach pergunta aqui se a conta pode usar o gerador de treino com IA.
// Sem acesso, devolve o valor do gerador para a página mostrar a oferta com o botão de compra.
import { createClient } from '@supabase/supabase-js';
import { acessoCoach, precoGerador } from '@/lib/coachAcesso';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const json = (body, status = 200) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });

export async function GET(req) {
  const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  if (!token) return json({ error: 'unauthorized' }, 401);
  const anon = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data } = await anon.auth.getUser(token);
  if (!data?.user) return json({ error: 'unauthorized' }, 401);
  try {
    const acesso = await acessoCoach(data.user.email);
    return json({ ...acesso, preco: acesso.liberado ? null : await precoGerador() });
  } catch (e) {
    console.error('Coach acesso:', e.message);
    return json({ liberado: true, motivo: 'erro' }); // na dúvida a página abre; o servidor confere de novo ao gerar
  }
}
