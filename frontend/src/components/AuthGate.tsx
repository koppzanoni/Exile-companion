import { useEffect, useState, type ReactNode } from 'react';
import { Gem, LoaderCircle, LogIn, ShieldCheck, UserPlus } from 'lucide-react';
import { api } from '../api';
import { useI18n } from '../i18n';
import { LanguageSelector } from './LanguageSelector';

export function AuthGate({ children }: { children: ReactNode }) {
  const { t } = useI18n();
  const [state, setState] = useState<'loading' | 'open' | 'login' | 'ready'>('loading');
  const [authenticated, setAuthenticated] = useState(false);
  const [register, setRegister] = useState(false),
    [email, setEmail] = useState(''),
    [password, setPassword] = useState(''),
    [displayName, setDisplayName] = useState(''),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    api
      .authMe()
      .then((result) => {
        setAuthenticated(result.authenticated);
        if (result.csrfToken) localStorage.setItem('session-csrf', result.csrfToken);
        setState(result.authenticated || !result.required ? 'ready' : 'login');
      })
      .catch(() => setState('open'));
  }, []);
  async function submit() {
    setBusy(true);
    setError('');
    try {
      const result = register
        ? await api.authRegister({ email, password, displayName })
        : await api.authLogin({ email, password });
      localStorage.setItem('session-csrf', result.csrfToken);
      setAuthenticated(true);
      setState('ready');
      window.dispatchEvent(new Event('auth-changed'));
    } catch (value) {
      setError(value instanceof Error ? value.message : t('auth.genericError'));
    } finally {
      setBusy(false);
    }
  }
  async function signInWithPoe() {
    setBusy(true);
    setError('');
    try {
      const { url } = await api.authPoeStart();
      window.location.assign(url);
    } catch (value) {
      setError(value instanceof Error ? value.message : t('auth.poeUnavailable'));
      setBusy(false);
    }
  }
  if (state === 'loading')
    return (
      <main className="auth-screen">
        <LoaderCircle className="spin" />
        <p>{t('auth.preparing')}</p>
      </main>
    );
  if (state === 'open') return <>{children}</>;
  if (state === 'login')
    return (
      <main className="auth-screen">
        <section className="auth-card">
          <LanguageSelector />
          <span className="brand-mark">
            <Gem />
          </span>
          <h1>{register ? t('auth.createTitle') : t('auth.welcome')}</h1>
          <p>{t('auth.subtitle')}</p>
          <button className="poe-login-button" type="button" onClick={() => void signInWithPoe()} disabled={busy}>
            <ShieldCheck />
            {t('auth.poe')}
          </button>
          <small className="auth-provider-note">{t('auth.poeHelp')}</small>
          <div className="auth-divider">
            <span>{t('auth.emailDivider')}</span>
          </div>
          {register && (
            <label>
              {t('auth.name')}
              <input value={displayName} onChange={(event) => setDisplayName(event.target.value)} autoComplete="name" />
            </label>
          )}
          <label>
            {t('auth.email')}
            <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" />
          </label>
          <label>
            {t('auth.password')}
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete={register ? 'new-password' : 'current-password'}
              onKeyDown={(event) => event.key === 'Enter' && void submit()}
            />
          </label>
          {error && (
            <div role="alert" className="error-box">
              {error}
            </div>
          )}
          <button
            className="primary-button"
            type="button"
            onClick={submit}
            disabled={busy || !email || password.length < 10 || (register && !displayName)}
          >
            {busy ? <LoaderCircle className="spin" /> : register ? <UserPlus /> : <LogIn />}
            {register ? t('auth.create') : t('auth.signIn')}
          </button>
          <button
            type="button"
            className="text-button"
            onClick={() => {
              setRegister(!register);
              setError('');
            }}
          >
            {register ? t('auth.hasAccount') : t('auth.newAccount')}
          </button>
        </section>
      </main>
    );
  return (
    <>
      {authenticated && (
        <button
          className="session-logout"
          type="button"
          onClick={async () => {
            await api.authLogout();
            localStorage.removeItem('session-csrf');
            setAuthenticated(false);
            setState('login');
          }}
        >
          {t('auth.signOut')}
        </button>
      )}
      {children}
    </>
  );
}
