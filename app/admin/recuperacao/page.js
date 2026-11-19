'use client';

// Recuperação de vendas: quem deixou o Pix expirar ou abandonou o pagamento, com botão que abre o
// SEU WhatsApp já com a mensagem escrita (você só aperta enviar). O link da mensagem gera um Pix novo.
// Só abre para contas com e-mail em ADMIN_EMAILS (Vercel). "Já chamei" fica guardado só neste aparelho.
import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

const SITUACAO = {
  pix_expirado: { txt: 'Pix expirou', cor: '#f59e0b' },
  abandonado: { txt: 'Abandonou o pagamento', cor: '#8e8e93' },
  aberto: { txt: 'Pagamento aberto, parado', cor: '#3b82f6' },
};
const CHAVE = 'moviq_recuperacao_chamados_v1';
const quando = (seg) =>
  new Date(seg * 1000).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

function lerChamados() {
  try {
    return JSON.parse(localStorage.getItem(CHAVE) || '{}');
  } catch (e) {
    return {};
  }
}

export default function RecuperacaoPage() {
  const [estado, setEstado] = useState('carregando'); // carregando | login | proibido | erro | ok
  const [linhas, setLinhas] = useState([]);
  const [dias, setDias] = useState(7);
  const [chamados, setChamados] = useState({});
  const [copiado, setCopiado] = useState('');

  const carregar = useCallback(async () => {
    setEstado('carregando');
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) return setEstado('login');
    try {
      const res = await fetch(`/api/admin/recuperacao?dias=${dias}`, { headers: { Authorization: `Bearer ${token}` } });
      if (res.status === 401) return setEstado('login');
      if (res.status === 403 || res.status === 503) return setEstado('proibido');
      if (!res.ok) return setEstado('erro');
      setLinhas((await res.json()).linhas || []);
      setEstado('ok');
    } catch (e) {
      setEstado('erro');
    }
  }, [dias]);

  useEffect(() => {
    setChamados(lerChamados());
    carregar();
  }, [carregar]);

  const marcar = (id) => {
    const novo = { ...lerChamados(), [id]: Date.now() };
    try {
      localStorage.setItem(CHAVE, JSON.stringify(novo));
    } catch (e) {}
    setChamados(novo);
  };

  const copiar = async (l) => {
    try {
      await navigator.clipboard.writeText(l.link);
      setCopiado(l.id);
      setTimeout(() => setCopiado(''), 1500);
    } catch (e) {}
  };

  const pendentes = linhas.filter((l) => !chamados[l.id]).length;

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '24px 16px 80px' }}>
      <h1 className="quiz-title" style={{ textAlign: 'left' }}>
        Recuperação de vendas
      </h1>
      <p className="muted" style={{ margin: '6px 0 16px' }}>
        Quem deixou o Pix expirar ou não terminou o pagamento. O e-mail de recuperação já sai sozinho. Aqui você chama
        pelo WhatsApp: o botão abre o seu WhatsApp com a mensagem pronta e um link que gera um Pix novo.
      </p>

      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 16, flexWrap: 'wrap' }}>
        {[1, 3, 7, 14].map((d) => (
          <button key={d} className={`btn small${d === dias ? '' : ' secondary'}`} onClick={() => setDias(d)}>
            {d === 1 ? 'Hoje' : `${d} dias`}
          </button>
        ))}
        <button className="btn small secondary" onClick={carregar}>
          Atualizar
        </button>
      </div>

      {estado === 'carregando' && <p className="muted">Carregando…</p>}
      {estado === 'login' && (
        <p>
          Entre no app com a sua conta de administrador. <a href="/login">Fazer login</a>
        </p>
      )}
      {estado === 'proibido' && <p>Esta conta não tem acesso a esta página (ADMIN_EMAILS na Vercel).</p>}
      {estado === 'erro' && <p>Não foi possível carregar agora. Tente atualizar.</p>}

      {estado === 'ok' && (
        <>
          <p className="muted" style={{ marginBottom: 12 }}>
            {linhas.length} pessoa(s) · {pendentes} ainda não chamada(s)
          </p>
          {!linhas.length && <p>Ninguém para recuperar neste período.</p>}
          {linhas.map((l) => {
            const sit = SITUACAO[l.situacao] || { txt: l.situacao, cor: '#8e8e93' };
            const feito = !!chamados[l.id];
            return (
              <div key={l.id} className="card" style={{ marginBottom: 12, opacity: feito ? 0.55 : 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
                  <b style={{ fontSize: 17 }}>{l.nome || 'Sem nome'}</b>
                  <span style={{ color: sit.cor, fontWeight: 700, fontSize: 14 }}>{sit.txt}</span>
                </div>
                <p className="muted" style={{ margin: '4px 0 0', fontSize: 14, wordBreak: 'break-all' }}>
                  {l.email}
                  {l.telefone ? ` · ${l.telefone}` : ' · sem telefone'}
                </p>
                <p className="muted" style={{ margin: '2px 0 12px', fontSize: 13 }}>
                  {quando(l.criado)} · {l.valor}
                  {l.tentativas > 1 ? ` · ${l.tentativas} tentativas` : ''}
                  {l.campanha ? ` · ${l.campanha}` : ''}
                </p>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {l.whatsapp ? (
                    <a className="btn small" href={l.whatsapp} target="_blank" rel="noopener noreferrer" onClick={() => marcar(l.id)}>
                      Chamar no WhatsApp
                    </a>
                  ) : null}
                  <button className="btn small secondary" onClick={() => copiar(l)}>
                    {copiado === l.id ? 'Link copiado' : 'Copiar link de pagamento'}
                  </button>
                  {!feito && (
                    <button className="btn small secondary" onClick={() => marcar(l.id)}>
                      Marcar como chamado
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </>
      )}
    </div>
  );
}
