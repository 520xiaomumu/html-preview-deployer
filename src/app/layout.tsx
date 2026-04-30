import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'htmlteam',
  description: 'Agent-native HTML deployment API and CLI.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
