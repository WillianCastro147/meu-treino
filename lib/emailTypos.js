// Checagem de e-mail digitado errado para o app. A regra fica num arquivo só, o do quiz estático
// (public/quiz-site/email-check.js), que se registra em globalThis.MoviqEmailCheck.
import '../public/quiz-site/email-check.js';

// { valido, sugestao }: ver public/quiz-site/email-check.js
export const checkEmail = (email) => globalThis.MoviqEmailCheck.checkEmail(email);
