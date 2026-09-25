// Chamado 1x por dia pela Vercel (ver vercel.json) para o Supabase
// gratuito não pausar o projeto por falta de uso.
export const dynamic = 'force-dynamic';

export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  try {
    const res = await fetch(`${url}/rest/v1/profiles?select=id&limit=1`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
      cache: 'no-store',
    });
    return Response.json({ ok: res.ok, status: res.status, at: new Date().toISOString() });
  } catch (e) {
    return Response.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
