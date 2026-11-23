// Guia de Treino Feminino (ebook em PDF) para a página /guia (conta logada, token do Supabase).
// Quem comprou (linha 'guia_feminino' ativa na tabela assinaturas) recebe um link temporário (1 h) para baixar o
// PDF, que fica num bucket privado do Supabase Storage (GUIA_BUCKET / GUIA_FEMININO_ARQUIVO). Quem não comprou
// recebe a oferta (valor) para a página mostrar o botão de compra.
import { createClient } from '@supabase/supabase-js';
import { supabaseAdmin, GUIA_FEMININO, temExtra, precoExtra } from '@/lib/stripe';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const BUCKET = process.env.GUIA_BUCKET || 'guias';
const ARQUIVO = process.env.GUIA_FEMININO_ARQUIVO || 'guia-de-treino-feminino.pdf';
const NOME_DOWNLOAD = 'Guia de Treino Feminino - Moviq.pdf';

const json = (body, status = 200) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });

export async function GET(req) {
  const db = supabaseAdmin();
  if (!db) return json({ error: 'not_configured' }, 503);

  const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  if (!token) return json({ error: 'unauthorized' }, 401);
  const anon = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: auth } = await anon.auth.getUser(token);
  const email = String(auth?.user?.email || '').toLowerCase();
  if (!email) return json({ error: 'unauthorized' }, 401);

  let liberado;
  try {
    liberado = await temExtra(db, email, GUIA_FEMININO);
  } catch (e) {
    return json({ error: 'db_error' }, 502);
  }
  if (!liberado) return json({ liberado: false, oferta: { preco: await precoExtra(GUIA_FEMININO) } });
  // ?status=1 (cartão do Início): só diz se está liberado, sem gerar o link do PDF
  if (new URL(req.url).searchParams.get('status')) return json({ liberado: true });

  const { data, error } = await db.storage.from(BUCKET).createSignedUrl(ARQUIVO, 60 * 60, { download: NOME_DOWNLOAD });
  if (error || !data?.signedUrl) {
    console.error('Guia: link do PDF', error?.message);
    return json({ liberado: true, error: 'arquivo_indisponivel' }, 502);
  }
  return json({ liberado: true, url: data.signedUrl });
}
