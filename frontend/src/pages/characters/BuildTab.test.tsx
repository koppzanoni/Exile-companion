import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { BuildTab } from './BuildTab';

const text = (english: string) => english;
const blankLoadout = {
  patch: '',
  source: 'manual' as const,
  confidence: 'Medium' as const,
  mainSkill: '',
  weaponSet: '',
  skills: [],
  keyPassives: [],
};

describe('BuildTab', () => {
  it('edits the loadout patch and calls the save/simulate actions', async () => {
    const user = userEvent.setup();
    const setLoadout = vi.fn();
    const simulateLoadout = vi.fn();
    const saveLoadout = vi.fn();
    render(
      <BuildTab
        loadout={blankLoadout}
        setLoadout={setLoadout}
        skillsText=""
        setSkillsText={vi.fn()}
        passivesText=""
        setPassivesText={vi.fn()}
        simulateLoadout={simulateLoadout}
        saveLoadout={saveLoadout}
        simulation={null}
        knowledge={null}
        text={text}
      />,
    );
    await user.type(screen.getByLabelText('Loadout patch'), '0');
    expect(setLoadout).toHaveBeenCalledWith({ ...blankLoadout, patch: '0' });
    await user.click(screen.getByRole('button', { name: 'Simulate without saving' }));
    expect(simulateLoadout).toHaveBeenCalledTimes(1);
    await user.click(screen.getByRole('button', { name: 'Save and analyze loadout' }));
    expect(saveLoadout).toHaveBeenCalledTimes(1);
  });

  it('shows simulation and build-knowledge results when present', () => {
    render(
      <BuildTab
        loadout={blankLoadout}
        setLoadout={vi.fn()}
        skillsText=""
        setSkillsText={vi.fn()}
        passivesText=""
        setPassivesText={vi.fn()}
        simulateLoadout={vi.fn()}
        saveLoadout={vi.fn()}
        simulation={{
          before: { reservedSpirit: 0, remainingSpirit: null, dependencies: [], warnings: [] },
          after: { reservedSpirit: 10, remainingSpirit: 20, dependencies: [], warnings: [] },
          spiritDelta: 10,
          newWarnings: ['Check resistances.'],
          resolvedWarnings: [],
          safe: true,
          verdict: 'Safe to apply',
        }}
        knowledge={{
          loadout: blankLoadout,
          analysis: { reservedSpirit: 10, remainingSpirit: 20, dependencies: [], warnings: [] },
          similar: { matches: [], sampleSize: 0, confidence: 'Low', limitation: 'No local sample.' },
          provenance: { patch: '0.5', source: 'manual', confidence: 'Low' },
        }}
        text={text}
      />,
    );
    expect(screen.getByText('Safe to apply')).toBeInTheDocument();
    expect(screen.getByText(/No local sample/)).toBeInTheDocument();
  });
});
