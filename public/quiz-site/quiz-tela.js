// Tela do quiz Moviq (versão para a Hostinger, sem React).
// Mesmo fluxo de app/quiz/page.js: anúncio > quiz > grava no Supabase > checkout.
(function () {
  const Q = window.MoviqQuiz;
  const CFG = window.MOVIQ_CONFIG || {};
  const STORE = 'moviq_quiz_v1';

  // Regiões do desenho do corpo acesas por cada opção de foco
  const FOCUS_REGIONS = {
    peito: ['chest'],
    costas: ['upper-back', 'trapezius', 'lower-back'],
    ombros: ['deltoids'],
    bracos: ['biceps', 'triceps', 'forearm'],
    abdomen: ['abs', 'obliques'],
    pernas: ['quadriceps', 'hamstring', 'adductors', 'calves', 'tibialis'],
    gluteos: ['gluteal'],
  };
  const INERT_REGIONS = ['head', 'hair', 'neck', 'hands', 'feet', 'knees', 'ankles'];
  const FILL = ['#2c2c2e', 'rgba(59,130,246,0.35)', 'rgba(59,130,246,0.55)', 'rgba(59,130,246,0.8)', '#3b82f6'];

  const ICON_BACK =
    '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg>';
  const ICON_LOGO =
    '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" stroke-width="2.2" stroke-linecap="round"><path d="M6.5 6.5v11M17.5 6.5v11M3 9v6M21 9v6M6.5 12h11"/></svg>';

  // ---------- estado ----------
  let answers = {};
  let idx = 0;
  let tracking = {};
  let lastStepId = null;
  let timers = [];

  try {
    const saved = JSON.parse(localStorage.getItem(STORE) || '{}');
    if (saved.answers) answers = saved.answers;
    if (Number.isInteger(saved.idx)) idx = saved.idx;
    const fromUrl = Q.pickTracking(window.location.search);
    tracking = Object.keys(fromUrl).length ? fromUrl : saved.tracking || {};
  } catch (e) {}

  const save = () => {
    try {
      localStorage.setItem(STORE, JSON.stringify({ answers, idx, tracking }));
    } catch (e) {}
  };
  const set = (patch) => {
    answers = Object.assign({}, answers, patch);
    save();
  };
  save(); // grava as UTMs do anúncio já na chegada (seguem até a Stripe mesmo se a pessoa sair e voltar)

  // Pixel da Meta / Google, se estiverem instalados no index.html
  function track(event, data) {
    try {
      const standard = ['Lead', 'InitiateCheckout'].includes(event); // eventos padrão da Meta
      if (window.fbq) window.fbq(standard ? 'track' : 'trackCustom', event, data);
      if (window.gtag) window.gtag('event', event, data);
    } catch (e) {}
  }

  // ---------- helpers de DOM ----------
  function h(tag, props, ...children) {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(props || {})) {
      if (v === null || v === undefined || v === false) continue;
      if (k === 'class') el.className = v;
      else if (k === 'html') el.innerHTML = v;
      else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
      else if (k === 'style') el.style.cssText = v;
      else if (k in el && k !== 'list') el[k] = v;
      else el.setAttribute(k, v === true ? '' : v);
    }
    for (const c of children.flat()) if (c !== null && c !== undefined && c !== false) el.append(c instanceof Node ? c : String(c));
    return el;
  }

  function img(slot, cls) {
    return h('img', { src: Q.imgSrc(slot), alt: '', class: `quiz-img ${cls} quiz-img--${slot}`, decoding: 'async' });
  }

  function clearTimers() {
    timers.forEach(clearTimeout);
    timers = [];
  }
  const later = (fn, ms) => timers.push(setTimeout(fn, ms));

  // ---------- navegação ----------
  const steps = () => Q.visibleSteps(answers);
  const cur = () => Math.min(idx, steps().length - 1);

  function go(n) {
    clearTimers();
    idx = Math.max(0, Math.min(steps().length - 1, n));
    save();
    window.scrollTo(0, 0);
    render();
  }
  function next() {
    const i = cur();
    track('QuizStep', { step: steps()[i].id, n: i + 1 });
    go(i + 1);
  }

  // ---------- render ----------
  const root = document.getElementById('quiz');

  function render() {
    const list = steps();
    const i = cur();
    const step = list[i];

    const bars = Q.SECTIONS.map((name, s) => {
      const inSec = list.filter((x) => x.section === s);
      const done = inSec.filter((x) => list.indexOf(x) < i).length;
      const fill = step.section > s ? 1 : step.section < s ? 0 : done / Math.max(1, inSec.length);
      return h('span', { class: 'quiz-bar' }, h('span', { style: `width:${fill * 100}%` }));
    });

    const head = h(
      'header',
      { class: 'quiz-head' },
      h(
        'div',
        { class: 'quiz-head-row' },
        i > 0 ? h('button', { class: 'round-btn', 'aria-label': 'Voltar', html: ICON_BACK, onclick: () => go(i - 1) }) : h('span', { style: 'width:42px' }),
        h('span', { class: 'quiz-brand', html: ICON_LOGO + ' Moviq' }),
        h('span', { style: 'width:42px' })
      ),
      // na tela de planos o cabeçalho fica limpo (sem barra de progresso), como na página de oferta
      step.type === 'paywall' ? null : h('div', { class: 'quiz-progress' }, bars),
      step.type === 'paywall' ? null : h('p', { class: 'quiz-section' }, Q.SECTIONS[step.section])
    );

    const body = h('main', { class: 'quiz-body' + (step.id !== lastStepId ? ' enter' : '') });
    lastStepId = step.id;
    renderStep(step, body);

    root.replaceChildren(head, body);
    const auto = body.querySelector('[data-autofocus]');
    if (auto) auto.focus();
  }

  function title(step) {
    const sub = Q.resolve(step.sub, answers);
    return [h('h1', { class: 'quiz-title' }, Q.resolve(step.title, answers)), sub ? h('p', { class: 'quiz-sub' }, sub) : null].filter(Boolean);
  }

  function cta(label, onClick, disabled) {
    const btn = h('button', { class: 'btn', onclick: onClick, disabled: !!disabled }, label);
    return { el: h('div', { class: 'quiz-cta' }, btn), btn };
  }

  function renderStep(step, body) {
    switch (step.type) {
      case 'single':
        return single(step, body);
      case 'multi':
        return multi(step, body);
      case 'number':
        return numberStep(step, body);
      case 'info':
        if (step.chart === 'nivel') body.append(levelChart(Q.estimateLevel(answers)));
        else if (step.img) body.append(img(step.img, 'quiz-hero'));
        body.append(...title(step), h('p', { class: 'quiz-text' }, Q.resolve(step.text, answers)), cta('Continuar', next).el);
        return;
      case 'loader':
        return loader(body);
      case 'summary':
        return summary(body);
      case 'name':
        return nameStep(step, body);
      case 'email':
        return emailStep(step, body);
      case 'paywall':
        return paywall(step, body);
    }
  }

  function single(step, body) {
    const options = Q.resolve(step.options, answers);
    const grid = step.layout === 'grid';
    const pick = (v) => {
      set({ [step.id]: v });
      body.querySelectorAll('[data-v]').forEach((b) => b.classList.toggle('active', b.dataset.v === String(v)));
      clearTimers();
      later(next, 220); // um toque avança
    };
    const items = options.map((o) => {
      const active = answers[step.id] === o.value ? ' active' : '';
      if (grid && o.img) {
        return h('button', { class: 'quiz-card' + active, 'data-v': String(o.value), onclick: () => pick(o.value) }, img(o.img, 'quiz-card-img'), h('span', { class: 'quiz-card-label' }, o.label));
      }
      return h(
        'button',
        { class: 'quiz-opt' + active + (grid ? ' wide' : ''), 'data-v': String(o.value), onclick: () => pick(o.value) },
        h('span', {}, o.label, o.hint ? h('small', {}, o.hint) : null)
      );
    });
    body.append(...title(step), h('div', { class: grid ? 'quiz-grid' : 'quiz-list' }, items));
  }

  function multi(step, body) {
    const options = Q.resolve(step.options, answers);
    const value = answers[step.id] || [];
    const toggle = (v) => {
      set({ [step.id]: Q.toggleMulti(answers[step.id] || [], v, options) });
      render();
    };

    body.append(...title(step));
    if (step.bodyMap) {
      const levels = {};
      const all = value.includes('equilibrado');
      (all ? Object.keys(FOCUS_REGIONS) : value).forEach((v) => (FOCUS_REGIONS[v] || []).forEach((r) => (levels[r] = all ? 2 : 4)));
      body.append(bodyMap(levels));
    }
    const cls = step.layout === 'icons' ? 'quiz-icons' : step.bodyMap ? 'quiz-list two' : 'quiz-list';
    body.append(
      h(
        'div',
        { class: cls },
        options.map((o) =>
          h(
            'button',
            { class: 'quiz-opt check' + (value.includes(o.value) ? ' active' : ''), onclick: () => toggle(o.value) },
            o.img ? img(o.img, 'quiz-icon') : null,
            h('span', {}, o.label),
            h('i', { class: 'quiz-check', 'aria-hidden': 'true' })
          )
        )
      ),
      cta('Continuar', next, !Q.isAnswered(step, answers)).el
    );
  }

  function numberStep(step, body) {
    const raw = answers[step.id] == null ? '' : answers[step.id];
    const err = h('p', { class: 'error-msg', hidden: true }, `Digite um valor entre ${step.min} e ${step.max} ${step.unit}.`);
    const { el, btn } = cta('Continuar', next);
    const refresh = () => {
      const v = answers[step.id];
      const empty = v === '' || v === null || v === undefined;
      const ok = Q.isAnswered(step, answers);
      btn.disabled = !ok;
      btn.textContent = step.optional && empty ? 'Pular' : 'Continuar';
      err.hidden = ok || empty;
    };
    const input = h('input', {
      class: 'input',
      inputMode: step.decimal ? 'decimal' : 'numeric',
      value: String(raw),
      placeholder: step.placeholder,
      'data-autofocus': true,
      oninput: (e) => {
        const v = e.target.value.replace(step.decimal ? /[^0-9.,]/g : /[^0-9]/g, '').slice(0, 5);
        e.target.value = v;
        set({ [step.id]: v === '' ? '' : step.decimal ? v : Number(v) });
        refresh();
      },
      onkeydown: (e) => e.key === 'Enter' && Q.isAnswered(step, answers) && next(),
    });
    body.append(...title(step), h('div', { class: 'quiz-number' }, input, h('span', {}, step.unit)), err, el);
    refresh();
  }

  function loader(body) {
    const items = [`Nível: ${Q.LEVEL_LABEL[Q.estimateLevel(answers)]}`, 'Escolhendo a divisão de treino', 'Distribuindo o volume por músculo', 'Ajustando a progressão de carga'];
    const ring = h('div', { class: 'quiz-ring' }, h('span', {}, '0%'));
    const lis = items.map((t, k) => h('li', { class: k === 0 ? 'doing' : '' }, t));
    body.append(h('h1', { class: 'quiz-title' }, 'Montando seu plano…'), ring, h('ul', { class: 'quiz-steps' }, lis));
    let n = 0;
    const tick = () => {
      n++;
      const p = (n / items.length) * 100;
      ring.style.setProperty('--p', `${p}%`);
      ring.firstChild.textContent = `${Math.round(p)}%`;
      lis.forEach((li, k) => (li.className = k < n ? 'done' : k === n ? 'doing' : ''));
      if (n >= items.length) later(next, 500);
      else later(tick, 900);
    };
    later(tick, 900);
  }

  function summary(body) {
    const s = Q.planSummary(answers);
    const rows = [
      ['Objetivo', s.objetivo],
      ['Nível', s.nivel],
      ['Divisão', s.divisao],
      ['Rotina', s.rotina],
      ['Prioridade', s.foco],
      s.cuidados ? ['Cuidado com', s.cuidados] : null,
    ].filter(Boolean);
    body.append(
      ...[
        h('h1', { class: 'quiz-title' }, 'Seu plano Moviq está pronto'),
        h('p', { class: 'quiz-sub' }, 'Montado a partir das suas respostas.'),
        h('div', { class: 'card quiz-summary' }, rows.map(([k, v]) => h('div', {}, h('span', { class: 'muted' }, k), h('b', {}, v.charAt(0).toUpperCase() + v.slice(1))))),
        s.imc ? h('p', { class: 'muted', style: 'font-size:13px' }, `IMC atual: ${String(s.imc).replace('.', ',')}. É só uma referência, não leva em conta a massa muscular.`) : null,
        cta('Quero meu plano', next).el,
      ].filter(Boolean)
    );
  }

  function nameStep(step, body) {
    const { el, btn } = cta('Continuar', next, !Q.isAnswered(step, answers));
    const input = h('input', {
      class: 'input',
      autocomplete: 'given-name',
      maxLength: 80,
      value: answers.nome || '',
      placeholder: 'Seu nome',
      'data-autofocus': true,
      oninput: (e) => {
        set({ nome: e.target.value });
        btn.disabled = !Q.isAnswered(step, answers);
      },
      onkeydown: (e) => e.key === 'Enter' && Q.isAnswered(step, answers) && next(),
    });
    body.append(...title(step), input, el);
  }

  // Grava no Supabase pela API REST (função save_quiz_lead, liberada para a chave pública)
  async function saveLead(payload) {
    if (!CFG.SUPABASE_URL || !CFG.SUPABASE_KEY) throw new Error('Supabase não configurado em config.js');
    const headers = { 'Content-Type': 'application/json', apikey: CFG.SUPABASE_KEY };
    if (/^eyJ/.test(CFG.SUPABASE_KEY)) headers.Authorization = `Bearer ${CFG.SUPABASE_KEY}`; // chave "anon" antiga (JWT)
    const res = await fetch(`${CFG.SUPABASE_URL.replace(/\/+$/, '')}/rest/v1/rpc/save_quiz_lead`, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(`save_quiz_lead ${res.status}: ${await res.text()}`);
  }

  function emailStep(step, body) {
    let saving = false;
    const errBox = h('div', {});
    const { el, btn } = cta('Continuar', () => submit(), !Q.isAnswered(step, answers));

    async function submit() {
      if (!Q.isAnswered(step, answers) || saving) return;
      saving = true;
      btn.disabled = true;
      btn.textContent = 'Salvando…';
      errBox.replaceChildren();
      try {
        await saveLead({
          p_email: answers.email.trim(),
          p_name: answers.nome.trim(),
          p_answers: Q.cleanAnswers(answers),
          p_marketing: !!answers.marketing,
          p_utm: Object.keys(tracking || {}).length ? tracking : null,
        });
      } catch (e) {
        console.error(e);
        saving = false;
        btn.disabled = false;
        btn.textContent = 'Continuar';
        errBox.append(
          h('p', { class: 'error-msg' }, 'Não conseguimos salvar seu plano. Confira sua internet e tente de novo.'),
          h('button', { class: 'link-btn', style: 'display:block;margin:8px auto 0', onclick: next }, 'Continuar mesmo assim')
        );
        return;
      }
      track('Lead', { content_name: 'quiz' });
      next(); // vai para a tela de planos
    }

    const input = h('input', {
      class: 'input',
      type: 'email',
      autocomplete: 'email',
      inputMode: 'email',
      value: answers.email || '',
      placeholder: 'voce@email.com',
      'data-autofocus': true,
      oninput: (e) => {
        set({ email: e.target.value });
        if (!saving) btn.disabled = !Q.isAnswered(step, answers);
      },
      onkeydown: (e) => e.key === 'Enter' && submit(),
    });
    const box = h('input', { type: 'checkbox', checked: !!answers.marketing, onchange: (e) => set({ marketing: e.target.checked }) });

    body.append(
      ...title(step),
      h('p', { class: 'quiz-sub' }, 'Use o mesmo e-mail na compra e no app: é por ele que seu plano aparece pronto quando você entrar.'),
      input,
      h('label', { class: 'quiz-consent' }, box, h('span', {}, 'Quero receber dicas de treino e novidades do Moviq por e-mail.')),
      el,
      errBox,
      h('p', { class: 'muted quiz-legal' }, 'Seus dados ficam protegidos e são usados só para montar seu plano. Você pode pedir a exclusão a qualquer momento.')
    );
  }

  // ---------- tela de planos (depois do e-mail) ----------
  const BENEFITS = [
    'Treino do dia pronto: exercício, séries, carga e descanso',
    'Plano montado pelo Coach com IA a partir das suas respostas',
    'Mais de 5 mil exercícios com animação e instruções',
    'Carga que sobe conforme você evolui',
    'Todo o seu progresso e recordes registrados',
  ];
  const PERIOD = { 1: 'mês', 3: 'trimestre', 6: 'semestre', 12: 'ano' };
  const money = (v) => 'R$ ' + v.toFixed(2).replace('.', ',');
  const perMonth = (p) => Math.floor((p.total / p.meses) * 100) / 100; // 119,99/12 = 9,99 (como na print)
  const ICON_CHECK =
    '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';
  const ICON_SHIELD =
    '<svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="#22c55e" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"><path d="M12 3l7.5 3v5.5c0 4.6-3.2 8.2-7.5 9.5-4.3-1.3-7.5-4.9-7.5-9.5V6z"/><path d="M8.5 12.2l2.4 2.4 4.6-4.8"/></svg>';

  function paywall(step, body) {
    const plans = (CFG.PLANOS || []).filter((p) => p && p.meses > 0 && p.total > 0);
    const monthly = plans.find((p) => p.meses === 1);
    if (answers.plano === undefined || !plans.some((p) => p.meses === answers.plano)) {
      answers.plano = (plans.find((p) => p.destaque) || plans[0] || {}).meses;
    }

    const cards = plans.map((p) => {
      const pm = perMonth(p);
      // "Economize X%" só no plano em destaque (como na referência), comparado ao plano de 1 mês
      const save = p.destaque && monthly && p.meses > 1 ? Math.round((1 - pm / monthly.total) * 100) : 0;
      const card = h(
        'button',
        {
          class: 'plan' + (answers.plano === p.meses ? ' active' : '') + (p.destaque ? ' featured' : ''),
          'data-m': String(p.meses),
          onclick: () => {
            set({ plano: p.meses });
            body.querySelectorAll('.plan').forEach((c) => c.classList.toggle('active', c.dataset.m === String(p.meses)));
          },
        },
        p.destaque ? h('span', { class: 'plan-badge' }, 'MAIS ESCOLHIDO') : null,
        save > 0 ? h('span', { class: 'plan-save' }, `Economize ${save}%`) : null,
        h(
          'span',
          { class: 'plan-name' },
          h('b', {}, p.meses === 1 ? '1 mês' : `${p.meses} meses`),
          p.meses > 1 ? h('small', {}, `${money(p.total)}/${PERIOD[p.meses] || `${p.meses} meses`}`) : null
        ),
        h('span', { class: 'plan-price' }, h('b', {}, money(pm)), h('small', {}, '/mês'))
      );
      return card;
    });

    const errBox = h('div', {});
    // Envia plano + e-mail para o app (Vercel), que cria a Checkout Session da Stripe e redireciona para ela
    function go() {
      const p = plans.find((x) => x.meses === answers.plano);
      if (!p || !CFG.STRIPE_CHECKOUT_URL) {
        errBox.replaceChildren(h('p', { class: 'error-msg', style: 'text-align:center' }, 'Falta configurar o pagamento (STRIPE_CHECKOUT_URL em config.js).'));
        return;
      }
      track('InitiateCheckout', { value: p.total, currency: 'BRL', content_name: `moviq-${p.meses}m` });
      // UTMs do anúncio (guardadas desde a chegada no quiz + as da URL atual): o app grava na sessão
      // da Stripe (metadata), que é de onde a Utmify lê a origem da venda
      const utms = Object.assign({}, tracking, Q.pickTracking(window.location.search));
      const form = h(
        'form',
        { method: 'POST', action: CFG.STRIPE_CHECKOUT_URL, style: 'display:none' },
        h('input', { type: 'hidden', name: 'plano', value: `${p.meses}m` }),
        h('input', { type: 'hidden', name: 'email', value: String(answers.email || '').trim() }),
        // nome digitado no quiz: é ele que vai no link de acesso (não o nome do titular do cartão)
        h('input', { type: 'hidden', name: 'nome', value: String(answers.nome || '').trim() }),
        Object.entries(utms).map(([k, v]) => h('input', { type: 'hidden', name: k, value: String(v) }))
      );
      document.body.append(form);
      form.submit();
    }

    const legal = [
      CFG.TERMOS_URL ? h('a', { href: CFG.TERMOS_URL, target: '_blank', rel: 'noopener' }, 'Termos de uso') : null,
      CFG.PRIVACIDADE_URL ? h('a', { href: CFG.PRIVACIDADE_URL, target: '_blank', rel: 'noopener' }, 'Política de privacidade') : null,
    ].filter(Boolean);

    body.classList.add('paywall');
    body.append(
      ...[
        h('h1', { class: 'quiz-title pw-title' }, Q.resolve(step.title, answers)),
        h('ul', { class: 'card pw-benefits' }, BENEFITS.map((b) => h('li', {}, h('span', { html: ICON_CHECK }), h('span', {}, b)))),
        CFG.GARANTIA_DIAS > 0
          ? h(
              'div',
              { class: 'pw-guarantee' },
              h('span', { html: ICON_SHIELD }),
              h('div', {}, h('b', {}, `Garantia de ${CFG.GARANTIA_DIAS} dias`), h('p', {}, 'Se não gostar, é só pedir: devolvemos 100% do seu dinheiro.'))
            )
          : null,
        h('div', { class: 'pw-plans' }, cards),
        h('button', { class: 'btn pw-cta', onclick: go }, 'Garantir meu plano'),
        errBox,
        CFG.AVISO_ASSINATURA ? h('p', { class: 'muted pw-legal' }, CFG.AVISO_ASSINATURA) : null,
        legal.length ? h('p', { class: 'muted pw-links' }, legal) : null,
      ].filter(Boolean)
    );
  }

  // ---------- gráfico de nível (tela info-nivel) ----------
  // Três barras subindo (iniciante → avançado); o nível estimado fica em azul com "Você está aqui"
  // e o seguinte aparece tracejado como "Próxima etapa".
  function levelChart(level) {
    const LEVELS = ['beginner', 'intermediate', 'advanced'];
    const NAMES = ['Iniciante', 'Intermediário', 'Avançado'];
    const cur = Math.max(0, LEVELS.indexOf(level));
    const W = 340, base = 196, bw = 72, gap = 40;
    const x0 = (W - (3 * bw + 2 * gap)) / 2;
    const HEIGHTS = [64, 108, 152];
    const bx = (i) => x0 + i * (bw + gap);
    const top = (i) => base - HEIGHTS[i];

    let svg = `<svg viewBox="0 0 ${W} 228" role="img" aria-label="Seu nível: ${NAMES[cur]}">
      <defs>
        <linearGradient id="lvl-cur" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#60a5fa"/><stop offset="1" stop-color="#2563eb"/>
        </linearGradient>
        <marker id="lvl-arrow" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M0 0 L10 5 L0 10 z" fill="#3b82f6"/>
        </marker>
      </defs>
      <line x1="12" x2="${W - 12}" y1="${base}" y2="${base}" stroke="#3a3a3c" stroke-width="2"/>`;

    for (let i = 0; i < 3; i++) {
      const isCur = i === cur;
      const isNext = i === cur + 1;
      const fill = isCur ? 'url(#lvl-cur)' : isNext ? 'rgba(59,130,246,0.14)' : '#2c2c2e';
      const stroke = isNext ? ' stroke="#3b82f6" stroke-width="2" stroke-dasharray="6 5"' : '';
      svg += `<rect class="lvl-bar" style="animation-delay:${i * 0.12}s" x="${bx(i)}" y="${top(i)}" width="${bw}" height="${HEIGHTS[i]}" rx="12"${stroke} fill="${fill}"/>`;
      svg += `<text x="${bx(i) + bw / 2}" y="${base + 22}" text-anchor="middle" font-size="13" font-weight="${isCur ? 800 : 600}" fill="${isCur ? '#ffffff' : '#8e8e93'}">${NAMES[i]}</text>`;
    }

    // "Você está aqui" sobre a barra atual
    const cx = bx(cur) + bw / 2;
    const by = top(cur) - 38;
    svg += `<g class="lvl-pop">
      <rect x="${cx - 54}" y="${by}" width="108" height="26" rx="13" fill="#3b82f6"/>
      <path d="M${cx - 6} ${by + 26} L${cx} ${by + 33} L${cx + 6} ${by + 26} z" fill="#3b82f6"/>
      <text x="${cx}" y="${by + 17.5}" text-anchor="middle" font-size="12.5" font-weight="800" fill="#ffffff">Você está aqui</text>
    </g>`;

    // seta para a próxima etapa
    if (cur < 2) {
      const n = cur + 1;
      // no vão entre as barras: sai do lado direito da barra atual e sobe até a próxima
      const x1 = bx(cur) + bw + 6, y1 = top(cur) + 26;
      const x2 = bx(n) - 7, y2 = top(n) + 18;
      svg += `<g class="lvl-pop" style="animation-delay:.75s">
        <path d="M${x1} ${y1} Q ${x1 + 4} ${y2} ${x2} ${y2}" fill="none" stroke="#3b82f6" stroke-width="2.5" stroke-dasharray="4 4" marker-end="url(#lvl-arrow)"/>
        <text x="${bx(n) + bw / 2}" y="${top(n) - 10}" text-anchor="middle" font-size="11.5" font-weight="700" fill="#60a5fa">Próxima etapa</text>
      </g>`;
    }
    svg += '</svg>';
    return h('div', { class: 'quiz-chart', html: svg });
  }

  // ---------- desenho do corpo ----------
  let paths = null;
  let loading = null;

  function bodyMap(levels) {
    const wrap = h('div', { class: 'body-map' });
    const draw = () => {
      const NS = 'http://www.w3.org/2000/svg';
      wrap.replaceChildren(
        ...[paths.front, paths.back].map((view) => {
          const svg = document.createElementNS(NS, 'svg');
          svg.setAttribute('viewBox', view.vb);
          svg.setAttribute('class', 'body-view');
          svg.setAttribute('role', 'img');
          for (const [slug, list] of Object.entries(view.p)) {
            for (const d of list) {
              const p = document.createElementNS(NS, 'path');
              p.setAttribute('d', d);
              p.setAttribute('fill', INERT_REGIONS.includes(slug) ? '#48484a' : FILL[levels[slug] || 0]);
              p.setAttribute('stroke', '#000');
              p.setAttribute('stroke-width', '2');
              svg.append(p);
            }
          }
          return svg;
        })
      );
    };
    if (paths) draw();
    else {
      loading =
        loading ||
        fetch('body/muscle-paths.json')
          .then((r) => r.json())
          .then((j) => (paths = j));
      loading.then(() => wrap.isConnected && draw()).catch(() => {});
    }
    return wrap;
  }

  render();
})();
