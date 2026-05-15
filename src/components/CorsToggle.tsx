'use client';

import { useEffect, useState } from 'react';
import { Shield, ShieldCheck, X } from 'lucide-react';
import { useLanguage } from '@/components/LanguageProvider';

export default function CorsToggle() {
  const { isZh } = useLanguage();
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const text = isZh
    ? {
        on: 'CORS 已开启',
        off: 'CORS 已关闭',
        loading: '加载中…',
        titleEnable: '开启 CORS',
        titleDisable: '关闭 CORS',
        passwordLabel: '请输入密码',
        passwordPlaceholder: '密码',
        cancel: '取消',
        confirmEnable: '开启',
        confirmDisable: '关闭',
        wrongPassword: '密码错误',
        networkError: '网络错误，请稍后再试',
        empty: '密码不能为空',
      }
    : {
        on: 'CORS On',
        off: 'CORS Off',
        loading: 'Loading…',
        titleEnable: 'Enable CORS',
        titleDisable: 'Disable CORS',
        passwordLabel: 'Enter password',
        passwordPlaceholder: 'Password',
        cancel: 'Cancel',
        confirmEnable: 'Enable',
        confirmDisable: 'Disable',
        wrongPassword: 'Wrong password',
        networkError: 'Network error, try again',
        empty: 'Password is required',
      };

  useEffect(() => {
    let cancelled = false;
    fetch('/api/cors', { cache: 'no-store' })
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled && typeof data?.enabled === 'boolean') {
          setEnabled(data.enabled);
        }
      })
      .catch(() => {
        if (!cancelled) setEnabled(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const closeDialog = () => {
    setDialogOpen(false);
    setPassword('');
    setError(null);
    setSubmitting(false);
  };

  const openDialog = () => {
    setError(null);
    setPassword('');
    setDialogOpen(true);
  };

  const submit = async () => {
    if (enabled === null) return;
    if (!password) {
      setError(text.empty);
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/cors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password, enabled: !enabled }),
      });
      if (res.status === 401) {
        setError(text.wrongPassword);
        setSubmitting(false);
        return;
      }
      if (!res.ok) {
        setError(text.networkError);
        setSubmitting(false);
        return;
      }
      const data = await res.json();
      if (typeof data?.enabled === 'boolean') {
        setEnabled(data.enabled);
      }
      closeDialog();
    } catch {
      setError(text.networkError);
      setSubmitting(false);
    }
  };

  const label =
    enabled === null ? text.loading : enabled ? text.on : text.off;
  const Icon = enabled ? ShieldCheck : Shield;
  const buttonClass = enabled
    ? 'border-emerald-300 bg-emerald-50/80 text-emerald-700 hover:border-emerald-400 hover:bg-emerald-50'
    : 'border-sky-200 bg-white/75 text-slate-600 hover:border-sky-300 hover:bg-white';

  const dialogTitle = enabled ? text.titleDisable : text.titleEnable;
  const confirmLabel = enabled ? text.confirmDisable : text.confirmEnable;

  return (
    <>
      <button
        type="button"
        onClick={openDialog}
        disabled={enabled === null}
        title={label}
        className={`inline-flex h-10 w-10 items-center justify-center rounded-xl border text-sm font-semibold shadow-sm transition disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto sm:px-3 ${buttonClass}`}
      >
        <Icon className="h-4 w-4 sm:mr-1.5" />
        <span className="hidden sm:inline">{label}</span>
      </button>

      {dialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl">
            <div className="mb-4 flex items-start justify-between">
              <h3 className="text-lg font-semibold text-slate-900">
                {dialogTitle}
              </h3>
              <button
                type="button"
                onClick={closeDialog}
                className="text-slate-400 transition hover:text-slate-600"
                aria-label={text.cancel}
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              {text.passwordLabel}
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  void submit();
                }
              }}
              placeholder={text.passwordPlaceholder}
              autoFocus
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-200"
            />
            {error && (
              <p className="mt-2 text-sm text-red-600">{error}</p>
            )}
            <div className="mt-5 flex justify-end gap-3">
              <button
                type="button"
                onClick={closeDialog}
                className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
              >
                {text.cancel}
              </button>
              <button
                type="button"
                onClick={() => void submit()}
                disabled={submitting}
                className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
