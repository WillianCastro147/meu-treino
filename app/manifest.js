// Permite instalar o Moviq como app (ícone próprio e tela cheia)
export default function manifest() {
  return {
    name: 'Moviq',
    short_name: 'Moviq',
    description: 'Workouts, routines and progress · Treinos · Entrenamientos · Entraînements',
    start_url: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#0e0f13',
    theme_color: '#0e0f13',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
