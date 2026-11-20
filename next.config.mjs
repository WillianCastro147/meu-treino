/** @type {import('next').NextConfig} */

// O quiz de entrada (página estática em public/quiz-site) responde no subdomínio quiz.
// quiz.moviqgym.app/            -> public/quiz-site/index.html
// quiz.moviqgym.app/style.css   -> public/quiz-site/style.css (e img/, body/...)
// As rotas /api continuam do app (o botão de pagamento do quiz usa /api/stripe/checkout).
// "quiz\\..*" também vale para testes locais (ex.: quiz.localhost:3000).
const QUIZ_HOST = [{ type: 'host', value: 'quiz\\..*' }];

const nextConfig = {
  async rewrites() {
    return {
      beforeFiles: [
        { source: '/', has: QUIZ_HOST, destination: '/quiz-site/index.html' },
        // Quiz em espanhol: quiz.moviqgym.app/es (sem barra no fim: os arquivos relativos, como style.css e img/,
        // continuam saindo da raiz do quiz; "/es/" vira "/es" sozinho)
        { source: '/es', has: QUIZ_HOST, destination: '/quiz-site/es.html' },
        { source: '/:path((?!api/|_next/|quiz-site/).+)', has: QUIZ_HOST, destination: '/quiz-site/:path' },
      ],
    };
  },
};

export default nextConfig;
