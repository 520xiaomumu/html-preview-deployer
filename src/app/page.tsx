'use client';

import Link from 'next/link';
import DeploymentMarketplace from '@/components/DeploymentMarketplace';
import { Sparkles, Globe, Code2 } from 'lucide-react';
import { useLanguage } from '@/components/LanguageProvider';

export default function Home() {
  const { isZh } = useLanguage();

  const text = isZh
    ? {
        badge: '开放 HTML 应用商城',
        title: '部署与分享',
        highlight: 'htmlcode.fun 应用',
        deploy: '前往手动部署',
        docs: '查看 API 文档',
      }
    : {
        badge: 'Open HTML App Marketplace',
        title: 'Deploy and Share',
        highlight: 'htmlcode.fun Apps',
        deploy: 'Go to Manual Deploy',
        docs: 'View API Docs',
      };

  return (
    <div className="space-y-12 pb-12">
      <section className="relative overflow-hidden rounded-[36px] border border-sky-500/20 bg-slate-950 px-6 py-14 text-white shadow-2xl sm:px-10">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_15%,rgba(56,189,248,0.24),transparent_38%),radial-gradient(circle_at_80%_10%,rgba(14,165,233,0.20),transparent_32%),linear-gradient(160deg,#020617_0%,#0B112A_52%,#0C152E_100%)]" />
        <div className="pointer-events-none absolute inset-0 opacity-40 [background:linear-gradient(90deg,rgba(148,163,184,0.12)_1px,transparent_1px),linear-gradient(rgba(148,163,184,0.08)_1px,transparent_1px)] [background-size:48px_48px]" />

        <div className="relative mx-auto max-w-4xl text-center">
          <div className="inline-flex items-center rounded-full border border-sky-400/40 bg-sky-500/10 px-4 py-1 text-sm font-medium text-sky-200">
            <Sparkles className="mr-2 h-4 w-4" />
            {text.badge}
          </div>
          <h1 className="mt-6 text-4xl font-black leading-tight tracking-tight sm:text-6xl">
            {text.title}
            <span className="block bg-gradient-to-r from-sky-300 via-cyan-200 to-blue-300 bg-clip-text text-transparent">
              {text.highlight}
            </span>
          </h1>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-3 text-sm">
            <Link
              href="/deploy"
              className="inline-flex items-center rounded-xl border border-sky-400/40 bg-sky-500/15 px-4 py-2 font-semibold text-sky-100 transition hover:border-sky-300/80 hover:bg-sky-500/25"
            >
              <Code2 className="mr-2 h-4 w-4" />
              {text.deploy}
            </Link>
            <Link
              href="/api-docs"
              className="inline-flex items-center rounded-xl border border-white/20 bg-white/5 px-4 py-2 font-semibold text-slate-200 transition hover:border-white/40 hover:bg-white/10"
            >
              <Globe className="mr-2 h-4 w-4" />
              {text.docs}
            </Link>
          </div>
        </div>
      </section>

      <DeploymentMarketplace />
    </div>
  );
}
