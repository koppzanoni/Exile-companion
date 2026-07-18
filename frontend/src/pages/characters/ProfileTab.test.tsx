import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ProfileTab } from './ProfileTab';

const text = (english: string) => english;
const formatDateTime = (value: string) => value;

describe('ProfileTab', () => {
  it('shows an empty state and lets the user type a profile URL to import', async () => {
    const user = userEvent.setup();
    const setPoeNinjaUrl = vi.fn();
    const importPublicProfile = vi.fn();
    render(
      <ProfileTab
        selectedId={1}
        poeNinjaUrl=""
        setPoeNinjaUrl={setPoeNinjaUrl}
        profileLoading={false}
        importPublicProfile={importPublicProfile}
        publicProfile={null}
        profileCatalogs={null}
        profileDiagnostics={[]}
        text={text}
        formatDateTime={formatDateTime}
      />,
    );
    expect(screen.getByText('No public profile imported')).toBeInTheDocument();
    const importButton = screen.getByRole('button', { name: 'Import profile' });
    expect(importButton).toBeDisabled();
    await user.type(screen.getByLabelText('Public profile URL'), 'x');
    expect(setPoeNinjaUrl).toHaveBeenCalledWith('x');
  });

  it('renders the imported profile identity and stats', () => {
    render(
      <ProfileTab
        selectedId={1}
        poeNinjaUrl="https://poe.ninja/x"
        setPoeNinjaUrl={vi.fn()}
        profileLoading={false}
        importPublicProfile={vi.fn()}
        publicProfile={{
          source: 'poe.ninja-public-profile',
          sourceUrl: 'https://poe.ninja/x',
          importedAt: '2026-01-01T00:00:00Z',
          updatedAt: '2026-01-02T00:00:00Z',
          identity: {
            account: 'Acc',
            name: 'Frostbolt',
            league: 'Standard',
            level: 90,
            className: 'Sorceress',
            ascendancy: 'Stormweaver',
          },
          stats: { life: 4000 },
          passives: {
            allocated: 100,
            anoints: 1,
            ascendancyPoints: 8,
            bonusPassives: 0,
            treeVersion: '0.5',
            nodeIds: [1, 2],
          },
          keystones: [],
          questRewards: { claimed: [], missingCount: null, coverageNote: 'note' },
          skills: [],
          equipment: [],
          equipmentCount: 0,
          provenance: { publicProfile: true, confidence: 'High', limitations: [] },
        }}
        profileCatalogs={null}
        profileDiagnostics={[]}
        text={text}
        formatDateTime={formatDateTime}
      />,
    );
    expect(screen.getByRole('heading', { name: 'Frostbolt' })).toBeInTheDocument();
    expect(screen.getByText(/Level 90 Stormweaver/)).toBeInTheDocument();
  });
});
