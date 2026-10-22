import React, { useEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { m } from 'motion/react';
import {
  ArrowUpRight,
  AudioLines,
  BookOpen,
  ChartNoAxesCombined,
  FlaskConical,
  LayoutGrid,
  ReceiptText,
  Settings2,
  Store,
  Wifi,
  WifiOff,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { usePreferences } from '../preferences.js';
import { date } from '../format.js';
import { LanguagePicker, OfflineBanner } from './primitives.jsx';
import { MicButton } from './Voice.jsx';
import { useUi } from './overlays.jsx';
import { useReducedMotion } from './PreferencesProvider.jsx';

const links = [
  { path: 'bill', Icon: ReceiptText },
  { path: 'insights', Icon: ChartNoAxesCombined },
  { path: 'catalog', Icon: LayoutGrid },
  { path: 'settings', Icon: Settings2 },
];
export function Shell({ children }) {
  const { t } = useTranslation();
  const { language, update } = usePreferences();
  const [online, setOnline] = useState(navigator.onLine);
  const { notify } = useUi();
  const reduce = useReducedMotion();
  const location = useLocation();
  const navigate = useNavigate();
  const pointerNavigation = useRef(false);
  useEffect(() => {
    const handle = () => setOnline(navigator.onLine);
    window.addEventListener('online', handle);
    window.addEventListener('offline', handle);
    return () => {
      window.removeEventListener('online', handle);
      window.removeEventListener('offline', handle);
    };
  }, []);
  function transition(event, path) {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)
      return;
    pointerNavigation.current = event.detail !== 0;
    if (!reduce && pointerNavigation.current && document.startViewTransition) {
      event.preventDefault();
      document.startViewTransition(() => flushSync(() => navigate(path)));
    }
  }
  const NavItem = ({ path, Icon }) => (
    <NavLink
      to={`/${path}`}
      onClick={(event) => transition(event, `/${path}`)}
      className={({ isActive }) => `nav-item ${isActive ? 'is-active' : ''}`}
    >
      <Icon size={21} strokeWidth={1.7} />
      <span>{t(`nav.${path}`)}</span>
    </NavLink>
  );
  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">
        {t('common.skipContent')}
      </a>
      <aside className="sidebar">
        <NavLink to="/" className="wordmark" aria-label={t('nav.home')}>
          <span className="brand-icon">
            <AudioLines size={24} />
          </span>
          <span>
            <strong>
              {t('brand.name')}
              <i aria-hidden="true">.</i>
            </strong>
            <small>{t('brand.suffix')}</small>
          </span>
        </NavLink>
        <div className="rail-store">
          <span>
            <Store size={18} />
          </span>
          <div>
            <strong>{t('brand.store')}</strong>
            <p>{t('prototype.short')}</p>
          </div>
        </div>
        <p className="rail-label">{t('brand.workspace')}</p>
        <nav className="rail-nav" aria-label={t('brand.workspace')}>
          {links.map((link) => (
            <NavItem key={link.path} {...link} />
          ))}
        </nav>
        <div className="rail-bottom">
          {import.meta.env.DEV && (
            <NavLink className="gallery-link" to="/dev/ui">
              <BookOpen size={18} />
              <span>{t('nav.gallery')}</span>
              <ArrowUpRight size={14} />
            </NavLink>
          )}
          <div className="rail-note">
            <AudioLines size={20} />
            <p>{t('brand.madeFor')}</p>
          </div>
          <div className="rail-owner">
            <span className="avatar">{t('brand.initials')}</span>
            <div>
              <strong>{t('brand.store')}</strong>
              <p>{t('brand.version')}</p>
            </div>
          </div>
        </div>
      </aside>
      <div className="workspace">
        <header className="topbar">
          <NavLink to="/" className="topbar-store" aria-label={t('nav.home')}>
            <Store size={20} />
            <span>{t('brand.store')}</span>
          </NavLink>
          <p className="greeting">
            {t('brand.owner')}
            <span className="greeting-dot" />
          </p>
          <div className="topbar-tools">
            <span
              className={`connection ${online ? '' : 'connection--offline'}`}
              title={t('status.local')}
            >
              {online ? <Wifi size={15} /> : <WifiOff size={15} />}
              <span>{t(online ? 'status.online' : 'status.offline')}</span>
            </span>
            <span className="topbar-divider" />
            <LanguagePicker
              compact
              value={language}
              onChange={(value) => update({ language: value })}
            />
            <span className="avatar avatar--small">{t('brand.initials')}</span>
          </div>
        </header>
        <OfflineBanner offline={!online} />
        <div className="prototype-strip">
          <FlaskConical size={14} />
          <span>{t('prototype.banner')}</span>
          <span className="today">
            {date(new Date(), { day: 'numeric', month: 'short', year: 'numeric' })}
          </span>
        </div>
        {!['en-IN', 'hi-IN'].includes(language) && (
          <p className="language-notice">{t('prototype.languageFallback')}</p>
        )}
        <main id="main-content" tabIndex={-1}>
          <m.div
            key={location.pathname}
            initial={
              !reduce && pointerNavigation.current && !document.startViewTransition
                ? { opacity: 0, transform: 'translateY(6px)' }
                : false
            }
            animate={{ opacity: 1, transform: 'none' }}
            transition={{ duration: 0.22 }}
          >
            {children}
          </m.div>
        </main>
        <div className="desktop-mic">
          <MicButton docked onComplete={() => notify(t('prototype.voice'))} />
          <span>{t('voice.hint')}</span>
        </div>
      </div>
      <nav className="bottom-nav" aria-label={t('brand.workspace')}>
        {links.slice(0, 2).map((link) => (
          <NavItem key={link.path} {...link} />
        ))}
        <div className="nav-mic">
          <MicButton docked onComplete={() => notify(t('prototype.voice'))} />
        </div>
        {links.slice(2).map((link) => (
          <NavItem key={link.path} {...link} />
        ))}
      </nav>
    </div>
  );
}
