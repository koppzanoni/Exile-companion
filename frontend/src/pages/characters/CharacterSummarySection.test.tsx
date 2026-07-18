import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { CharacterSummarySection } from './CharacterSummarySection';
import type { CharacterDetail } from '../../types';

// Only .resistances.current and .history are read by this component; the
// rest of BuildDoctorResult is irrelevant to what's under test here.
const detail = {
  character: {
    id: 1,
    name: 'Frostbolt',
    league: 'Standard',
    level: 90,
    className: 'Sorceress',
    ascendancy: 'Stormweaver',
    buildProfileId: '',
    stage: 'endgame',
    budget: 40,
    targetContent: '',
    currentIssues: '',
    updatedAt: '2026-01-01',
  },
  equipment: [],
  diagnosis: {
    resistances: { current: { fireResistance: 20 }, missing: { fireResistance: 55 }, cap: 75 },
  },
  history: [{ id: 1, checkId: null, summary: 'Keep: Rune Pace (~15 Exalted)', createdAt: '2026-01-01T00:00:00Z' }],
} as unknown as CharacterDetail;

describe('CharacterSummarySection', () => {
  it('renders live diagnosis totals and lets the user save a snapshot', async () => {
    const user = userEvent.setup();
    const createSnapshot = vi.fn();
    render(<CharacterSummarySection detail={detail} snapshots={[]} createSnapshot={createSnapshot} />);
    expect(screen.getByText('FIRERESISTANCE')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Save progression snapshot' }));
    expect(createSnapshot).toHaveBeenCalledTimes(1);
  });

  it('renders the analysis history', () => {
    render(<CharacterSummarySection detail={detail} snapshots={[]} createSnapshot={vi.fn()} />);
    expect(screen.getByText(/Keep: Rune Pace/)).toBeInTheDocument();
  });

  it('renders nothing when there is no character detail yet', () => {
    const { container } = render(<CharacterSummarySection detail={null} snapshots={[]} createSnapshot={vi.fn()} />);
    expect(container).toBeEmptyDOMElement();
  });
});
