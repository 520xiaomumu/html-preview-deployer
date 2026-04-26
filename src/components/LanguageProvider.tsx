'use client';

import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';

type Language = 'zh' | 'en';

interface LanguageContextValue {
  language: Language;
  isZh: boolean;
  setLanguage: (language: Language) => void;
}

const STORAGE_KEY = 'htmlcode.fun-language';

const LanguageContext = createContext<LanguageContextValue | null>(null);

const detectPreferredLanguage = (): Language => {
  if (typeof window === 'undefined') return 'zh';

  const saved = window.localStorage.getItem(STORAGE_KEY);
  if (saved === 'zh' || saved === 'en') {
    return saved;
  }

  return navigator.language.toLowerCase().startsWith('zh') ? 'zh' : 'en';
};

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguage] = useState<Language>(() => detectPreferredLanguage());

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, language);
    document.documentElement.lang = language === 'zh' ? 'zh-CN' : 'en';
  }, [language]);

  const value = useMemo(
    () => ({
      language,
      isZh: language === 'zh',
      setLanguage,
    }),
    [language],
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within LanguageProvider');
  }
  return context;
}