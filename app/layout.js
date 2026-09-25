import './globals.css';
import { LangProvider } from '@/lib/i18n';

export const metadata = {
  title: 'Moviq',
  description: 'Registre seus treinos, crie rotinas e acompanhe sua evolução · Registra tus entrenamientos · Enregistrez vos entraînements',
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  themeColor: '#0e0f13',
};

export default function RootLayout({ children }) {
  return (
    <html lang="pt">
      <body>
        <LangProvider>{children}</LangProvider>
      </body>
    </html>
  );
}
