'use client';

import Link from 'next/link';
import DeploymentMarketplace from '@/components/DeploymentMarketplace';
import type { CSSProperties } from 'react';
import { Bot, Code2, Globe, Rocket, Sparkles, WandSparkles } from 'lucide-react';
import { useLanguage } from '@/components/LanguageProvider';

const zhPromptRows = [
  '帮我做一个打砖块小游戏|把这份日报做成网页|生成一个手机端抽签页面|做个 AI 对话型登录页|用 HTML 做产品定价页|做一个课堂计分板|把表格变成可视化看板|做个活动报名页',
  '帮我部署到 htmlcode.fun|生成后直接给我链接|顺手写个项目简介|代码不要变，样式升级|做一个可分享的单页|把这段文案做成海报页|加一个倒计时组件|做个客户演示 Demo',
  '做一个 SaaS 状态页|把需求整理成 HTML 工具|生成一个 API 测试页面|做个二维码落地页|帮我上线到应用商城|做一个作品集页面|把 Markdown 转成漂亮网页|做个每日待办板',
  '做个生日祝福网页|帮我生成小游戏排行榜|做一个会议议程页|把报价单做成网页|做个品牌介绍页|生成一个问卷结果页|做一个课程表页面|帮我做灵感收集墙',
].map((row) => row.split('|'));

const enPromptRows = [
  'Build a tiny arcade game|Turn this report into a webpage|Make a mobile raffle page|Create an AI-style login screen|Design a pricing page|Build a classroom scoreboard|Turn data into a dashboard|Create an event signup page',
  'Deploy it to htmlcode.fun|Give me the live link|Add a short project description|Keep the code, polish the UI|Make a shareable one-page app|Turn this copy into a poster page|Add a countdown widget|Build a client demo',
  'Make a SaaS status page|Package this idea as an HTML tool|Create an API test page|Build a QR landing page|Publish it to the marketplace|Make a portfolio page|Convert Markdown to a polished page|Build a daily task board',
  'Make a birthday greeting page|Add a mini-game leaderboard|Create a conference agenda|Turn a quote into a webpage|Build a brand intro page|Show survey results beautifully|Make a timetable page|Create an inspiration wall',
].map((row) => row.split('|'));

const barrageTones = [
  'border-sky-200/80 bg-white/55 text-slate-500 shadow-sky-200/30',
  'border-cyan-200/80 bg-cyan-50/55 text-slate-500 shadow-cyan-200/30',
  'border-indigo-200/70 bg-indigo-50/50 text-slate-500 shadow-indigo-200/25',
  'border-emerald-200/70 bg-emerald-50/50 text-slate-500 shadow-emerald-200/25',
];

const sideBarrageRows = [
  { top: '8%', row: 0, duration: '54s', reverse: false, opacity: 'opacity-45' },
  { top: '29%', row: 1, duration: '62s', reverse: true, opacity: 'opacity-[0.38]' },
  { top: '51%', row: 2, duration: '68s', reverse: false, opacity: 'opacity-40' },
  { top: '74%', row: 3, duration: '76s', reverse: true, opacity: 'opacity-[0.34]' },
];

function BarrageTrack({
  prompts,
  duration,
  reverse = false,
}: {
  prompts: string[];
  duration: string;
  reverse?: boolean;
}) {
  return (
    <div style={{ '--duration': duration } as CSSProperties}>
      <div className={`hero-barrage-track ${reverse ? 'hero-barrage-reverse' : ''}`}>
        {[...prompts, ...prompts].map((prompt, index) => (
          <span
            key={`${prompt}-${index}`}
            className={`mx-2 inline-flex rounded-full border px-4 py-1.5 text-sm font-medium shadow-sm backdrop-blur-sm ${barrageTones[index % barrageTones.length]}`}
          >
            {prompt}
          </span>
        ))}
      </div>
    </div>
  );
}

function SideBarrage({
  side,
  promptRows,
}: {
  side: 'left' | 'right';
  promptRows: string[][];
}) {
  return (
    <div
      className={`pointer-events-none fixed bottom-0 top-20 z-0 hidden w-[calc((100vw-1200px)/2-1rem)] overflow-hidden [mask-image:linear-gradient(180deg,transparent,black_10%,black_88%,transparent)] 2xl:block ${
        side === 'left' ? 'left-0' : 'right-0'
      }`}
    >
      {sideBarrageRows.map((config, index) => (
        <div
          key={`${side}-${config.top}`}
          className={`absolute w-[760px] ${config.opacity} ${
            side === 'left'
              ? index % 2 === 0
                ? 'right-0 -translate-x-1/4'
                : 'right-0 -translate-x-1/2'
              : index % 2 === 0
                ? 'left-0 translate-x-1/4'
                : 'left-0'
          }`}
          style={{ top: config.top }}
        >
          <BarrageTrack
            prompts={promptRows[config.row]}
            duration={config.duration}
            reverse={side === 'right' ? !config.reverse : config.reverse}
          />
        </div>
      ))}
    </div>
  );
}

export default function Home() {
  const { isZh } = useLanguage();

  const text = isZh
    ? {
        badge: '开放 HTML 应用商城',
        title: '部署与分享',
        highlight: 'htmlcode.fun 应用',
        subtitle: '把想法直接告诉 Agent：它生成 HTML、调用 API 部署，然后把可访问链接交给你。',
        deploy: '前往手动部署',
        docs: '查看 API 文档',
        chips: ['告诉 Agent 需求', '秒级上线应用', '自定义短链后缀', '点赞锁定作品'],
      }
    : {
        badge: 'Open HTML App Marketplace',
        title: 'Deploy and Share',
        highlight: 'htmlcode.fun Apps',
        subtitle: 'Tell your agent what you need. It can generate HTML, deploy through the API, and return a live link.',
        deploy: 'Go to Manual Deploy',
        docs: 'View API Docs',
        chips: ['Ask your agent', 'Launch in seconds', 'Custom short links', 'Like to lock'],
      };
  const promptRows = isZh ? zhPromptRows : enPromptRows;

  return (
    <div className="relative space-y-12 pb-12">
      <SideBarrage side="left" promptRows={promptRows} />
      <SideBarrage side="right" promptRows={promptRows} />

      <div className="pointer-events-none absolute left-1/2 top-[575px] z-0 hidden w-[min(900px,calc(100vw-360px))] -translate-x-1/2 overflow-hidden opacity-55 lg:block">
        <BarrageTrack prompts={[...promptRows[0].slice(0, 4), ...promptRows[1].slice(0, 4)]} duration="60s" />
      </div>

      <section className="relative z-10 overflow-hidden rounded-[36px] border border-white/85 bg-white/55 px-6 py-12 text-slate-950 shadow-[0_28px_90px_rgba(14,116,144,0.13)] ring-1 ring-sky-100/70 backdrop-blur-xl sm:px-10 sm:py-16 lg:py-20">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_16%_18%,rgba(34,211,238,0.28),transparent_32%),radial-gradient(circle_at_82%_16%,rgba(216,180,254,0.28),transparent_32%),radial-gradient(circle_at_50%_96%,rgba(186,230,253,0.54),transparent_38%),linear-gradient(145deg,rgba(255,255,255,0.72)_0%,rgba(219,242,255,0.72)_46%,rgba(226,232,255,0.76)_100%)]" />
        <div className="pointer-events-none absolute inset-0 opacity-35 [background:linear-gradient(90deg,rgba(14,116,144,0.08)_1px,transparent_1px),linear-gradient(rgba(14,116,144,0.06)_1px,transparent_1px)] [background-size:52px_52px]" />
        <div className="pointer-events-none absolute inset-x-12 top-0 h-px bg-gradient-to-r from-transparent via-cyan-100/80 to-transparent" />
        <div className="pointer-events-none absolute left-1/2 top-1/2 h-[430px] w-[680px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/50 blur-3xl" />
        <div className="pointer-events-none absolute -left-24 bottom-[-90px] h-52 w-72 rounded-full bg-cyan-200/30 blur-3xl" />
        <div className="pointer-events-none absolute -right-24 top-[-70px] h-52 w-72 rounded-full bg-violet-200/30 blur-3xl" />

        <div className="pointer-events-none absolute inset-x-0 top-0 z-0 h-32 bg-gradient-to-b from-white/45 to-transparent" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-0 h-32 bg-gradient-to-t from-sky-100/40 to-transparent" />

        <div className="relative z-10 mx-auto max-w-4xl text-center">
          <div className="inline-flex items-center rounded-full border border-sky-200 bg-white/75 px-4 py-1 text-sm font-semibold text-sky-800 shadow-sm backdrop-blur">
            <Sparkles className="mr-2 h-4 w-4" />
            {text.badge}
          </div>
          <h1 className="mt-6 text-4xl font-black leading-tight tracking-tight text-slate-950 drop-shadow-[0_3px_18px_rgba(14,116,144,0.10)] sm:text-6xl lg:text-7xl">
            {text.title}
            <span className="block whitespace-nowrap bg-gradient-to-r from-sky-700 via-cyan-600 to-violet-600 bg-clip-text text-[2rem] leading-tight text-transparent sm:text-6xl lg:text-7xl">
              {text.highlight}
            </span>
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-base leading-7 text-slate-600 sm:text-lg">
            {text.subtitle}
          </p>

          <div className="mt-7 flex flex-wrap items-center justify-center gap-2 text-sm">
            {text.chips.map((chip, index) => {
              const Icon = [Bot, WandSparkles, Rocket, Sparkles][index];
              return (
                <span
                  key={chip}
                  className="inline-flex items-center rounded-full border border-sky-200 bg-white/70 px-3 py-1.5 font-semibold text-slate-700 shadow-sm backdrop-blur"
                >
                  <Icon className="mr-1.5 h-4 w-4 text-sky-600" />
                  {chip}
                </span>
              );
            })}
          </div>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-3 text-sm">
            <Link
              href="/deploy"
              className="inline-flex items-center rounded-xl border border-sky-300 bg-sky-600 px-4 py-2 font-semibold text-white shadow-lg shadow-sky-200/50 transition hover:border-sky-400 hover:bg-sky-700"
            >
              <Code2 className="mr-2 h-4 w-4" />
              {text.deploy}
            </Link>
            <Link
              href="/api-docs"
              className="inline-flex items-center rounded-xl border border-sky-200 bg-white/75 px-4 py-2 font-semibold text-slate-700 shadow-sm backdrop-blur transition hover:border-sky-300 hover:bg-white"
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
