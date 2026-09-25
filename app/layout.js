import './globals.css';
import Providers from '@/components/Providers';

export const metadata = {
  title: 'Moviq',
  description: 'Registre seus treinos, crie rotinas e acompanhe sua evolução · Registra tus entrenamientos · Enregistrez vos entraînements',
  applicationName: 'Moviq',
  appleWebApp: {
    capable: true,
    title: 'Moviq',
    statusBarStyle: 'black-translucent',
  },
  icons: {
    icon: [
      { url: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [{ url: '/apple-touch-icon.png', sizes: '180x180' }],
  },
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  viewportFit: 'cover',
  themeColor: '#0e0f13',
};

export default function RootLayout({ children }) {
  return (
    <html lang="pt">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
