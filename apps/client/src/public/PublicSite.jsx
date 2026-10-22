import React, { useEffect, useRef, useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  ArrowDown,
  ArrowRight,
  ArrowUpRight,
  AudioLines,
  Check,
  ChevronDown,
  CircleCheck,
  Menu,
  Mic,
  Moon,
  ShieldCheck,
  Sun,
  X,
} from 'lucide-react';
import i18n from '../i18n.js';
import { usePreferences } from '../preferences.js';
import en from './en.json';
import hi from './hi.json';
import './public.css';

// This namespace travels with the public route, never the bill's initial bundle.
i18n.addResourceBundle('en-IN', 'public', en, true, true);
i18n.addResourceBundle('hi-IN', 'public', hi, true, true);

const navigation = [
  ['home', '/'],
  ['about', '/about'],
  ['how', '/how-it-works'],
  ['roadmap', '/roadmap'],
];
const pageKeys = { '/': 'home', '/about': 'about', '/how-it-works': 'how', '/roadmap': 'roadmap' };

function Brand() {
  const { t } = useTranslation('public');
  return (
    <Link to="/" className="public-brand" aria-label={`${t('brand')} ${t('brandSuffix')}`}>
      <AudioLines size={29} strokeWidth={1.6} aria-hidden="true" />
      <span>
        <strong>
          {t('brand')}
          <span className="public-dot">.</span>
        </strong>
        <small>{t('brandSuffix')}</small>
      </span>
    </Link>
  );
}

function Action({ to = '/bill', children, secondary = false, ...props }) {
  return (
    <Link
      to={to}
      className={`public-action ${secondary ? 'public-action--secondary' : ''}`}
      {...props}
    >
      <span>{children}</span>
      <ArrowUpRight size={19} aria-hidden="true" />
    </Link>
  );
}

function Eyebrow({ children }) {
  return <p className="public-eyebrow">{children}</p>;
}
function Index({ value }) {
  const { i18n: language } = useTranslation('public');
  return (
    <span className="public-index">
      {new Intl.NumberFormat(language.language, { minimumIntegerDigits: 2 }).format(value)}
    </span>
  );
}

function Header() {
  const { t } = useTranslation('public');
  const { language, theme, update } = usePreferences();
  const [open, setOpen] = useState(false);
  const menu = useRef(null);
  const day =
    theme === 'day' ||
    (theme === 'auto' && window.matchMedia('(prefers-color-scheme: light)').matches);
  function close(event) {
    if (event.key === 'Escape') {
      setOpen(false);
      menu.current?.focus();
    }
  }
  return (
    <header className="public-header" onKeyDown={close}>
      <div className="public-container public-header-inner">
        <Brand />
        <nav
          id="public-navigation"
          className={`public-navigation ${open ? 'is-open' : ''}`}
          aria-label={t('nav.label')}
        >
          {navigation.map(([key, path]) => (
            <NavLink key={key} to={path} end={path === '/'} onClick={() => setOpen(false)}>
              {t(`nav.${key}`)}
            </NavLink>
          ))}
        </nav>
        <div className="public-tools">
          <label className="public-language">
            <span className="sr-only">{t('language')}</span>
            <select
              value={['en-IN', 'hi-IN'].includes(language) ? language : 'en-IN'}
              onChange={(event) => update({ language: event.target.value })}
            >
              <option value="en-IN">EN</option>
              <option value="hi-IN">हिंदी</option>
            </select>
            <ChevronDown size={12} aria-hidden="true" />
          </label>
          <button
            type="button"
            className="public-icon"
            onClick={() => update({ theme: day ? 'dark' : 'day' })}
            aria-label={t(day ? 'dark' : 'day')}
            title={t(day ? 'dark' : 'day')}
          >
            {day ? <Moon size={18} aria-hidden="true" /> : <Sun size={18} aria-hidden="true" />}
          </button>
          <Link to="/bill" className="public-header-cta">
            {t('try')}
            <ArrowUpRight size={16} aria-hidden="true" />
          </Link>
          <button
            ref={menu}
            type="button"
            className="public-icon public-menu"
            aria-expanded={open}
            aria-controls="public-navigation"
            aria-label={t(open ? 'closeMenu' : 'menu')}
            onClick={() => setOpen(!open)}
          >
            {open ? <X size={22} aria-hidden="true" /> : <Menu size={22} aria-hidden="true" />}
          </button>
        </div>
      </div>
    </header>
  );
}

function Home() {
  const { t } = useTranslation('public');
  const features = t('features.items', { returnObjects: true });
  return (
    <>
      <section className="public-hero public-container">
        <div className="public-hero-copy">
          <Eyebrow>{t('hero.eyebrow')}</Eyebrow>
          <h1>
            <span>{t('hero.line1')}</span>
            <span className="public-blue">{t('hero.line2')}</span>
            <span className="public-hero-final">{t('hero.line3')}</span>
          </h1>
          <p className="public-hero-body">{t('hero.body')}</p>
          <div className="public-actions">
            <Action>{t('try')}</Action>
            <Link to="/how-it-works" className="public-text-link">
              {t('seeHow')}
              <ArrowRight size={17} aria-hidden="true" />
            </Link>
          </div>
          <p className="public-small public-hero-note">
            <span className="public-status-dot" />
            {t('hero.note')}
          </p>
        </div>
        <figure className="public-hero-visual">
          <img
            src="/images/kirana-shopkeeper.webp"
            alt={t('hero.imageAlt')}
            width="1672"
            height="941"
            fetchPriority="high"
          />
          <figcaption>
            <span>{t('hero.caption')}</span>
            <small>{t('hero.imageNote')}</small>
          </figcaption>
          <div className="public-voice-example">
            <div className="public-voice-symbol">
              <Mic size={21} aria-hidden="true" />
            </div>
            <div>
              <p className="public-voice-label">{t('hero.voiceLabel')}</p>
              <p className="public-voice-phrase" lang="hi">
                {t('hero.phrase')}
              </p>
              <p className="public-small">{t('hero.translation')}</p>
              <p className="public-voice-note">{t('hero.voiceNote')}</p>
            </div>
          </div>
        </figure>
        <a href="#purpose" className="public-scroll">
          <ArrowDown size={18} aria-hidden="true" />
          <span className="sr-only">{t('readStory')}</span>
        </a>
      </section>

      <section id="purpose" className="public-section public-container public-intro">
        <div>
          <Eyebrow>{t('intro.eyebrow')}</Eyebrow>
          <h2>{t('intro.title')}</h2>
        </div>
        <div>
          <p className="public-body-large">{t('intro.body')}</p>
          <div className="public-tags">
            {t('intro.tags', { returnObjects: true }).map((tag) => (
              <span key={tag}>{tag}</span>
            ))}
          </div>
          <Link className="public-text-link" to="/about">
            {t('readStory')}
            <ArrowUpRight size={18} aria-hidden="true" />
          </Link>
        </div>
      </section>

      <section className="public-section public-container public-features">
        <div className="public-section-heading">
          <div>
            <Eyebrow>{t('features.eyebrow')}</Eyebrow>
            <h2>{t('features.title')}</h2>
          </div>
          <span className="public-status">{t('planned')}</span>
        </div>
        {features.map((feature, index) => (
          <article className="public-feature" key={feature.title}>
            <Index value={index + 1} />
            <h3>{feature.title}</h3>
            <div>
              <p>{feature.body}</p>
              <p className="public-small public-blue">{feature.detail}</p>
            </div>
            <ArrowUpRight size={24} aria-hidden="true" />
          </article>
        ))}
      </section>

      <section className="public-mission">
        <div className="public-container public-mission-inner">
          <Eyebrow>{t('missionStrip.eyebrow')}</Eyebrow>
          <h2>{t('missionStrip.title')}</h2>
          <div>
            <p>{t('missionStrip.body')}</p>
            <Action to="/about" secondary>
              {t('readStory')}
            </Action>
          </div>
        </div>
      </section>

      <section className="public-section public-container public-preview">
        <div>
          <Eyebrow>{t('preview.eyebrow')}</Eyebrow>
          <h2>{t('preview.title')}</h2>
          <p className="public-body-large">{t('preview.body')}</p>
          <Action to="/roadmap" secondary>
            {t('seeRoadmap')}
          </Action>
        </div>
        <div className="public-available">
          <span className="public-status">{t('current')}</span>
          <h3>{t('preview.today')}</h3>
          <ul>
            {t('preview.items', { returnObjects: true }).map((item) => (
              <li key={item}>
                <Check size={18} aria-hidden="true" />
                {item}
              </li>
            ))}
          </ul>
          <p className="public-small">{t('preview.notice')}</p>
        </div>
      </section>
      <Faq />
    </>
  );
}

function PageIntro({ page }) {
  const { t } = useTranslation('public');
  return (
    <div className={`public-page-intro public-container public-page-intro--${page}`}>
      <Eyebrow>{t(`${page}.eyebrow`)}</Eyebrow>
      <h1>{t(`${page}.title`)}</h1>
      <p>{t(`${page}.lead`)}</p>
    </div>
  );
}

function About() {
  const { t } = useTranslation('public');
  return (
    <>
      <PageIntro page="about" />
      <section className="public-container public-about-story">
        <div className="public-about-photo">
          <img
            src="/images/kirana-shopkeeper.webp"
            alt={t('hero.imageAlt')}
            width="1672"
            height="941"
          />
          <span>{t('hero.imageNote')}</span>
        </div>
        <div className="public-story-copy">
          {['who', 'why'].map((key) => (
            <div key={key}>
              <h2>{t(`about.${key}Title`)}</h2>
              <p>{t(`about.${key}Body`)}</p>
            </div>
          ))}
        </div>
      </section>
      <section className="public-section public-container public-mission-vision">
        {['mission', 'vision'].map((key, index) => (
          <article key={key}>
            <Index value={index + 1} />
            <h2>{t(`about.${key}Title`)}</h2>
            <p>{t(`about.${key}Body`)}</p>
          </article>
        ))}
      </section>
      <section id="principles" className="public-section public-container">
        <Eyebrow>{t('footer.principles')}</Eyebrow>
        <h2>{t('about.principlesTitle')}</h2>
        <div className="public-principles">
          {t('about.principles', { returnObjects: true }).map((item, index) => (
            <article key={item.title}>
              <Index value={index + 1} />
              <h3>{item.title}</h3>
              <p>{item.body}</p>
            </article>
          ))}
        </div>
      </section>
      <section className="public-container public-responsibility">
        <ShieldCheck size={32} aria-hidden="true" />
        <div>
          <h2>{t('about.privacyTitle')}</h2>
          <p>{t('about.privacyBody')}</p>
          <Link className="public-text-link" to="/roadmap">
            {t('about.privacyLink')}
            <ArrowUpRight size={18} aria-hidden="true" />
          </Link>
        </div>
      </section>
    </>
  );
}

function HowItWorks() {
  const { t } = useTranslation('public');
  return (
    <>
      <PageIntro page="how" />
      <section className="public-container public-steps">
        {t('how.steps', { returnObjects: true }).map((step, index) => (
          <article className="public-step" key={step.title}>
            <div className="public-step-copy">
              <Index value={index + 1} />
              <h2>{step.title}</h2>
              <p>{step.body}</p>
              <p className="public-small public-blue">{step.detail}</p>
            </div>
            <div className="public-step-visual">
              <span className="public-status">{t('planned')}</span>
              <AudioLines size={48} strokeWidth={1} aria-hidden="true" />
              <p>{step.example}</p>
              <span className="public-step-line" aria-hidden="true" />
            </div>
          </article>
        ))}
      </section>
      <section className="public-section public-container public-intro">
        <div>
          <Eyebrow>{t('planned')}</Eyebrow>
          <h2>{t('how.resilienceTitle')}</h2>
        </div>
        <p className="public-body-large">{t('how.resilienceBody')}</p>
      </section>
      <section className="public-container public-now">
        <span className="public-status">{t('current')}</span>
        <h2>{t('how.nowTitle')}</h2>
        <p>{t('how.nowBody')}</p>
        <Action>{t('try')}</Action>
      </section>
    </>
  );
}

function Roadmap() {
  const { t, i18n: language } = useTranslation('public');
  const items = t('roadmap.items', { returnObjects: true });
  const groups = [
    ['foundation', 0, 2],
    ['counter', 2, 9],
    ['growth', 9, 13],
    ['readiness', 13, 15],
  ];
  return (
    <>
      <PageIntro page="roadmap" />
      <div className="public-container public-roadmap">
        {groups.map(([group, start, end]) => (
          <section key={group} className="public-roadmap-group">
            <Eyebrow>{t(`roadmap.${group}`)}</Eyebrow>
            <ol start={start + 1}>
              {items.slice(start, end).map((item, index) => {
                const phase = start + index + 1;
                return (
                  <li
                    key={phase}
                    className={phase <= 2 ? 'is-built' : phase === 3 ? 'is-next' : ''}
                  >
                    <Index value={phase} />
                    <div>
                      <p className="public-small">
                        {t('phase', {
                          number: new Intl.NumberFormat(language.language).format(phase),
                        })}
                      </p>
                      <h2>{item.title}</h2>
                      <p>{item.body}</p>
                    </div>
                    <span className="public-phase-status">
                      {phase <= 2 && <CircleCheck size={16} aria-hidden="true" />}
                      {t(phase <= 2 ? 'complete' : phase === 3 ? 'next' : 'planned')}
                    </span>
                  </li>
                );
              })}
            </ol>
          </section>
        ))}
        <p className="public-small">{t('roadmap.timing')}</p>
      </div>
      <section className="public-section public-container public-intro">
        <h2>{t('roadmap.afterTitle')}</h2>
        <p className="public-body-large">{t('roadmap.afterBody')}</p>
      </section>
    </>
  );
}

function Faq() {
  const { t } = useTranslation('public');
  return (
    <section id="questions" className="public-section public-container public-faq">
      <div>
        <Eyebrow>{t('faq.eyebrow')}</Eyebrow>
        <h2>{t('faq.title')}</h2>
      </div>
      <div>
        {t('faq.items', { returnObjects: true }).map((item) => (
          <details key={item.q}>
            <summary>
              {item.q}
              <ChevronDown size={18} aria-hidden="true" />
            </summary>
            <p>{item.a}</p>
          </details>
        ))}
      </div>
    </section>
  );
}

function Footer() {
  const { t } = useTranslation('public');
  return (
    <>
      <section className="public-cta">
        <div className="public-container">
          <Eyebrow>{t('cta.eyebrow')}</Eyebrow>
          <h2>{t('cta.title')}</h2>
          <p>{t('cta.body')}</p>
          <Action>{t('try')}</Action>
        </div>
      </section>
      <footer className="public-container public-footer">
        <div className="public-footer-top">
          <div>
            <Brand />
            <p className="public-footer-tagline">{t('footer.tagline')}</p>
            <p className="public-small">{t('footer.note')}</p>
          </div>
          <nav aria-label={t('footer.product')}>
            <h2>{t('footer.product')}</h2>
            <Link to="/how-it-works">{t('nav.how')}</Link>
            <Link to="/roadmap">{t('nav.roadmap')}</Link>
            <Link to="/bill">{t('try')}</Link>
          </nav>
          <nav aria-label={t('footer.project')}>
            <h2>{t('footer.project')}</h2>
            <Link to="/about">{t('nav.about')}</Link>
            <Link to="/about#principles">{t('footer.principles')}</Link>
            <Link to="/#questions">{t('footer.faq')}</Link>
            <a
              href="https://github.com/Utkarsh2294/Kirana-Voice-Copilot"
              target="_blank"
              rel="noreferrer"
            >
              {t('footer.source')}
              <ArrowUpRight size={14} aria-hidden="true" />
            </a>
          </nav>
        </div>
        <div className="public-footer-bottom">
          <p>
            <span className="public-status-dot" />
            {t('footer.status')}
          </p>
          <p>{t('footer.disclaimer')}</p>
        </div>
      </footer>
    </>
  );
}

const pages = { home: Home, about: About, how: HowItWorks, roadmap: Roadmap };

export default function PublicSite() {
  const { pathname, hash } = useLocation();
  const { t, i18n: language } = useTranslation('public');
  const { language: preference } = usePreferences();
  const page = pageKeys[pathname.replace(/\/$/, '') || '/'];
  const Page = pages[page];
  const main = useRef(null);
  const previousPath = useRef(pathname);
  useEffect(() => {
    const previousTitle = document.title;
    const description = document.querySelector('meta[name="description"]');
    const previousDescription = description?.getAttribute('content');
    document.title = t(`meta.${page}.title`);
    document
      .querySelector('meta[name="description"]')
      ?.setAttribute('content', t(`meta.${page}.description`));
    return () => {
      document.title = previousTitle;
      if (previousDescription) description?.setAttribute('content', previousDescription);
    };
  }, [page, t, language.language]);
  useEffect(() => {
    if (hash) document.getElementById(hash.slice(1))?.scrollIntoView({ behavior: 'instant' });
    else window.scrollTo({ top: 0, behavior: 'instant' });
    if (previousPath.current !== pathname) main.current?.focus({ preventScroll: true });
    previousPath.current = pathname;
  }, [pathname, hash]);
  return (
    <div className="public-site">
      <a className="skip-link" href="#public-main">
        {t('skip')}
      </a>
      <Header key={pathname} />
      {!['en-IN', 'hi-IN'].includes(preference) && (
        <p className="public-fallback public-container">{t('fallback')}</p>
      )}
      <main ref={main} id="public-main" tabIndex={-1}>
        <Page />
      </main>
      <Footer />
    </div>
  );
}
