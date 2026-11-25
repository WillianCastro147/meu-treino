// Checagem de e-mail digitado errado (gmail.con, gmai.com, 205gmail.com, tahoo.com.br...).
// Usado no quiz (página estática: <script src="email-check.js">, window.MoviqEmailCheck) e no app
// (lib/emailTypos.js importa este mesmo arquivo). Sem dependências.
//
// Por quê: compradores digitavam o e-mail errado no quiz, ele ia para o checkout e para a conta, e nenhum
// e-mail chegava (boas-vindas, redefinição de senha). O Supabase avisou de alta taxa de devolução em 25/11/2026.
//
// checkEmail(email) -> { valido, sugestao }
//   valido:   false quando o formato é inválido ou o final não existe (.con, .comm, .coml...)
//   sugestao: o e-mail corrigido quando parece erro de digitação de um provedor conhecido; senão null
(function () {
  // Provedor -> finais válidos (o primeiro é o mais comum, usado quando o final digitado não existe)
  const PROVEDORES = {
    gmail: ['com'],
    googlemail: ['com'],
    hotmail: ['com', 'com.br', 'es', 'fr', 'it', 'de', 'co.uk', 'com.ar', 'com.mx', 'cl'],
    outlook: ['com', 'com.br', 'es', 'fr', 'it', 'de', 'com.ar', 'com.mx', 'cl', 'pt'],
    live: ['com', 'com.mx', 'com.ar', 'fr', 'it', 'de', 'co.uk', 'cl', 'com.pt'],
    yahoo: ['com', 'com.br', 'es', 'fr', 'it', 'de', 'co.uk', 'co.jp', 'com.ar', 'com.mx', 'cl', 'com.co', 'com.pe'],
    icloud: ['com'],
    me: ['com'],
    msn: ['com'],
    aol: ['com'],
    bol: ['com.br'],
    uol: ['com.br'],
    terra: ['com.br', 'es', 'com'],
    ig: ['com.br'],
    globo: ['com'],
    gmx: ['com', 'de', 'net', 'fr'],
    protonmail: ['com'],
    proton: ['me'],
    mail: ['com', 'ru'],
    email: ['com'],
    orange: ['fr'],
    free: ['fr'],
    sfr: ['fr'],
    laposte: ['net'],
    wanadoo: ['fr'],
    web: ['de'],
    libero: ['it'],
    yandex: ['com', 'ru'],
  };
  // Finais que não existem (erros de digitação de ".com")
  const FINAL_INVALIDO = /\.(con|comm|coml|comn|cmo|ocm|vom|xom|cim|cpm|copm|coom|c0m|ccom|cok|vcom|comk)$/;
  const FORMATO = /^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/;

  // Distância de edição em que trocar duas letras vizinhas conta 1 ("gmial" -> "gmail")
  function distancia(a, b) {
    const m = a.length, n = b.length;
    const d = Array.from({ length: m + 1 }, (_, i) => Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)));
    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        const custo = a[i - 1] === b[j - 1] ? 0 : 1;
        d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + custo);
        if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
      }
    }
    return d[m][n];
  }

  // Final válido mais parecido com o digitado ("co" -> "com", "com.br" do gmail -> "com")
  function melhorFinal(finais, digitado) {
    let melhor = finais[0], d = Infinity;
    for (const f of finais) {
      const x = distancia(f, digitado);
      if (x < d) (d = x), (melhor = f);
    }
    return d <= 2 ? melhor : finais[0];
  }

  // Provedor que o nome digitado parece ser: exato, com letras trocadas ("gmai", "tahoo") ou com sujeira
  // grudada na frente ("205gmail", "ggmail"). Nomes curtos (me, ig, aol...) só valem exatos.
  function provedorDe(nome) {
    if (PROVEDORES[nome]) return nome;
    let melhor = null, d = Infinity;
    for (const p of Object.keys(PROVEDORES)) {
      if (p.length < 5) continue;
      const x = distancia(nome, p);
      if (x < d) (d = x), (melhor = p);
    }
    if (melhor && d <= (melhor.length >= 7 ? 2 : 1)) return melhor;
    for (const p of Object.keys(PROVEDORES)) {
      if (p.length >= 5 && nome.endsWith(p) && nome.length - p.length <= 4) return p;
    }
    return null;
  }

  function checkEmail(email) {
    const e = String(email || '').trim().toLowerCase();
    if (!FORMATO.test(e) || e.length > 254) return { valido: false, sugestao: null };
    const arroba = e.lastIndexOf('@');
    const local = e.slice(0, arroba);
    let dominio = e.slice(arroba + 1);

    const finalInvalido = FINAL_INVALIDO.test(dominio);
    if (finalInvalido) dominio = dominio.replace(FINAL_INVALIDO, '.com');

    const ponto = dominio.indexOf('.');
    const nome = dominio.slice(0, ponto);
    const final = dominio.slice(ponto + 1);
    const p = provedorDe(nome);

    let sugerido = dominio;
    if (p) {
      const finais = PROVEDORES[p];
      sugerido = `${p}.${finais.includes(final) ? final : melhorFinal(finais, final)}`;
    }
    const sugestao = sugerido !== e.slice(arroba + 1) ? `${local}@${sugerido}` : null;
    return { valido: !finalInvalido, sugestao };
  }

  globalThis.MoviqEmailCheck = { checkEmail };
})();
