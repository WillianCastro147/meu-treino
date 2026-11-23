// Preguntas y reglas del quiz Moviq en español (quiz.moviqgym.app/es).
// Copia de quiz-dados.js con los textos traducidos: los valores (value) son los mismos, porque el app
// (pantalla /preparando, lib/quiz.js) lee estas respuestas igual que las del quiz en portugués.
// Si cambias una pregunta allá, cambia aquí también.
(function () {
  const MINUTES = [30, 45, 60, 90];

  const IMG_V = 7;
  // Imagens com a tela do app: versão em espanhol (scripts/mockup/gerar-mockups-es.py). As outras são as mesmas.
  const IMG_ES = { 'info-app': 'info-app-es', 'info-objetivo': 'info-objetivo-es' };
  const imgSrc = (slot) => `img/${IMG_ES[slot] || slot}.webp?v=${IMG_V}`;

  const SECTIONS = ['Objetivo', 'Tu entrenamiento', 'Medidas', 'Tu plan'];

  const GOAL_LABEL = {
    massa: 'ganar masa muscular',
    gordura: 'perder grasa',
    definir: 'definir el cuerpo',
    forca: 'ser más fuerte',
    saude: 'tener más salud y energía',
  };

  const LEVEL_LABEL = { beginner: 'principiante', intermediate: 'intermedio', advanced: 'avanzado' };

  const BARRIER_TITLE = {
    'nao-sei': 'Se acabó llegar al gimnasio sin saber qué hacer.',
    tempo: 'Entrenamientos que caben en el tiempo que tienes.',
    resultado: 'Ves tu progreso en números, entrenamiento a entrenamiento.',
    sozinho: 'Un plan que te acompaña en cada serie.',
    vergonha: 'Entra al gimnasio sabiendo exactamente qué hacer.',
  };

  const isF = (a) => a.sexo === 'f';

  const STEPS = [
    // ---------- Objetivo ----------
    {
      id: 'sexo',
      section: 0,
      type: 'single',
      layout: 'grid',
      title: 'Arma tu entrenamiento personalizado en 2 minutos',
      sub: 'Para empezar, elige tu género.',
      options: [
        { value: 'm', label: 'Hombre', img: 'sexo-m' },
        { value: 'f', label: 'Mujer', img: 'sexo-f' },
      ],
    },
    {
      id: 'objetivo',
      section: 0,
      type: 'single',
      title: '¿Cuál es tu objetivo ahora?',
      options: [
        { value: 'massa', label: 'Ganar masa muscular' },
        { value: 'gordura', label: 'Perder grasa' },
        { value: 'definir', label: 'Definir el cuerpo' },
        { value: 'forca', label: 'Ser más fuerte' },
        { value: 'saude', label: 'Tener más salud y energía' },
      ],
    },
    {
      id: 'idade',
      section: 0,
      type: 'single',
      title: '¿Cuántos años tienes?',
      options: ['18–24', '25–34', '35–44', '45–54', '55+'].map((v) => ({ value: v, label: v })),
    },
    {
      id: 'info-objetivo',
      section: 0,
      type: 'info',
      img: 'info-objetivo',
      title: (a) => `¡Bien! Tu enfoque será ${GOAL_LABEL[a.objetivo] || 'avanzar en el gimnasio'}.`,
      text: (a) =>
        ({
          massa: 'Vamos a priorizar ejercicios compuestos, el volumen justo por músculo y aumentar la carga semana a semana.',
          gordura: 'Vamos a combinar pesas para mantener la masa magra con entrenamientos más intensos para gastar más energía.',
          definir: 'Vamos a trabajar para ganar músculo y reducir grasa al mismo tiempo, sin entrenamientos interminables.',
          forca: 'Vamos a enfocarnos en los levantamientos principales, con pocas repeticiones y progresión de carga controlada.',
          saude: 'Vamos a armar un entrenamiento equilibrado, que cabe en tu rutina y mejora fuerza, resistencia y postura.',
        })[a.objetivo] || '',
    },
    {
      id: 'corpo',
      section: 0,
      type: 'single',
      layout: 'grid',
      title: '¿Cómo está tu cuerpo hoy?',
      sub: 'Sé sincero(a), nadie más que tú ve esto.',
      options: (a) =>
        isF(a)
          ? [
              { value: 'magro', label: 'Delgada', img: 'corpo-f-magro' },
              { value: 'medio', label: 'Media', img: 'corpo-f-medio' },
              { value: 'cheio', label: 'Un poco por encima del peso', img: 'corpo-f-cheio' },
              { value: 'acima', label: 'Con sobrepeso', img: 'corpo-f-acima' },
            ]
          : [
              { value: 'magro', label: 'Delgado', img: 'corpo-m-magro' },
              { value: 'medio', label: 'Medio', img: 'corpo-m-medio' },
              { value: 'musculoso', label: 'Musculoso', img: 'corpo-m-musculoso' },
              { value: 'acima', label: 'Con sobrepeso', img: 'corpo-m-acima' },
            ],
    },
    {
      id: 'meta',
      section: 0,
      type: 'single',
      layout: 'grid',
      title: '¿Y qué cuerpo quieres construir?',
      options: (a) =>
        isF(a)
          ? [
              { value: 'leve', label: 'Más ligera', img: 'meta-f-leve' },
              { value: 'tonificado', label: 'Tonificada', img: 'meta-f-tonificado' },
              { value: 'curvas', label: 'Con curvas', img: 'meta-f-curvas' },
              { value: 'forte', label: 'Fuerte', img: 'meta-f-forte' },
            ]
          : [
              { value: 'leve', label: 'Más ligero', img: 'meta-m-leve' },
              { value: 'atletico', label: 'Atlético', img: 'meta-m-atletico' },
              { value: 'definido', label: 'Definido', img: 'meta-m-definido' },
              { value: 'forte', label: 'Fuerte', img: 'meta-m-forte' },
            ],
    },

    // ---------- Tu entrenamiento ----------
    {
      id: 'local',
      section: 1,
      type: 'single',
      title: '¿Dónde vas a entrenar?',
      options: [
        { value: 'academia', label: 'Gimnasio completo', hint: 'Máquinas, barras, poleas y mancuernas' },
        { value: 'condominio', label: 'Gimnasio del edificio o condominio', hint: 'Mancuernas y algunas máquinas' },
        { value: 'casa', label: 'En casa con mancuernas o bandas' },
        { value: 'sem', label: 'Sin equipo', hint: 'Solo con el peso del cuerpo' },
      ],
    },
    {
      id: 'experiencia',
      section: 1,
      type: 'single',
      title: '¿Hace cuánto entrenas con pesas?',
      options: [
        { value: 'nunca', label: 'Nunca lo he hecho' },
        { value: '0-6m', label: 'Menos de 6 meses' },
        { value: '6m-2a', label: 'De 6 meses a 2 años' },
        { value: '2a+', label: 'Más de 2 años' },
      ],
    },
    {
      id: 'recente',
      section: 1,
      type: 'single',
      title: '¿Y en los últimos 3 meses, cuánto entrenaste?',
      options: [
        { value: '5+', label: 'Casi todos los días' },
        { value: '3-4', label: '3 a 4 veces por semana' },
        { value: '1-2', label: '1 a 2 veces por semana' },
        { value: 'parado', label: 'Estoy sin entrenar' },
      ],
    },
    {
      id: 'info-nivel',
      section: 1,
      type: 'info',
      chart: 'nivel',
      title: (a) => `Tu punto de partida: ${LEVEL_LABEL[estimateLevel(a)]}`,
      text: (a) =>
        ({
          beginner: 'Perfecto para empezar bien: aprender los movimientos, crear el hábito y ver los primeros resultados rápido.',
          intermediate: 'Ya tienes una base. Ahora lo que marca la diferencia es una progresión de carga organizada y un volumen bien distribuido.',
          advanced: 'Con mucha experiencia, cada detalle cuenta: periodización, elección de ejercicios y control del volumen.',
        })[estimateLevel(a)],
    },
    {
      id: 'dias',
      section: 1,
      type: 'single',
      title: '¿Cuántos días por semana puedes entrenar?',
      sub: 'Elige lo que de verdad cabe en tu rutina.',
      options: [...[2, 3, 4, 5, 6].map((n) => ({ value: n, label: `${n} días` })), { value: 7, label: 'Todos los días (con el Reto de 21 días)' }],
    },
    {
      id: 'minutos',
      section: 1,
      type: 'single',
      title: '¿Cuánto tiempo tienes por entrenamiento?',
      options: MINUTES.map((m) => ({ value: m, label: m >= 90 ? '90 min o más' : `${m} min` })),
    },
    {
      id: 'foco',
      section: 1,
      type: 'multi',
      bodyMap: true,
      title: '¿Quieres priorizar algún músculo?',
      sub: 'Elige los que quieras.',
      options: [
        { value: 'peito', label: 'Pecho' },
        { value: 'costas', label: 'Espalda' },
        { value: 'ombros', label: 'Hombros' },
        { value: 'bracos', label: 'Brazos' },
        { value: 'abdomen', label: 'Abdomen' },
        { value: 'pernas', label: 'Piernas' },
        { value: 'gluteos', label: 'Glúteos' },
        { value: 'equilibrado', label: 'Todo el cuerpo por igual', none: true },
      ],
    },
    {
      id: 'limites',
      section: 1,
      type: 'multi',
      layout: 'icons',
      title: '¿Sientes dolor o tienes alguna limitación?',
      sub: 'El plan evita ejercicios que fuercen esas zonas.',
      options: [
        { value: 'ombro', label: 'Hombro', img: 'limite-ombro' },
        { value: 'lombar', label: 'Zona lumbar', img: 'limite-lombar' },
        { value: 'joelho', label: 'Rodilla', img: 'limite-joelho' },
        { value: 'punho', label: 'Muñeca', img: 'limite-punho' },
        { value: 'nenhuma', label: 'Ninguna', img: 'limite-nenhuma', none: true },
      ],
    },
    {
      id: 'info-limite',
      section: 1,
      type: 'info',
      when: (a) => hasLimits(a),
      title: 'Anotado. Tu entrenamiento lo va a respetar.',
      text: (a) =>
        `Vamos a cambiar los movimientos que sobrecargan ${listJoin(labelsOf('limites', a.limites, a))} por variantes más seguras. Si el dolor es fuerte o persistente, consulta a un profesional de la salud.`,
    },
    {
      id: 'barreiras',
      section: 1,
      type: 'multi',
      title: '¿Qué te ha hecho dejar de entrenar antes?',
      sub: 'Elige las que quieras.',
      options: [
        { value: 'nao-sei', label: 'No saber qué hacer en el gimnasio' },
        { value: 'tempo', label: 'Falta de tiempo' },
        { value: 'resultado', label: 'Los resultados tardaron en llegar' },
        { value: 'sozinho', label: 'Me desanimé entrenando solo(a)' },
        { value: 'vergonha', label: 'Vergüenza o inseguridad en el gimnasio' },
        { value: 'nunca-parei', label: 'Nunca lo dejé', none: true },
      ],
    },
    {
      id: 'info-app',
      section: 1,
      type: 'info',
      img: 'info-app',
      title: (a) => BARRIER_TITLE[(a.barreiras || [])[0]] || 'Abres la app y ya sabes qué hacer.',
      text: 'Moviq te muestra el ejercicio del día con video, las series, la carga sugerida y el descanso. Cuando completas las repeticiones, sube la carga solo.',
    },

    // ---------- Reto ----------
    {
      id: 'desafio',
      section: 1,
      type: 'single',
      when: (a) => Number(a.dias) !== 7,
      title: '¿Quieres unirte al Reto de 21 días de calistenia?',
      sub: 'Un entrenamiento al día con el peso del cuerpo, sin equipo, para hacer en casa junto con tu plan.',
      options: [
        { value: 'sim', label: 'Sí, quiero el reto' },
        { value: 'nao', label: 'Ahora no' },
      ],
    },

    // ---------- Medidas ----------
    { id: 'altura', section: 2, type: 'number', title: '¿Cuánto mides?', unit: 'cm', min: 120, max: 230, placeholder: '175' },
    { id: 'peso', section: 2, type: 'number', title: '¿Y cuánto pesas ahora?', unit: 'kg', min: 35, max: 300, placeholder: '80', decimal: true },
    {
      id: 'pesoMeta',
      section: 2,
      type: 'number',
      title: '¿Tienes un peso que quieras alcanzar?',
      sub: 'Opcional. Lo seguiremos en la app.',
      unit: 'kg',
      min: 35,
      max: 300,
      placeholder: '75',
      decimal: true,
      optional: true,
    },

    // ---------- Tu plan ----------
    { id: 'montando', section: 3, type: 'loader', title: 'Armando tu plan…' },
    { id: 'resumo', section: 3, type: 'summary', title: 'Tu plan Moviq' },
    { id: 'nome', section: 3, type: 'name', title: '¿Cómo quieres que te llamemos?' },
    { id: 'email', section: 3, type: 'email', title: (a) => `${firstName(a.nome) ? firstName(a.nome) + ', ¿a' : '¿A'} dónde te enviamos tu plan?` },
    { id: 'planos', section: 3, type: 'paywall', title: (a) => `Empieza hoy a ${GOAL_LABEL[a.objetivo] || 'entrenar de la forma correcta'}` },
  ];

  // ---------- Navegación ----------
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

  const listJoin = (arr) => (arr.length <= 1 ? arr.join('') : `${arr.slice(0, -1).join(', ')} y ${arr[arr.length - 1]}`);
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

  const SPLIT_LABEL = { fullbody: 'Cuerpo completo', 'upper-lower': 'Superior / Inferior', abc: 'ABC', ppl: 'Empuje / Tirón / Piernas' };

  function suggestedSplit(a) {
    if (a && a.divisao && a.divisao !== 'auto') return a.divisao;
    const raw = Math.round(Number(a && a.dias) || 3);
    const d = raw >= 7 ? 4 : raw;
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
      rotina: Number(a.dias) === 7 ? `Todos los días · ${a.minutos || 60} min` : `${a.dias || 3} entrenamientos por semana · ${a.minutos || 60} min`,
      foco: foco.length ? listJoin(foco) : 'todo el cuerpo equilibrado',
      cuidados: hasLimits(a) ? listJoin(labelsOf('limites', a.limites, a)) : null,
      imc: imc ? Math.round(imc * 10) / 10 : null,
    };
  }

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

  // ---------- Rastreo y checkout ----------
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
