'use client';

// Prévia do app para quem fez o quiz e ainda não comprou (link da mensagem de WhatsApp do LeonaFlow):
//   /previa?l=<id do lead>            mensagem do lead
//   /previa?s=<id da sessão>          mensagens de recuperação (abriu o pagamento, Pix, abandonou)
// Mostra o app com a cara do plano da pessoa (nome, resumo do quiz, semana e os treinos de um plano pronto
// da mesma divisão, com as fotos dos exercícios). Qualquer toque abre o aviso de bloqueio com o botão de
// compra, que leva ao pagamento já com os dados do quiz (/api/stripe/pagar?l=<id>). Sem login.
import { useEffect, useState } from 'react';
import { useI18n } from '@/lib/i18n';
import { findExercise, loadCatalog } from '@/lib/catalog';
import { buildStarterPlan } from '@/lib/starter';
import { IconLogo, IconDumbbell } from '@/components/Icons';

const PRECO_CHEIO = 'R$ 37';
// ?o=1: condição especial do WhatsApp (lib/stripe.js OFERTA_CENTAVOS), o botão leva ao pagamento de R$ 19,90
const PRECO_OFERTA = 'R$ 19,90';
const DIAS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];
const IconLock = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="4.5" y="10.5" width="15" height="10" rx="2.5" />
    <path d="M8 10.5V7.5a4 4 0 0 1 8 0v3" />
  </svg>
);

export default function PreviaPage() {
  const { exName, setLang } = useI18n();
  const [id, setId] = useState('');
  const [dados, setDados] = useState(null); // { nome, resumo, plano, desafio, minutos }
  const [plano, setPlano] = useState(null); // { routines, schedule }
  const [erro, setErro] = useState(false);
  const [bloqueio, setBloqueio] = useState(false);
  const [oferta, setOferta] = useState(false);

  useEffect(() => {
    setLang('pt');
    const q = new URLSearchParams(window.location.search);
    setOferta(q.get('o') === '1');
    const busca = q.get('s') ? { s: q.get('s') } : { l: q.get('l') || '' };
    (async () => {
      try {
        const res = await fetch(`/api/previa?${new URLSearchParams(busca)}`);
        if (!res.ok) throw new Error('lead');
        const d = await res.json();
        await loadCatalog();
        setId(d.l || '');
        setDados(d);
        setPlano(buildStarterPlan(d.plano, 'pt', (exId) => findExercise({ id: exId })));
      } catch (e) {
        setErro(true);
      }
    })();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const pagar = `/api/stripe/pagar?${new URLSearchParams(oferta ? { l: id, o: '1' } : { l: id })}`;
  const PRECO = oferta ? PRECO_OFERTA : PRECO_CHEIO;

  // Qualquer toque na prévia abre o bloqueio (menos dentro do próprio aviso e no botão de compra)
  const travar = (e) => {
    if (e.target.closest('[data-livre]')) return;
    e.preventDefault();
    e.stopPropagation();
    setBloqueio(true);
  };

  if (erro) {
    return (
      <div className="auth-wrap">
        <div className="auth-box" style={{ textAlign: 'center' }}>
          <IconLogo size={44} />
          <h1 className="quiz-title" style={{ marginTop: 14 }}>Prévia indisponível</h1>
          <p className="quiz-sub">Não encontramos o seu plano. Faça o quiz de novo para montar o seu.</p>
          <a className="btn" href="https://quiz.moviqgym.app" style={{ display: 'block', textAlign: 'center' }}>Fazer o quiz</a>
        </div>
      </div>
    );
  }
  if (!dados || !plano) {
    return (
      <div className="auth-wrap">
        <p className="muted">Carregando seu plano…</p>
      </div>
    );
  }

  const r = dados.resumo || {};
  const rotinaDoDia = new Map(plano.schedule.map(([dia, key]) => [dia, plano.routines.find((x) => x.key === key)]));
  const hoje = plano.routines[0];
  const cap = (v) => (v ? v.charAt(0).toUpperCase() + v.slice(1) : v);

  return (
    <div onClickCapture={travar} style={{ minHeight: '100vh' }}>
      <div className="page previa" style={{ paddingBottom: 120 }}>
        <div className="previa-top">
          <IconLogo size={30} />
          <span className="previa-tag">
            <IconLock size={13} /> Prévia
          </span>
        </div>
        <h1 className="previa-ola">{dados.nome ? `Olá, ${dados.nome}!` : 'Olá!'}</h1>
        <p className="muted" style={{ fontSize: 16, marginBottom: 16 }}>Seu plano de treino está pronto. Veja como ele fica no app.</p>

        {/* Resumo do plano do quiz */}
        <div className="card">
          <p className="card-title">Seu plano Moviq</p>
          <div className="previa-resumo">
            {[
              ['Objetivo', r.objetivo],
              ['Nível', r.nivel],
              ['Divisão', r.divisao],
              ['Rotina', r.rotina],
              ['Prioridade', r.foco],
              dados.desafio ? ['Bônus', 'Desafio 21 dias de calistenia'] : null,
            ]
              .filter((x) => x && x[1])
              .map(([k, v]) => (
                <div key={k}>
                  <span className="muted">{k}</span>
                  <b>{cap(v)}</b>
                </div>
              ))}
          </div>
        </div>

        {/* Semana + treino de hoje */}
        <div className="card">
          <p className="card-title">
            Esta semana <span className="muted">{plano.schedule.length} treinos</span>
          </p>
          <div className="previa-semana">
            {DIAS.map((d, i) => {
              const rot = rotinaDoDia.get(i + 1);
              return (
                <button key={d} className={'previa-dia' + (rot ? ' tem' : '')}>
                  <span>{d}</span>
                  <b>{rot ? String.fromCharCode(65 + plano.routines.indexOf(rot)) : '·'}</b>
                </button>
              );
            })}
          </div>
          <button className="today-row" style={{ marginTop: 14 }}>
            <span className="today-icon">
              <IconDumbbell size={24} color="#fff" />
            </span>
            <span style={{ flex: 1, minWidth: 0 }}>
              <span className="today-kicker">Hoje</span>
              <span style={{ display: 'block', fontSize: 19, fontWeight: 600 }}>{hoje.name}</span>
              <span className="muted" style={{ display: 'block', fontSize: 15 }}>
                {hoje.exercises.length} exercícios · {dados.minutos} min
              </span>
            </span>
            <span className="pill previa-pill">
              <IconLock size={14} /> Iniciar
            </span>
          </button>
        </div>

        {/* Treinos do plano */}
        {plano.routines.map((rot, i) => (
          <div className="card" key={rot.key}>
            <p className="card-title">
              {rot.name}
              <span className="muted previa-cadeado">
                <IconLock size={14} /> {rot.exercises.length} exercícios
              </span>
            </p>
            {rot.exercises.slice(0, i === 0 ? rot.exercises.length : 3).map((ex) => (
              <button className="ex-row previa-ex" key={ex.id + rot.key}>
                <img src={ex.gif} alt="" className="ex-thumb" loading="lazy" />
                <span style={{ flex: 1, textAlign: 'left' }}>
                  <span className="ex-name" style={{ display: 'block' }}>{exName(ex)}</span>
                  <span className="muted">
                    {ex.sets} séries × {ex.reps} repetições
                  </span>
                </span>
              </button>
            ))}
            {i > 0 && rot.exercises.length > 3 && (
              <button className="previa-mais">
                <IconLock size={14} /> Mais {rot.exercises.length - 3} exercícios
              </button>
            )}
          </div>
        ))}
      </div>

      {/* Botão fixo de compra */}
      <div className="previa-barra" data-livre>
        <a className="btn" href={pagar} style={{ display: 'flex', width: '100%' }}>
          Liberar meu plano · {PRECO}
        </a>
        <p className="muted" style={{ textAlign: 'center', fontSize: 12.5, marginTop: 6 }}>
          {oferta ? (
            <>
              Condição especial: <s>{PRECO_CHEIO}</s> por {PRECO_OFERTA} · pagamento único · 7 dias de garantia
            </>
          ) : (
            'Pagamento único · 7 dias de garantia'
          )}
        </p>
      </div>

      {/* Aviso de bloqueio */}
      {bloqueio && (
        <div className="previa-fundo" data-livre onClick={() => setBloqueio(false)}>
          <div className="previa-aviso" onClick={(e) => e.stopPropagation()}>
            <span className="previa-aviso-icone">
              <IconLock size={28} />
            </span>
            <h2>Seu plano está bloqueado</h2>
            <p className="muted" style={{ fontSize: 15, lineHeight: 1.45 }}>
              Libere agora para treinar com ele no app: treino do dia pronto, vídeo de cada exercício, carga que sobe conforme você evolui e
              todo o seu progresso salvo.
            </p>
            <p style={{ margin: '14px 0 12px', textAlign: 'center' }}>
              {oferta && (
                <span className="muted" style={{ display: 'block', fontSize: 15 }}>
                  Condição especial: de <s>{PRECO_CHEIO}</s> por
                </span>
              )}
              <b style={{ fontSize: 34 }}>{PRECO}</b>
              <span className="muted" style={{ display: 'block', fontSize: 14 }}>
                pagamento único, sem mensalidade · 7 dias de garantia
              </span>
            </p>
            <a className="btn" href={pagar} style={{ display: 'flex', width: '100%' }}>
              Liberar meu plano
            </a>
            <button className="btn secondary" style={{ width: '100%', marginTop: 10 }} onClick={() => setBloqueio(false)}>
              Continuar vendo a prévia
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
