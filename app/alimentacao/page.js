'use client';

// Plano alimentar (produto extra). Com a compra liberada: metas do dia e cardápio com opções, calculados
// a partir do quiz e do perfil (lib/nutricao.js). Sem a compra: a oferta com o botão de pagamento.
// Se faltar algum dado (conta sem quiz), a pessoa preenche aqui mesmo (guardado só neste aparelho).
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import AuthGuard from '@/components/AuthGuard';
import BottomNav from '@/components/BottomNav';
import PageHeader from '@/components/PageHeader';
import { IconBack } from '@/components/Icons';
import { supabase } from '@/lib/supabase';
import { calcularMetas, montarCardapio, DICAS, AVISO_SAUDE } from '@/lib/nutricao';

const LOCAL = 'moviq_nutricao_dados_v1';
const OBJETIVOS = [
  ['massa', 'Ganhar massa muscular'],
  ['gordura', 'Perder gordura'],
  ['definir', 'Definir o corpo'],
  ['forca', 'Ficar mais forte'],
  ['saude', 'Saúde e disposição'],
];
const IDADES = ['18–24', '25–34', '35–44', '45–54', '55+'];

export default function AlimentacaoPage() {
  return <AuthGuard>{(user) => <Alimentacao user={user} />}</AuthGuard>;
}

function Alimentacao({ user }) {
  const router = useRouter();
  const [estado, setEstado] = useState('carregando'); // carregando | oferta | plano | erro
  const [oferta, setOferta] = useState(null);
  const [dados, setDados] = useState({});
  const [editar, setEditar] = useState(false);
  const [opcao, setOpcao] = useState({}); // refeição -> índice da opção aberta

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      try {
        const res = await fetch('/api/nutricao', { headers: { Authorization: `Bearer ${token}` } });
        const body = await res.json();
        if (!res.ok) return setEstado('erro');
        if (!body.liberado) {
          setOferta(body.oferta || {});
          return setEstado('oferta');
        }
        let local = {};
        try {
          local = JSON.parse(localStorage.getItem(LOCAL) || '{}');
        } catch (e) {}
        // O que a pessoa ajustou aqui vale mais que o quiz
        const d = { ...body.dados, ...local };
        setDados(d);
        setEditar(!calcularMetas(d) || !d.sexo || !d.objetivo);
        setEstado('plano');
      } catch (e) {
        setEstado('erro');
      }
    })();
  }, []);

  const metas = useMemo(() => calcularMetas(dados), [dados]);
  const cardapio = useMemo(() => montarCardapio(metas), [metas]);

  const salvar = (patch) => {
    const novo = { ...dados, ...patch };
    setDados(novo);
    try {
      const { sexo, idade, objetivo, dias, altura, peso } = novo;
      localStorage.setItem(LOCAL, JSON.stringify({ sexo, idade, objetivo, dias, altura, peso }));
    } catch (e) {}
  };

  const comprar = () => {
    const form = document.createElement('form');
    form.method = 'POST';
    form.action = '/api/stripe/checkout';
    for (const [k, v] of Object.entries({ plano: 'plano_alimentar', email: user.email || '' })) {
      const i = document.createElement('input');
      i.type = 'hidden';
      i.name = k;
      i.value = v;
      form.append(i);
    }
    document.body.append(form);
    form.submit();
  };

  return (
    <div className="page">
      <div className="page-head" style={{ justifyContent: 'flex-start', gap: 12 }}>
        <button className="round-btn" onClick={() => router.back()} aria-label="Voltar">
          <IconBack />
        </button>
      </div>
      <PageHeader title="Plano alimentar" sub="Calorias e refeições para o seu objetivo" />

      {estado === 'carregando' && <p className="muted">Carregando…</p>}
      {estado === 'erro' && <p className="muted">Não foi possível carregar agora. Tente de novo em instantes.</p>}

      {estado === 'oferta' && (
        <div className="card">
          <p style={{ fontWeight: 800, fontSize: 18, marginBottom: 8 }}>O treino faz a parte dele. A alimentação acelera o resultado.</p>
          <ul style={{ listStyle: 'none', display: 'grid', gap: 10, margin: '12px 0 16px', padding: 0 }}>
            {[
              'Calorias e macros do seu dia, calculados pelo seu objetivo, peso e treinos',
              '5 refeições com comida do dia a dia e opções para trocar',
              'Quantidades em gramas ajustadas para você',
            ].map((b) => (
              <li key={b} style={{ display: 'flex', gap: 10, fontSize: 15 }}>
                <span style={{ color: 'var(--accent)', fontWeight: 800 }}>✓</span>
                <span>{b}</span>
              </li>
            ))}
          </ul>
          {oferta?.preco ? (
            <>
              <p style={{ marginBottom: 12 }}>
                <b style={{ fontSize: 24 }}>{oferta.preco}</b> <span className="muted">pagamento único, Pix ou cartão</span>
              </p>
              <button className="btn" style={{ width: '100%' }} onClick={comprar}>
                Quero o plano alimentar
              </button>
            </>
          ) : (
            <p className="muted">Em breve.</p>
          )}
        </div>
      )}

      {estado === 'plano' && (
        <>
          {(editar || !metas) && <Dados dados={dados} onSalvar={(p) => { salvar(p); setEditar(false); }} />}

          {metas && !editar && (
            <>
              <div className="card">
                <p className="muted" style={{ fontSize: 14 }}>Sua meta por dia para {metas.objetivo}</p>
                <p style={{ fontSize: 34, fontWeight: 800, margin: '4px 0 12px' }}>
                  {metas.kcal.toLocaleString('pt-BR')} <span style={{ fontSize: 16, fontWeight: 600 }}>kcal</span>
                </p>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, textAlign: 'center' }}>
                  {[
                    ['Proteína', `${metas.proteina} g`],
                    ['Carbo', `${metas.carboidrato} g`],
                    ['Gordura', `${metas.gordura} g`],
                    ['Água', `${String(metas.agua).replace('.', ',')} L`],
                  ].map(([k, v]) => (
                    <div key={k}>
                      <b style={{ display: 'block', fontSize: 17 }}>{v}</b>
                      <span className="muted" style={{ fontSize: 12.5 }}>{k}</span>
                    </div>
                  ))}
                </div>
                <button className="btn small secondary" style={{ marginTop: 14 }} onClick={() => setEditar(true)}>
                  Atualizar peso e dados
                </button>
              </div>

              {cardapio.map((r) => {
                const i = opcao[r.id] || 0;
                const o = r.opcoes[i];
                return (
                  <div key={r.id} className="card">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                      <b style={{ fontSize: 17 }}>{r.nome}</b>
                      <span className="muted" style={{ fontSize: 14 }}>~{o.kcal} kcal</span>
                    </div>
                    <div style={{ display: 'flex', gap: 6, margin: '10px 0' }}>
                      {r.opcoes.map((_, k) => (
                        <button
                          key={k}
                          className={`btn small${k === i ? '' : ' secondary'}`}
                          onClick={() => setOpcao({ ...opcao, [r.id]: k })}
                        >
                          Opção {k + 1}
                        </button>
                      ))}
                    </div>
                    <ul style={{ listStyle: 'none', padding: 0, display: 'grid', gap: 6 }}>
                      {o.itens.map((it) => (
                        <li key={it.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 15 }}>
                          <span>{it.nome}</span>
                          <b style={{ whiteSpace: 'nowrap' }}>{it.qtd}</b>
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}

              <div className="card">
                <b style={{ fontSize: 17 }}>Como usar</b>
                <ul style={{ paddingLeft: 18, marginTop: 8, display: 'grid', gap: 6, fontSize: 15 }}>
                  {DICAS.map((d) => (
                    <li key={d}>{d}</li>
                  ))}
                </ul>
              </div>
              <p className="muted" style={{ fontSize: 12.5, lineHeight: 1.5, margin: '4px 4px 24px' }}>
                {AVISO_SAUDE}
              </p>
            </>
          )}
        </>
      )}
      <BottomNav />
    </div>
  );
}

function Dados({ dados, onSalvar }) {
  const [d, setD] = useState({
    sexo: dados.sexo || '',
    idade: dados.idade || '',
    objetivo: dados.objetivo || '',
    dias: dados.dias || 3,
    altura: dados.altura || '',
    peso: dados.peso || '',
  });
  const ok = d.sexo && d.idade && d.objetivo && Number(d.altura) > 100 && Number(String(d.peso).replace(',', '.')) > 30;
  const campo = { display: 'block', width: '100%', marginTop: 6 };
  return (
    <div className="card" style={{ display: 'grid', gap: 12 }}>
      <b style={{ fontSize: 17 }}>Seus dados</b>
      <label>
        Sexo
        <select className="input" style={campo} value={d.sexo} onChange={(e) => setD({ ...d, sexo: e.target.value })}>
          <option value="">Escolha</option>
          <option value="m">Masculino</option>
          <option value="f">Feminino</option>
        </select>
      </label>
      <label>
        Idade
        <select className="input" style={campo} value={d.idade} onChange={(e) => setD({ ...d, idade: e.target.value })}>
          <option value="">Escolha</option>
          {IDADES.map((v) => (
            <option key={v} value={v}>{v}</option>
          ))}
        </select>
      </label>
      <label>
        Objetivo
        <select className="input" style={campo} value={d.objetivo} onChange={(e) => setD({ ...d, objetivo: e.target.value })}>
          <option value="">Escolha</option>
          {OBJETIVOS.map(([v, l]) => (
            <option key={v} value={v}>{l}</option>
          ))}
        </select>
      </label>
      <label>
        Treinos por semana
        <select className="input" style={campo} value={d.dias} onChange={(e) => setD({ ...d, dias: Number(e.target.value) })}>
          {[2, 3, 4, 5, 6, 7].map((n) => (
            <option key={n} value={n}>{n === 7 ? 'Todos os dias' : `${n} dias`}</option>
          ))}
        </select>
      </label>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <label>
          Altura (cm)
          <input className="input" style={campo} inputMode="numeric" value={d.altura} onChange={(e) => setD({ ...d, altura: e.target.value })} />
        </label>
        <label>
          Peso (kg)
          <input className="input" style={campo} inputMode="decimal" value={d.peso} onChange={(e) => setD({ ...d, peso: e.target.value })} />
        </label>
      </div>
      <button className="btn" disabled={!ok} onClick={() => onSalvar({ ...d, altura: Number(d.altura), peso: Number(String(d.peso).replace(',', '.')) })}>
        Calcular meu plano
      </button>
    </div>
  );
}
