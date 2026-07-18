import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { PoeAccountSection } from './PoeAccountSection';

const text = (english: string) => english;

describe('PoeAccountSection', () => {
  it('offers to connect when there is no PoE account yet', async () => {
    const user = userEvent.setup();
    const connectPoe = vi.fn();
    render(
      <PoeAccountSection
        poe={{ configured: true, required: [], connections: [] }}
        remoteCharacters={[]}
        syncing={false}
        loadRemote={vi.fn()}
        importRemote={vi.fn()}
        connectPoe={connectPoe}
        text={text}
      />,
    );
    await user.click(screen.getByRole('button', { name: 'Connect Path of Exile account' }));
    expect(connectPoe).toHaveBeenCalledTimes(1);
  });

  it('lists remote characters once connected and lets the user import equipped gear', async () => {
    const user = userEvent.setup();
    const importRemote = vi.fn();
    render(
      <PoeAccountSection
        poe={{
          configured: true,
          required: [],
          connections: [
            { id: 9, username: 'SteamExile', scope: 'account:characters', lastSyncAt: null, lastError: null },
          ],
        }}
        remoteCharacters={[{ name: 'Frostbolt', league: 'Standard', level: 90 }]}
        syncing={false}
        loadRemote={vi.fn()}
        importRemote={importRemote}
        connectPoe={vi.fn()}
        text={text}
      />,
    );
    expect(screen.getByText('SteamExile')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Import equipped gear' }));
    expect(importRemote).toHaveBeenCalledWith(9, 'Frostbolt');
  });

  it('shows a configuration warning when OAuth is not set up on the server', () => {
    render(
      <PoeAccountSection
        poe={{ configured: false, required: ['POE_OAUTH_CLIENT_ID'], connections: [] }}
        remoteCharacters={[]}
        syncing={false}
        loadRemote={vi.fn()}
        importRemote={vi.fn()}
        connectPoe={vi.fn()}
        text={text}
      />,
    );
    expect(screen.getByText(/OAuth is not configured/)).toBeInTheDocument();
  });
});
