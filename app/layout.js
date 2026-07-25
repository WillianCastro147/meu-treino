import './globals.css';

export const metadata = {
  title: 'Moviq',
  description: 'Enregistrez vos entraînements, créez vos routines et suivez vos progrès',
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  themeColor: '#0e0f13',
};

export default function RootLayout({ children }) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  );
}
