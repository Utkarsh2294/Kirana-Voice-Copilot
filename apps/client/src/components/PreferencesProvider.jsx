import React, { useEffect, useState } from 'react';
import { LazyMotion, MotionConfig } from 'motion/react';
import { languages } from '@kirana/shared/languages';
import { selectLanguage } from '../i18n.js';
import { usePreferences } from '../preferences.js';

const loadFeatures = () => import('./motion-features.js').then((module) => module.default);
export function useReducedMotion() {
  const reduce = usePreferences((state) => state.reduceMotion);
  const [system, setSystem] = useState(
    () => matchMedia('(prefers-reduced-motion: reduce)').matches,
  );
  useEffect(() => {
    const query = matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setSystem(query.matches);
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);
  return reduce || system;
}

export function PreferencesProvider({ children }) {
  const { theme, language } = usePreferences();
  const reduce = useReducedMotion();
  useEffect(() => {
    const query = matchMedia('(prefers-color-scheme: light)');
    const apply = () => {
      const resolved = theme === 'auto' ? (query.matches ? 'day' : 'dark') : theme;
      document.documentElement.dataset.theme = resolved;
      document
        .querySelector('meta[name="theme-color"]')
        ?.setAttribute('content', resolved === 'day' ? '#F6F7F9' : '#0A0A0A');
    };
    apply();
    query.addEventListener('change', apply);
    return () => query.removeEventListener('change', apply);
  }, [theme]);
  useEffect(() => {
    document.documentElement.dataset.reducedMotion = String(reduce);
  }, [reduce]);
  useEffect(() => {
    selectLanguage(language);
    const script = languages.find((item) => item.code === language)?.script;
    let link = document.getElementById('indic-font');
    if (script === 'Latin') {
      link?.remove();
      document.documentElement.style.removeProperty('--font-script');
      return;
    }
    const family = `Noto Sans ${script}`;
    if (!link) {
      link = document.createElement('link');
      link.id = 'indic-font';
      link.rel = 'stylesheet';
      document.head.append(link);
    }
    // Google's CSS serves unicode-range subsets; only the selected script is requested.
    link.href = `https://fonts.googleapis.com/css2?family=${family.replaceAll(' ', '+')}:wght@400;500;600;700&display=swap`;
    document.documentElement.style.setProperty('--font-script', `"${family}"`);
  }, [language]);
  return (
    <MotionConfig
      reducedMotion={reduce ? 'always' : 'never'}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
    >
      <LazyMotion features={loadFeatures}>{children}</LazyMotion>
    </MotionConfig>
  );
}
