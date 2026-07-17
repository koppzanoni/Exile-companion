import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthGate } from './AuthGate';
import { I18nProvider } from '../i18n';

function stubFetch(handler: (url: string, init?: RequestInit) => { status: number; body: unknown }) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: string, init?: RequestInit) => {
      const { status, body } = handler(String(input), init);
      return { ok: status < 400, status, json: async () => body };
    }),
  );
}

function renderGate() {
  render(
    <I18nProvider>
      <AuthGate>
        <p>Protected content</p>
      </AuthGate>
    </I18nProvider>,
  );
}

beforeEach(() => {
  localStorage.clear();
});

describe('AuthGate', () => {
  it('renders children directly when auth status cannot be determined', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('network down');
      }),
    );
    renderGate();
    expect(await screen.findByText('Protected content')).toBeInTheDocument();
  });

  it('renders children without a gate when auth is not required', async () => {
    stubFetch((url) => {
      if (url.endsWith('/api/auth/me')) return { status: 200, body: { authenticated: false, required: false } };
      throw new Error(`unexpected request: ${url}`);
    });
    renderGate();
    expect(await screen.findByText('Protected content')).toBeInTheDocument();
  });

  it('blocks children and shows the login form when auth is required and the session is anonymous', async () => {
    stubFetch((url) => {
      if (url.endsWith('/api/auth/me')) return { status: 200, body: { authenticated: false, required: true } };
      throw new Error(`unexpected request: ${url}`);
    });
    renderGate();
    expect(await screen.findByRole('heading', { name: 'Welcome back, Exile' })).toBeInTheDocument();
    expect(screen.queryByText('Protected content')).not.toBeInTheDocument();
  });

  it('renders children immediately when already authenticated, and signs out back to the login form', async () => {
    const user = userEvent.setup();
    stubFetch((url) => {
      if (url.endsWith('/api/auth/me')) return { status: 200, body: { authenticated: true, required: true } };
      if (url.endsWith('/api/auth/logout')) return { status: 204, body: null };
      throw new Error(`unexpected request: ${url}`);
    });
    renderGate();
    expect(await screen.findByText('Protected content')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Sign out' }));
    expect(await screen.findByRole('heading', { name: 'Welcome back, Exile' })).toBeInTheDocument();
  });

  it('logs in with email and password, stores the CSRF token, and unlocks the gate', async () => {
    const user = userEvent.setup();
    stubFetch((url) => {
      if (url.endsWith('/api/auth/me')) return { status: 200, body: { authenticated: false, required: true } };
      if (url.endsWith('/api/auth/login'))
        return { status: 200, body: { user: { id: 1, email: 'a@b.com', displayName: 'A' }, csrfToken: 'tok-1' } };
      throw new Error(`unexpected request: ${url}`);
    });
    renderGate();
    await screen.findByRole('heading', { name: 'Welcome back, Exile' });
    await user.type(screen.getByLabelText('Email'), 'a@b.com');
    await user.type(screen.getByLabelText('Password'), 'longenoughpw');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(await screen.findByText('Protected content')).toBeInTheDocument();
    expect(localStorage.getItem('session-csrf')).toBe('tok-1');
  });

  it('switches to registration and shows a server error without unlocking the gate', async () => {
    const user = userEvent.setup();
    stubFetch((url) => {
      if (url.endsWith('/api/auth/me')) return { status: 200, body: { authenticated: false, required: true } };
      if (url.endsWith('/api/auth/register')) return { status: 409, body: { error: 'Email already registered.' } };
      throw new Error(`unexpected request: ${url}`);
    });
    renderGate();
    await screen.findByRole('heading', { name: 'Welcome back, Exile' });
    await user.click(screen.getByRole('button', { name: 'Create an account' }));
    expect(await screen.findByRole('heading', { name: 'Create your Exile workspace' })).toBeInTheDocument();
    await user.type(screen.getByLabelText('Name'), 'A');
    await user.type(screen.getByLabelText('Email'), 'a@b.com');
    await user.type(screen.getByLabelText('Password'), 'longenoughpw');
    await user.click(screen.getByRole('button', { name: 'Create account' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Email already registered.');
    expect(screen.queryByText('Protected content')).not.toBeInTheDocument();
  });
});
