'use client';

import Link from 'next/link';
import { FileCode2, Sparkles } from 'lucide-react';
import { useLanguage } from '@/components/LanguageProvider';

function LogoMark() {
  return (
    <svg
      className="h-[52px] w-[52px] drop-shadow-[0_10px_22px_rgba(99,102,241,0.22)]"
      viewBox="0 0 96 96"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="logo-bg" x1="12" x2="84" y1="10" y2="86">
          <stop stopColor="#101348" />
          <stop offset="0.55" stopColor="#172D67" />
          <stop offset="1" stopColor="#155E75" />
        </linearGradient>
        <linearGradient id="logo-window" x1="32" x2="66" y1="36" y2="72">
          <stop stopColor="#FFFFFF" />
          <stop offset="1" stopColor="#EAF7FF" />
        </linearGradient>
        <linearGradient id="logo-header" x1="32" x2="68" y1="34" y2="44">
          <stop stopColor="#60A5FA" />
          <stop offset="1" stopColor="#8B5CF6" />
        </linearGradient>
        <linearGradient id="logo-orbit" x1="8" x2="86" y1="72" y2="22">
          <stop stopColor="#22D3EE" />
          <stop offset="1" stopColor="#C084FC" />
        </linearGradient>
      </defs>
      <rect x="5" y="5" width="86" height="86" rx="26" fill="url(#logo-bg)" />
      <path
        d="M13 67C32 45 60 36 84 29"
        fill="none"
        stroke="url(#logo-orbit)"
        strokeLinecap="round"
        strokeWidth="4"
        opacity="0.9"
      />
      <path
        d="M17 73C35 59 61 49 86 43"
        fill="none"
        stroke="#A78BFA"
        strokeLinecap="round"
        strokeWidth="3"
        opacity="0.55"
      />
      <rect x="15" y="22" width="25" height="14" rx="6" fill="#F8FAFC" opacity="0.96" />
      <path d="M20 29h7M23.5 25.5v7" stroke="#312E81" strokeLinecap="round" strokeWidth="2" />
      <circle cx="32" cy="27" r="2" fill="#86EFAC" />
      <circle cx="36" cy="31" r="2" fill="#FB7185" />
      <rect x="61" y="20" width="20" height="20" rx="6" fill="#24195F" stroke="#C084FC" strokeWidth="2" />
      <rect x="65" y="24" width="5" height="5" rx="1.2" fill="#F472B6" />
      <rect x="72" y="24" width="5" height="5" rx="1.2" fill="#86EFAC" />
      <rect x="65" y="31" width="5" height="5" rx="1.2" fill="#38BDF8" />
      <rect x="72" y="31" width="5" height="5" rx="1.2" fill="#FBBF24" />
      <rect x="17" y="70" width="25" height="15" rx="5" fill="#F8FAFC" opacity="0.96" />
      <rect x="21" y="75" width="9" height="6" rx="1.5" fill="#38BDF8" />
      <path d="M33 76h5M33 80h4" stroke="#A5B4FC" strokeLinecap="round" strokeWidth="1.8" />
      <rect x="63" y="68" width="22" height="15" rx="5" fill="#20174F" stroke="#8B5CF6" strokeWidth="1.8" />
      <path d="M68 78a5 5 0 1 0 5-5v5z" fill="#38BDF8" />
      <path d="M73 73a5 5 0 0 1 4.5 2.8L73 78z" fill="#FB7185" />
      <path d="M78 73h4M78 78h3" stroke="#A5B4FC" strokeLinecap="round" strokeWidth="1.5" />
      <rect x="31" y="35" width="36" height="39" rx="11" fill="url(#logo-window)" />
      <path d="M31 45a10 10 0 0 1 10-10h16a10 10 0 0 1 10 10v5H31z" fill="url(#logo-header)" />
      <circle cx="39" cy="44" r="2.7" fill="#F472B6" />
      <circle cx="48" cy="44" r="2.7" fill="#FBBF24" />
      <circle cx="57" cy="44" r="2.7" fill="#86EFAC" />
      <path d="M27 57q-8 6-6 13" fill="none" stroke="#E0F2FE" strokeLinecap="round" strokeWidth="5" />
      <path d="M70 56q8-1 10-7" fill="none" stroke="#E0F2FE" strokeLinecap="round" strokeWidth="5" />
      <path d="M38 58q3-4 7 0" fill="none" stroke="#111827" strokeLinecap="round" strokeWidth="3" />
      <path d="M53 58q3-4 7 0" fill="none" stroke="#111827" strokeLinecap="round" strokeWidth="3" />
      <path d="M45 66q4 4 9 0" fill="#FB7185" stroke="#831843" strokeLinecap="round" strokeWidth="1.6" />
      <circle cx="18" cy="47" r="3" fill="#A78BFA" />
      <circle cx="78" cy="56" r="2.4" fill="#22D3EE" />
      <path d="M52 16l2.2 4.5 4.8 1.3-4.8 1.3L52 27.5l-2.2-4.4-4.8-1.3 4.8-1.3z" fill="#BAE6FD" />
      <path d="M76 48l1.3 2.6 2.7.7-2.7.8-1.3 2.5-1.3-2.5-2.7-.8 2.7-.7z" fill="#F0ABFC" />
    </svg>
  );
}

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
    <nav className="sticky top-0 z-30 border-b border-sky-200/60 bg-sky-50/82 shadow-[0_10px_34px_rgba(14,116,144,0.10)] backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-[1200px] items-center justify-between px-4 sm:px-6 lg:px-8">
        <div className="flex min-w-0 items-center gap-4 md:gap-8">
          <Link href="/" className="group flex shrink-0 items-center transition-transform hover:scale-105">
            <LogoMark />
            <span className="ml-3 text-xl font-black tracking-tight text-slate-900 sm:text-2xl">htmlcode.fun</span>
          </Link>
          <div className="hidden items-center space-x-6 md:flex">
            <Link href="/" className="text-sm font-semibold text-slate-600 transition-colors hover:text-sky-800">
              {text.home}
            </Link>
            <Link href="/#marketplace" className="text-sm font-semibold text-slate-600 transition-colors hover:text-sky-800">
              {text.marketplace}
            </Link>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/deploy"
            className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-sky-200 bg-white/75 text-sm font-semibold text-sky-800 shadow-sm transition hover:border-sky-300 hover:bg-white sm:w-auto sm:px-3"
            title={text.deploy}
          >
            <FileCode2 className="h-4 w-4 sm:mr-1.5" />
            <span className="hidden sm:inline">{text.deploy}</span>
          </Link>
          <Link
            href="/api-docs"
            className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-sky-200 bg-white/75 text-sm font-semibold text-sky-800 shadow-sm transition hover:border-sky-300 hover:bg-white sm:w-auto sm:px-3"
            title={text.apiDocs}
          >
            <Sparkles className="h-4 w-4 sm:mr-1.5" />
            <span className="hidden sm:inline">{text.apiDocs}</span>
          </Link>

          <div className="mx-2 hidden h-5 w-px bg-sky-200 md:block" />

          <div className="hidden items-center gap-1 rounded-lg bg-white/70 p-1 ring-1 ring-sky-200 md:flex">
            <button
              type="button"
              onClick={() => setLanguage('zh')}
              className={`rounded-md px-2.5 py-1 text-xs transition ${
                language === 'zh'
                  ? 'bg-slate-900/80 font-semibold text-white shadow-sm'
                  : 'font-medium text-slate-500 hover:bg-sky-50 hover:text-slate-800'
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
                  ? 'bg-slate-900/80 font-semibold text-white shadow-sm'
                  : 'font-medium text-slate-500 hover:bg-sky-50 hover:text-slate-800'
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
