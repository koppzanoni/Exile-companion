import {
  Activity,
  Archive,
  ArrowRight,
  BookOpen,
  ChevronDown,
  CircleDollarSign,
  Crosshair,
  Database,
  Gem,
  LoaderCircle,
  Menu,
  RefreshCw,
  Settings,
  Stethoscope,
  Swords,
  TrendingUp,
  Users,
  X,
} from 'lucide-react';
import { Component, lazy, Suspense, useEffect, useState, type ErrorInfo, type ReactNode } from 'react';
import { NavLink, Route, Routes, useLocation } from 'react-router-dom';
import { AuthGate } from './components/AuthGate';
import { LanguageSelector } from './components/LanguageSelector';
import { useI18n } from './i18n';

const DashboardPage = lazy(() => import('./pages/DashboardPage').then((module) => ({ default: module.DashboardPage }))),
  AnalyzerPage = lazy(() => import('./pages/AnalyzerPage').then((module) => ({ default: module.AnalyzerPage }))),
  CharactersPage = lazy(() => import('./pages/CharactersPage').then((module) => ({ default: module.CharactersPage }))),
  BuildPage = lazy(() => import('./pages/BuildPage').then((module) => ({ default: module.BuildPage }))),
  BuildDoctorPage = lazy(() =>
    import('./pages/BuildDoctorPage').then((module) => ({ default: module.BuildDoctorPage })),
  ),
  LevelingPage = lazy(() => import('./pages/LevelingPage').then((module) => ({ default: module.LevelingPage }))),
  SalesPage = lazy(() => import('./pages/SalesPage').then((module) => ({ default: module.SalesPage }))),
  SavedPage = lazy(() => import('./pages/SavedPage').then((module) => ({ default: module.SavedPage }))),
  KnowledgePage = lazy(() => import('./pages/KnowledgePage').then((module) => ({ default: module.KnowledgePage }))),
  SettingsPage = lazy(() => import('./pages/SettingsPage').then((module) => ({ default: module.SettingsPage }))),
  DocsPage = lazy(() => import('./pages/DocsPage').then((module) => ({ default: module.DocsPage })));

function RouteFallback() {
  const { t } = useI18n();
  return (
    <div className="route-state" role="status" aria-live="polite">
      <LoaderCircle className="spin" />
      <strong>{t('app.loading')}</strong>
      <span>{t('app.loadingDetail')}</span>
    </div>
  );
}
function AppErrorState({ retry }: { retry: () => void }) {
  const { t } = useI18n();
  return (
    <div className="route-state route-error" role="alert">
      <RefreshCw />
      <strong>{t('app.error')}</strong>
      <span>{t('app.dataSafe')}</span>
      <button type="button" onClick={retry}>
        {t('app.retry')}
      </button>
    </div>
  );
}
class AppErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Page render failed', error, info.componentStack);
  }
  render() {
    if (this.state.failed)
      return (
        <AppErrorState
          retry={() => {
            this.setState({ failed: false });
            window.location.reload();
          }}
        />
      );
    return this.props.children;
  }
}

const primaryNav = [
  ['/', Activity, 'nav.dashboard'],
  ['/analyze-item', Crosshair, 'nav.analyze'],
  ['/characters', Users, 'nav.characters'],
  ['/build-doctor', Stethoscope, 'nav.doctor'],
  ['/leveling', TrendingUp, 'nav.leveling'],
] as const;
const secondaryNav = [
  ['/build', Swords, 'nav.builds'],
  ['/sales', CircleDollarSign, 'nav.sales'],
  ['/saved', Archive, 'nav.history'],
  ['/knowledge', Database, 'nav.atlas'],
  ['/settings', Settings, 'nav.settings'],
  ['/docs', BookOpen, 'nav.guide'],
] as const;
const allNav = [...primaryNav, ...secondaryNav] as const;

export default function App() {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const location = useLocation();
  const current = allNav.find(([to]) => to === location.pathname) || primaryNav[0];
  const PageIcon = current[1];
  const onSecondaryRoute = secondaryNav.some(([to]) => to === location.pathname);
  useEffect(() => {
    if (onSecondaryRoute) setMoreOpen(true);
  }, [onSecondaryRoute]);
  const navLink = ([to, Icon, key]: (typeof allNav)[number]) => {
    const label = t(key);
    return (
      <NavLink
        key={to}
        to={to}
        title={label}
        onClick={() => setOpen(false)}
        className={({ isActive }) => (isActive ? 'active' : '')}
      >
        <Icon size={17} />
        <span>{label}</span>
      </NavLink>
    );
  };
  return (
    <AuthGate>
      <a className="skip-link" href="#main-content">
        {t('nav.skip')}
      </a>
      <div className="app-shell">
        <button
          className="menu-button"
          onClick={() => setOpen(!open)}
          aria-label={t('nav.toggle')}
          aria-expanded={open}
          aria-controls="primary-navigation"
        >
          {open ? <X /> : <Menu />}
        </button>
        {open && <button className="nav-scrim" aria-label={t('nav.close')} onClick={() => setOpen(false)} />}
        <aside className={open ? 'sidebar open' : 'sidebar'}>
          <NavLink to="/" className="brand" aria-label="Exile Companion home">
            <span className="brand-mark">
              <Gem size={17} />
            </span>
            <span>
              <strong>EXILE COMPANION</strong>
              <small>POE 2 BUILD ASSISTANT</small>
            </span>
          </NavLink>
          <nav id="primary-navigation" aria-label={t('nav.primary')} className="nav">
            {primaryNav.map(navLink)}
            <button
              className={onSecondaryRoute ? 'nav-more active' : 'nav-more'}
              type="button"
              onClick={() => setMoreOpen((value) => !value)}
              aria-expanded={moreOpen}
            >
              <ChevronDown className={moreOpen ? 'rotated' : ''} size={17} />
              <span>{moreOpen ? t('nav.less') : t('nav.more')}</span>
            </button>
            {moreOpen && secondaryNav.map(navLink)}
          </nav>
          <div className="sidebar-build">
            <small>{t('app.workspace').toUpperCase()}</small>
            <strong>{t('app.personalize')}</strong>
            <span>{t('app.workspaceDetail')}</span>
            <NavLink to="/build">
              {t('app.configure')} <ArrowRight size={13} />
            </NavLink>
          </div>
        </aside>
        <div className="app-content">
          <header className="topbar">
            <div className="page-context">
              <PageIcon size={17} />
              <strong>{t(current[2])}</strong>
            </div>
            <div className="topbar-actions">
              <span className="official-pill service-unknown" title={t('app.serviceUnknown')}>
                <i /> TRADE2 UNKNOWN
              </span>
              <LanguageSelector compact />
              <NavLink to="/settings" aria-label={t('app.settings')} className="settings-shortcut">
                <Settings size={16} />
              </NavLink>
            </div>
          </header>
          <main id="main-content" tabIndex={-1}>
            <AppErrorBoundary>
              <Suspense fallback={<RouteFallback />}>
                <Routes>
                  <Route path="/" element={<DashboardPage />} />
                  <Route path="/analyze-item" element={<AnalyzerPage />} />
                  <Route path="/characters" element={<CharactersPage />} />
                  <Route path="/build" element={<BuildPage />} />
                  <Route path="/build-doctor" element={<BuildDoctorPage />} />
                  <Route path="/leveling" element={<LevelingPage />} />
                  <Route path="/sales" element={<SalesPage />} />
                  <Route path="/saved" element={<SavedPage />} />
                  <Route path="/knowledge" element={<KnowledgePage />} />
                  <Route path="/settings" element={<SettingsPage />} />
                  <Route path="/docs" element={<DocsPage />} />
                </Routes>
              </Suspense>
            </AppErrorBoundary>
          </main>
          <footer>
            <span>EXILE COMPANION</span>
            <span>{t('app.footer')}</span>
          </footer>
        </div>
      </div>
    </AuthGate>
  );
}
