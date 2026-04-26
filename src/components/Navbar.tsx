'use client';

import Link from 'next/link';
import { Braces, FileCode2, Sparkles } from 'lucide-react';
import { useLanguage } from '@/components/LanguageProvider';

export default function Navbar() {
  const { language, isZh, setLanguage } = useLanguage();

  const text = isZh
    ? {
        home: '首页',
        marketplace: '应用商城',
        deploy: '手动部署',
        apiDocs: 'API 文档',
        langCn: '简',
        langEn: 'EN',
      }
    : {
        home: 'Home',
        marketplace: 'Marketplace',
        deploy: 'Manual Deploy',
        apiDocs: 'API Docs',
        langCn: '中文',
        langEn: 'EN',
      };

  return (
    <nav className="sticky top-0 z-30 border-b border-slate-800/60 bg-slate-950/95 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-[1200px] items-center justify-between px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-8">
          <Link href="/" className="group flex shrink-0 items-center transition-transform hover:scale-105">
            <div className="relative h-11 w-11 rounded-2xl bg-gradient-to-br from-cyan-300 via-sky-500 to-indigo-600 p-[1px] shadow-[0_8px_24px_rgba(14,165,233,0.45)]">
              <div className="flex h-full w-full items-center justify-center rounded-[15px] bg-slate-950/90">
                <Braces className="h-5 w-5 text-cyan-200" strokeWidth={2.4} />
              </div>
            </div>
            <span className="ml-3 text-2xl font-black tracking-tight bg-gradient-to-br from-white to-sky-200 bg-clip-text text-transparent">htmlcode.fun</span>
          </Link>
          <div className="hidden items-center space-x-6 md:flex">
            <Link href="/" className="text-sm font-medium text-slate-300 transition-colors hover:text-white">
              {text.home}
            </Link>
            <Link href="/#marketplace" className="text-sm font-medium text-slate-300 transition-colors hover:text-white">
              {text.marketplace}
            </Link>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/deploy"
            className="inline-flex items-center rounded-xl border border-sky-400/30 bg-sky-500/10 px-3 py-2 text-sm font-semibold text-sky-200 transition hover:border-sky-300/60 hover:bg-sky-500/20 hover:text-white"
          >
            <FileCode2 className="mr-1.5 h-4 w-4" />
            {text.deploy}
          </Link>
          <Link
            href="/api-docs"
            className="inline-flex items-center rounded-xl border border-sky-400/30 bg-sky-500/10 px-3 py-2 text-sm font-semibold text-sky-200 transition hover:border-sky-300/60 hover:bg-sky-500/20 hover:text-white"
          >
            <Sparkles className="mr-1.5 h-4 w-4" />
            {text.apiDocs}
          </Link>

          <div className="mx-2 hidden h-5 w-px bg-slate-700 md:block" />

          <div className="hidden items-center gap-1 rounded-lg bg-slate-900/50 p-1 ring-1 ring-slate-800 md:flex">
            <button
              type="button"
              onClick={() => setLanguage('zh')}
              className={`rounded-md px-2.5 py-1 text-xs transition ${
                language === 'zh'
                  ? 'bg-slate-700 font-semibold text-white shadow-sm ring-1 ring-white/10'
                  : 'font-medium text-slate-400 hover:bg-slate-800/50 hover:text-slate-200'
              }`}
              aria-pressed={language === 'zh'}
              title="切换到中文"
            >
              {text.langCn}
            </button>
            <button
              type="button"
              onClick={() => setLanguage('en')}
              className={`rounded-md px-2.5 py-1 text-xs transition ${
                language === 'en'
                  ? 'bg-slate-700 font-semibold text-white shadow-sm ring-1 ring-white/10'
                  : 'font-medium text-slate-400 hover:bg-slate-800/50 hover:text-slate-200'
              }`}
              aria-pressed={language === 'en'}
              title="Switch to English"
            >
              {text.langEn}
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
}
