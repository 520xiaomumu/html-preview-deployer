import type { Metadata } from 'next';
import { Noto_Sans_SC, Space_Grotesk } from 'next/font/google';
import './globals.css';
import Navbar from '@/components/Navbar';
import { LanguageProvider } from '@/components/LanguageProvider';

const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  variable: '--font-display',
});

const notoSansSC = Noto_Sans_SC({
  subsets: ['latin'],
  variable: '--font-body',
});

export const metadata: Metadata = {
  title: 'htmlcode.fun - HTML 应用商城',
  description: '部署、管理和分享 HTML 应用的开放平台',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN">
      <body className={`${spaceGrotesk.variable} ${notoSansSC.variable}`}>
        <LanguageProvider>
          <div className="min-h-screen">
            <Navbar />
            <main className="mx-auto w-full max-w-[1200px] px-4 pb-10 pt-8 sm:px-6 lg:px-8">
              {children}
            </main>
          </div>
        </LanguageProvider>
      </body>
    </html>
  );
}
