// Perguntas e regras do quiz Moviq (versão para a Hostinger).
// Cópia de lib/quiz.js do app: se mudar uma pergunta aqui, mude lá também (e vice-versa),
// porque a tela /preparando do app lê estas mesmas respostas.
(function () {
  const MINUTES = [30, 45, 60, 90];

  // Imagem de cada vaga (pasta img/, em WebP para carregar rápido no celular)
  // IMG_V: troque o número quando substituir imagens, para os navegadores não mostrarem a versão antiga guardada
  const IMG_V = 6;
  const imgSrc = (slot) => (slot === 'info-app' ? `img/info-app.svg?v=${IMG_V}` : `img/${slot}.webp?v=${IMG_V}`);

  const SECTIONS = ['Objetivo', 'Seu treino', 'Rotina', 'Medidas', 'Seu plano'];

  const GOAL_LABEL = {
    massa: 'ganhar massa muscular',
    gordura: 'perder gordura',
    definir: 'definir o corpo',
    forca: 'ficar mais forte',
    saude: 'ter mais saúde e disposição',
  };

  const LEVEL_LABEL = { beginner: 'iniciante', intermediate: 'intermediário', advanced: 'avançado' };

  const BARRIER_TITLE = {
    'nao-sei': 'Chega de chegar na academia sem saber o que fazer.',
    tempo: 'Treinos que cabem no tempo que você tem.',
    resultado: 'Você vê a evolução em números, treino a treino.',
    sozinho: 'Um plano que te acompanha em cada série.',
    vergonha: 'Entre na academia sabendo exatamente o que fazer.',
  };

  const isF = (a) => a.sexo === 'f';

  const STEPS = [
    // ---------- Objetivo ----------
    {
      id: 'sexo',
      section: 0,
      type: 'single',
      layout: 'grid',
      title: 'Monte seu treino personalizado em 2 minutos',
      sub: 'Para começar, escolha seu gênero.',
      options: [
        { value: 'm', label: 'Homem', img: 'sexo-m' },
        { value: 'f', label: 'Mulher', img: 'sexo-f' },
      ],
    },
    {
      id: 'objetivo',
      section: 0,
      type: 'single',
      title: 'Qual é o seu objetivo agora?',
      options: [
        { value: 'massa', label: 'Ganhar massa muscular' },
        { value: 'gordura', label: 'Perder gordura' },
        { value: 'definir', label: 'Definir o corpo' },
        { value: 'forca', label: 'Ficar mais forte' },
        { value: 'saude', label: 'Ter mais saúde e disposição' },
      ],
    },
    {
      id: 'idade',
      section: 0,
      type: 'single',
      title: 'Qual é a sua idade?',
      options: ['18–24', '25–34', '35–44', '45–54', '55+'].map((v) => ({ value: v, label: v })),
    },
    {
      id: 'info-objetivo',
      section: 0,
      type: 'info',
      img: 'info-objetivo',
      title: (a) => `Boa! Seu foco vai ser ${GOAL_LABEL[a.objetivo] || 'evoluir na academia'}.`,
      text: (a) =>
        ({
          massa: 'Vamos priorizar exercícios compostos, volume certo por músculo e aumento de carga semana a semana.',
          gordura: 'Vamos combinar musculação para manter a massa magra com treinos mais densos para gastar mais energia.',
          definir: 'Vamos trabalhar para ganhar músculo e reduzir gordura ao mesmo tempo, sem treinos intermináveis.',
          forca: 'Vamos focar nos levantamentos principais, com poucas repetições e progressão de carga controlada.',
          saude: 'Vamos montar um treino equilibrado, que cabe na rotina e melhora força, fôlego e postura.',
        })[a.objetivo] || '',
    },
    {
      id: 'corpo',
      section: 0,
      type: 'single',
      layout: 'grid',
      title: 'Como está seu corpo hoje?',
      sub: 'Seja sincero(a), ninguém além de você vê isso.',
      options: (a) =>
        isF(a)
          ? [
              { value: 'magro', label: 'Magra', img: 'corpo-f-magro' },
              { value: 'medio', label: 'Média', img: 'corpo-f-medio' },
              { value: 'cheio', label: 'Um pouco acima do peso', img: 'corpo-f-cheio' },
              { value: 'acima', label: 'Acima do peso', img: 'corpo-f-acima' },
            ]
          : [
              { value: 'magro', label: 'Magro', img: 'corpo-m-magro' },
              { value: 'medio', label: 'Médio', img: 'corpo-m-medio' },
              { value: 'musculoso', label: 'Musculoso', img: 'corpo-m-musculoso' },
              { value: 'acima', label: 'Acima do peso', img: 'corpo-m-acima' },
            ],
    },
    {
      id: 'meta',
      section: 0,
      type: 'single',
      layout: 'grid',
      title: 'E qual corpo você quer construir?',
      options: (a) =>
        isF(a)
          ? [
              { value: 'leve', label: 'Mais leve', img: 'meta-f-leve' },
              { value: 'tonificado', label: 'Tonificada', img: 'meta-f-tonificado' },
              { value: 'curvas', label: 'Com curvas', img: 'meta-f-curvas' },
              { value: 'forte', label: 'Forte', img: 'meta-f-forte' },
            ]
          : [
              { value: 'leve', label: 'Mais leve', img: 'meta-m-leve' },
              { value: 'atletico', label: 'Atlético', img: 'meta-m-atletico' },
              { value: 'definido', label: 'Definido', img: 'meta-m-definido' },
              { value: 'forte', label: 'Forte', img: 'meta-m-forte' },
            ],
    },

    // ---------- Seu treino ----------
    {
      id: 'local',
      section: 1,
      type: 'single',
      title: 'Onde você vai treinar?',
      options: [
        { value: 'academia', label: 'Academia completa', hint: 'Máquinas, barras, cabos e halteres' },
        { value: 'condominio', label: 'Academia do prédio ou condomínio', hint: 'Halteres e algumas máquinas' },
        { value: 'casa', label: 'Em casa com halteres ou elásticos' },
        { value: 'sem', label: 'Sem equipamento', hint: 'Só o peso do corpo' },
      ],
    },
    {
      id: 'experiencia',
      section: 1,
      type: 'single',
      title: 'Há quanto tempo você faz musculação?',
      options: [
        { value: 'nunca', label: 'Nunca fiz' },
        { value: '0-6m', label: 'Menos de 6 meses' },
        { value: '6m-2a', label: 'De 6 meses a 2 anos' },
        { value: '2a+', label: 'Mais de 2 anos' },
      ],
    },
    {
      id: 'recente',
      section: 1,
      type: 'single',
      title: 'E nos últimos 3 meses, quanto você treinou?',
      options: [
        { value: '5+', label: 'Quase todo dia' },
        { value: '3-4', label: '3 a 4 vezes por semana' },
        { value: '1-2', label: '1 a 2 vezes por semana' },
        { value: 'parado', label: 'Estou parado(a)' },
      ],
    },
    {
      id: 'info-nivel',
      section: 1,
      type: 'info',
      chart: 'nivel', // gráfico desenhado em quiz-tela.js (levelChart), no lugar de imagem
      title: (a) => `Seu ponto de partida: ${LEVEL_LABEL[estimateLevel(a)]}`,
      text: (a) =>
        ({
          beginner: 'Perfeito para começar do jeito certo: aprender os movimentos, criar o hábito e ver os primeiros ganhos rápido.',
          intermediate: 'Você já tem base. Agora o que faz diferença é progressão de carga organizada e volume bem distribuído.',
          advanced: 'Com bastante experiência, cada detalhe conta: periodização, escolha de exercícios e controle do volume.',
        })[estimateLevel(a)],
    },
    {
      id: 'dias',
      section: 1,
      type: 'single',
      title: 'Quantos dias por semana você consegue treinar?',
      sub: 'Escolha o que cabe de verdade na sua rotina.',
      // 7 = todos os dias: academia 4x por semana + Desafio 21 dias de calistenia (app: lib/quiz.js gymDays)
      options: [...[2, 3, 4, 5, 6].map((n) => ({ value: n, label: `${n} dias` })), { value: 7, label: 'Todos os dias (com o Desafio 21 dias)' }],
    },
    {
      id: 'minutos',
      section: 1,
      type: 'single',
      title: 'Quanto tempo você tem por treino?',
      options: MINUTES.map((m) => ({ value: m, label: m >= 90 ? '90 min ou mais' : `${m} min` })),
    },
    {
      id: 'foco',
      section: 1,
      type: 'multi',
      bodyMap: true,
      title: 'Quer dar prioridade a algum músculo?',
      sub: 'Escolha quantos quiser.',
      options: [
        { value: 'peito', label: 'Peito' },
        { value: 'costas', label: 'Costas' },
        { value: 'ombros', label: 'Ombros' },
        { value: 'bracos', label: 'Braços' },
        { value: 'abdomen', label: 'Abdômen' },
        { value: 'pernas', label: 'Pernas' },
        { value: 'gluteos', label: 'Glúteos' },
        { value: 'equilibrado', label: 'Corpo todo por igual', none: true },
      ],
    },
    {
      id: 'divisao',
      section: 1,
      type: 'single',
      title: 'Como você prefere dividir os treinos?',
      options: [
        { value: 'auto', label: 'Não sei, escolha por mim' },
        { value: 'fullbody', label: 'Corpo inteiro em todo treino' },
        { value: 'upper-lower', label: 'Superior / Inferior' },
        { value: 'abc', label: 'ABC (ex.: peito, costas, pernas)' },
        { value: 'ppl', label: 'Empurrar / Puxar / Pernas' },
      ],
    },
    {
      id: 'limites',
      section: 1,
      type: 'multi',
      layout: 'icons',
      title: 'Sente dor ou tem limitação em alguma região?',
      sub: 'O plano evita exercícios que forcem essas áreas.',
      options: [
        { value: 'ombro', label: 'Ombro', img: 'limite-ombro' },
        { value: 'lombar', label: 'Lombar', img: 'limite-lombar' },
        { value: 'joelho', label: 'Joelho', img: 'limite-joelho' },
        { value: 'punho', label: 'Punho', img: 'limite-punho' },
        { value: 'nenhuma', label: 'Nenhuma', img: 'limite-nenhuma', none: true },
      ],
    },
    {
      id: 'info-limite',
      section: 1,
      type: 'info', // sem imagem: só título e texto
      when: (a) => hasLimits(a),
      title: 'Anotado. Seu treino vai respeitar isso.',
      text: (a) =>
        `Vamos trocar movimentos que sobrecarregam ${listJoin(labelsOf('limites', a.limites, a))} por variações mais seguras. Se a dor for forte ou persistente, procure um profissional de saúde.`,
    },
    {
      id: 'barreiras',
      section: 1,
      type: 'multi',
      title: 'O que mais já te fez parar de treinar?',
      sub: 'Escolha quantas quiser.',
      options: [
        { value: 'nao-sei', label: 'Não saber o que fazer na academia' },
        { value: 'tempo', label: 'Falta de tempo' },
        { value: 'resultado', label: 'O resultado demorou a aparecer' },
        { value: 'sozinho', label: 'Desanimei treinando sozinho(a)' },
        { value: 'vergonha', label: 'Vergonha ou insegurança na academia' },
        { value: 'nunca-parei', label: 'Nunca parei', none: true },
      ],
    },
    {
      id: 'info-app',
      section: 1,
      type: 'info',
      img: 'info-app',
      title: (a) => BARRIER_TITLE[(a.barreiras || [])[0]] || 'Você abre o app e já sabe o que fazer.',
      text: 'O Moviq mostra o exercício do dia com vídeo, as séries, a carga sugerida e o descanso. Quando você bate as repetições, ele sobe a carga sozinho.',
    },

    // ---------- Rotina ----------
    {
      id: 'horario',
      section: 2,
      type: 'single',
      title: 'Em que horário você costuma treinar?',
      options: [
        { value: 'manha', label: 'De manhã' },
        { value: 'almoco', label: 'No almoço' },
        { value: 'tarde', label: 'À tarde' },
        { value: 'noite', label: 'À noite' },
        { value: 'varia', label: 'Varia' },
      ],
    },
    {
      id: 'sono',
      section: 2,
      type: 'single',
      title: 'Quantas horas você dorme por noite?',
      options: [
        { value: '<5', label: 'Menos de 5 h' },
        { value: '5-6', label: '5 a 6 h' },
        { value: '7-8', label: '7 a 8 h' },
        { value: '8+', label: 'Mais de 8 h' },
      ],
    },
    {
      // Desafio 21 dias de calistenia: quem disser sim recebe o desafio além do plano semanal (app: lib/challenge.js)
      id: 'desafio',
      section: 2,
      type: 'single',
      when: (a) => Number(a.dias) !== 7, // "todos os dias" já inclui o desafio
      title: 'Quer entrar no Desafio 21 dias de calistenia?',
      sub: 'Um treino por dia com o peso do corpo, sem equipamento, para fazer em casa junto com o seu plano.',
      options: [
        { value: 'sim', label: 'Sim, quero o desafio' },
        { value: 'nao', label: 'Agora não' },
      ],
    },

    // ---------- Medidas ----------
    { id: 'altura', section: 3, type: 'number', title: 'Qual é a sua altura?', unit: 'cm', min: 120, max: 230, placeholder: '175' },
    { id: 'peso', section: 3, type: 'number', title: 'E o seu peso atual?', unit: 'kg', min: 35, max: 300, placeholder: '80', decimal: true },
    {
      id: 'pesoMeta',
      section: 3,
      type: 'number',
      title: 'Tem um peso que você quer alcançar?',
      sub: 'Opcional. Vamos acompanhar isso no app.',
      unit: 'kg',
      min: 35,
      max: 300,
      placeholder: '75',
      decimal: true,
      optional: true,
    },

    // ---------- Seu plano ----------
    { id: 'montando', section: 4, type: 'loader', title: 'Montando seu plano…' },
    { id: 'resumo', section: 4, type: 'summary', title: 'Seu plano Moviq' },
    { id: 'nome', section: 4, type: 'name', title: 'Como você quer ser chamado(a)?' },
    { id: 'email', section: 4, type: 'email', title: (a) => `${firstName(a.nome) ? firstName(a.nome) + ', p' : 'P'}ara onde enviamos seu plano?` },
    // Tela de planos (só na versão Hostinger): planos e preços em config.js
    { id: 'planos', section: 4, type: 'paywall', title: (a) => `Comece hoje a ${GOAL_LABEL[a.objetivo] || 'treinar do jeito certo'}` },
  ];

  // ---------- Navegação ----------
  const resolve = (v, a) => (typeof v === 'function' ? v(a || {}) : v);
  const visibleSteps = (a) => STEPS.filter((s) => !s.when || s.when(a || {}));

  function labelsOf(stepId, values, a) {
    const step = STEPS.find((s) => s.id === stepId);
    const opts = resolve(step && step.options, a) || [];
    return (values || [])
      .map((v) => {
        const o = opts.find((x) => x.value === v);
        return o && o.label ? o.label.toLowerCase() : null;
      })
      .filter(Boolean);
  }

  const listJoin = (arr) => (arr.length <= 1 ? arr.join('') : `${arr.slice(0, -1).join(', ')} e ${arr[arr.length - 1]}`);
  const num = (v) => Number(String(v == null ? '' : v).replace(',', '.')) || 0;
  const firstName = (name) => String(name || '').trim().split(/\s+/)[0] || '';
  const hasLimits = (a) => (a.limites || []).some((x) => x !== 'nenhuma');
  const isValidEmail = (e) => /^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/.test(String(e || '').trim()) && String(e).trim().length <= 254;

  function isAnswered(step, a) {
    a = a || {};
    const v = a[step.id];
    switch (step.type) {
      case 'single':
        return v !== undefined && v !== null && v !== '';
      case 'multi':
        return Array.isArray(v) && v.length > 0;
      case 'number': {
        if (step.optional && (v === undefined || v === null || v === '')) return true;
        const n = Number(String(v).replace(',', '.'));
        return Number.isFinite(n) && n >= step.min && n <= step.max;
      }
      case 'name':
        return String(a.nome || '').trim().length >= 2;
      case 'email':
        return isValidEmail(a.email);
      default:
        return true;
    }
  }

  // "Nenhuma" / "Corpo todo por igual" é exclusiva
  function toggleMulti(current, value, options) {
    const list = Array.isArray(current) ? current : [];
    const noneValues = (options || []).filter((o) => o.none).map((o) => o.value);
    if (list.includes(value)) return list.filter((x) => x !== value);
    if (noneValues.includes(value)) return [value];
    return [...list.filter((x) => !noneValues.includes(x)), value];
  }

  // ---------- Resultado ----------
  function estimateLevel(a) {
    a = a || {};
    const base = { nunca: 0, '0-6m': 0, '6m-2a': 1, '2a+': 2 }[a.experiencia];
    const b = base === undefined ? 0 : base;
    const level = a.recente === 'parado' ? Math.max(0, b - 1) : b;
    return ['beginner', 'intermediate', 'advanced'][level];
  }

  const SPLIT_LABEL = { fullbody: 'Corpo inteiro', 'upper-lower': 'Superior / Inferior', abc: 'ABC', ppl: 'Empurrar / Puxar / Pernas' };

  function suggestedSplit(a) {
    if (a && a.divisao && a.divisao !== 'auto') return a.divisao;
    const raw = Math.round(Number(a && a.dias) || 3);
    const d = raw >= 7 ? 4 : raw; // todos os dias = 4 de academia + desafio
    if (d <= 3) return 'fullbody';
    if (d === 4) return 'upper-lower';
    return 'ppl';
  }

  function planSummary(a) {
    const foco = labelsOf('foco', (a.foco || []).filter((x) => x !== 'equilibrado'), a);
    const h = num(a.altura) / 100;
    const imc = h && num(a.peso) ? num(a.peso) / (h * h) : null;
    return {
      objetivo: GOAL_LABEL[a.objetivo] || '',
      nivel: LEVEL_LABEL[estimateLevel(a)],
      divisao: SPLIT_LABEL[suggestedSplit(a)],
      rotina: Number(a.dias) === 7 ? `Todos os dias · ${a.minutos || 60} min` : `${a.dias || 3} treinos por semana · ${a.minutos || 60} min`,
      foco: foco.length ? listJoin(foco) : 'corpo todo equilibrado',
      cuidados: hasLimits(a) ? listJoin(labelsOf('limites', a.limites, a)) : null,
      imc: imc ? Math.round(imc * 10) / 10 : null,
    };
  }

  // Só as respostas conhecidas, nos formatos esperados (o que vai para o Supabase)
  function cleanAnswers(a) {
    const out = {};
    for (const step of STEPS) {
      const v = a && a[step.id];
      if (v === undefined || v === null || v === '') continue;
      if (step.type === 'single') {
        if ((resolve(step.options, a) || []).some((o) => o.value === v)) out[step.id] = v;
      } else if (step.type === 'multi') {
        const opts = resolve(step.options, a) || [];
        const vals = (Array.isArray(v) ? v : []).filter((x) => opts.some((o) => o.value === x));
        if (vals.length) out[step.id] = vals;
      } else if (step.type === 'number') {
        const n = Number(String(v).replace(',', '.'));
        if (Number.isFinite(n) && n >= step.min && n <= step.max) out[step.id] = Math.round(n * 10) / 10;
      }
    }
    return out;
  }

  // ---------- Rastreio e checkout ----------
  const TRACKING_PARAMS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'fbclid', 'src', 'sck'];

  function pickTracking(search) {
    const p = new URLSearchParams(search || '');
    const out = {};
    for (const k of TRACKING_PARAMS) {
      const v = p.get(k);
      if (v) out[k] = v.slice(0, 200);
    }
    return out;
  }

  function checkoutUrl(baseUrl, opts) {
    opts = opts || {};
    if (!baseUrl) return null;
    let url;
    try {
      url = new URL(baseUrl);
    } catch (e) {
      return null;
    }
    if (opts.email) url.searchParams.set('email', String(opts.email).trim().toLowerCase());
    if (opts.name) url.searchParams.set('name', String(opts.name).trim());
    for (const [k, v] of Object.entries(opts.tracking || {})) if (!url.searchParams.has(k)) url.searchParams.set(k, v);
    return url.toString();
  }

  window.MoviqQuiz = {
    imgSrc, SECTIONS, STEPS, LEVEL_LABEL, GOAL_LABEL, resolve, visibleSteps, isAnswered, toggleMulti, estimateLevel,
    planSummary, cleanAnswers, pickTracking, checkoutUrl, firstName,
  };
})();
