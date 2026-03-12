'use client';

import React, { useEffect } from 'react';
import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react';

interface ToastProps {
  isOpen: boolean;
  message: string;
  type?: 'success' | 'error' | 'info';
  onClose: () => void;
}

export default function Toast({
  isOpen,
  message,
  type = 'info',
  onClose,
}: ToastProps) {
  useEffect(() => {
    if (!isOpen) return;

    const timer = window.setTimeout(() => {
      onClose();
    }, 3200);

    return () => window.clearTimeout(timer);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const styles = {
    success: {
      icon: CheckCircle2,
      box: 'border-green-200 bg-green-50 text-green-800',
      iconClass: 'text-green-600',
    },
    error: {
      icon: AlertCircle,
      box: 'border-red-200 bg-red-50 text-red-800',
      iconClass: 'text-red-600',
    },
    info: {
      icon: Info,
      box: 'border-blue-200 bg-blue-50 text-blue-800',
      iconClass: 'text-blue-600',
    },
  }[type];

  const Icon = styles.icon;

  return (
    <div className="fixed bottom-4 right-4 z-[60] w-[min(24rem,calc(100vw-2rem))] rounded-xl border px-4 py-3 shadow-lg backdrop-blur-sm transition-all duration-200 ${styles.box}">
      <div className="flex items-start gap-3">
        <Icon className={`mt-0.5 h-5 w-5 shrink-0 ${styles.iconClass}`} />
        <p className="flex-1 text-sm font-medium">{message}</p>
        <button
          type="button"
          onClick={onClose}
          className="rounded-md p-1 transition-colors hover:bg-black/5"
          aria-label="关闭提示"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
