import './globals.css';

export const metadata = {
  title: 'Meu Treino',
  description: 'Registre seus treinos, crie rotinas e acompanhe seu progresso',
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  themeColor: '#0e0f13',
};

export default function RootLayout({ children }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
