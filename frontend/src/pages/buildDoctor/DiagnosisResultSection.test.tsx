import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { DiagnosisResultSection } from './DiagnosisResultSection';
import type { BuildDoctorResult } from '../../types';

const text = (english: string) => english;
const diagnosticText = (entry: { original?: string; message?: string }) => entry.original || entry.message || '';

const result: BuildDoctorResult = {
  profile: {
    build: {
      name: 'Ice Shot Deadeye',
      className: 'Ranger',
      ascendancy: 'Deadeye',
      mainSkill: 'Ice Shot',
      stage: 'endgame',
      defensiveLayers: ['evasion'],
      damageTypes: ['cold'],
    },
    overallScore: 62,
    status: 'Functional',
    equipmentCoverage: { filled: 8, total: 10, percent: 80 },
    strengths: ['Good movement speed'],
    gaps: ['Uncapped chaos resistance'],
    nextMove: 'Fix chaos resistance',
  },
  resistances: { current: { fireResistance: 75 }, missing: { fireResistance: 0 }, cap: 75 },
  attributes: { total: { dexterity: 200 }, required: {}, met: {} },
  spirit: { current: 0, note: 'No Spirit reservation configured.' },
  defenceByType: {},
  slots: [
    {
      slot: 'Boots',
      baseType: 'Stone Greaves',
      overallScore: 40,
      weaknessRank: 1,
      wastedStats: [],
      scoreBreakdown: { offence: 0, defence: 40, utility: 0 },
      statBreakdown: [],
      contributions: { resistances: {}, attributes: {}, spirit: 0, defence: {} },
    },
  ],
  weakestSlots: ['Boots'],
  wastedStatsOverall: [],
  recommendedUpgradeOrder: [{ slot: 'Boots', reason: 'Movement speed gap', budgetPriority: 'High' }],
  alerts: [],
  limitations: [],
};

const baseProps = {
  result,
  text,
  diagnosticText,
  activeSlot: '',
  setActiveSlot: vi.fn(),
  candidateItemText: '',
  setCandidateItemText: vi.fn(),
  simulation: null,
  setSimulation: vi.fn(),
  tolerance: 100,
  setTolerance: vi.fn(),
  findUpgrade: vi.fn(),
  simulateSwap: vi.fn(),
  toolLoading: false,
  equipment: [{ slot: 'Boots', itemText: 'Stone Greaves' }],
  loadedCharacter: null,
};

describe('DiagnosisResultSection', () => {
  it('renders the executive diagnosis summary', () => {
    render(<DiagnosisResultSection {...baseProps} />);
    expect(screen.getByText('Your next decisions')).toBeInTheDocument();
    expect(screen.getByText('Uncapped chaos resistance')).toBeInTheDocument();
    expect(screen.getByText('Ice Shot Deadeye')).toBeInTheDocument();
  });

  it('selects a slot from the paperdoll and opens the upgrade workbench', async () => {
    const user = userEvent.setup();
    const setActiveSlot = vi.fn();
    render(<DiagnosisResultSection {...baseProps} setActiveSlot={setActiveSlot} />);
    await user.click(screen.getByRole('button', { name: /^Boots: Stone Greaves/ }));
    expect(setActiveSlot).toHaveBeenCalledWith('Boots');
  });

  it('shows the upgrade workbench with the candidate textarea once a slot is active', () => {
    render(<DiagnosisResultSection {...baseProps} activeSlot="Boots" />);
    expect(screen.getByLabelText('Candidate item to simulate')).toBeInTheDocument();
  });

  it('renders the versioned offence summary only when the result includes one', () => {
    const { rerender } = render(<DiagnosisResultSection {...baseProps} />);
    expect(screen.queryByTestId('build-doctor-offence')).not.toBeInTheDocument();
    rerender(
      <DiagnosisResultSection
        {...baseProps}
        result={{
          ...result,
          offenceResult: {
            skillId: 'ice-shot',
            skillName: 'Ice Shot',
            patch: '0.5.x',
            patchCompatibility: 'exact',
            ailmentDps: null,
            burstDps: null,
            sustainedDps: null,
            clearCoverage: 'single-target',
            resourceBalance: { costPerSecond: null, recoveryPerSecond: null, sustainable: null },
            mechanicCoverage: {
              status: 'partial',
              covered: [],
              missing: [],
              ignored: [],
              exactDpsAvailable: false,
              reason: 'Missing geometry.',
            },
            breakpointFailures: [],
            assumptions: [],
            missingInputs: ['crit chance'],
            sourceEvidence: [],
            confidence: 'Low',
          },
        }}
      />,
    );
    expect(screen.getByTestId('build-doctor-offence')).toBeInTheDocument();
  });
});
