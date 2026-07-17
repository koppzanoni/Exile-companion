import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BuildDoctorPage } from './BuildDoctorPage';

beforeEach(() => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => ({
      ok: true,
      status: 200,
      json: async () => {
        if (url.endsWith('/api/build-profiles'))
          return { profiles: [{ id: 'generic-build-fit', source: 'generic', name: 'Generic Build Fit' }] };
        if (url.endsWith('/api/characters'))
          return {
            characters: [
              {
                id: 7,
                name: 'SavedHero',
                league: 'Standard',
                level: 74,
                className: 'Ranger',
                ascendancy: 'Deadeye',
                buildProfileId: 'generic-build-fit',
                stage: 'endgame',
                budget: 10,
                targetContent: '',
                currentIssues: '',
                updatedAt: '2026-07-14',
              },
            ],
          };
        if (url.endsWith('/api/poe/oauth/status')) return { configured: false, required: [], connections: [] };
        if (url.endsWith('/api/characters/7/snapshots')) return { snapshots: [] };
        if (url.includes('/api/characters/7/action-plan')) {
          const budget = Number(new URL(url, 'http://localhost').searchParams.get('budget') || 0);
          return {
            characterId: 7,
            budget,
            score: 42,
            purchases: [
              {
                rank: 1,
                slot: 'Ring 1',
                reason: 'Lowest score.',
                priority: 'High',
                suggestedBudget: budget,
                tradeUrl: null,
                requiresEquippedItem: false,
              },
            ],
            blockers: [],
            warning: 'Planning only.',
          };
        }
        if (url.endsWith('/api/characters/7'))
          return {
            character: {
              id: 7,
              name: 'SavedHero',
              league: 'Standard',
              level: 74,
              className: 'Ranger',
              ascendancy: 'Deadeye',
              buildProfileId: 'generic-build-fit',
              stage: 'endgame',
              budget: 10,
              targetContent: '',
              currentIssues: '',
              updatedAt: '2026-07-14',
            },
            equipment: [
              {
                slot: 'Ring 1',
                itemText: 'Item Class: Rings\nRarity: Rare\nSaved Loop\nGold Ring\n+20% to Fire Resistance',
              },
            ],
            diagnosis: null,
            history: [],
          };
        if (url.endsWith('/api/build-doctor/simulate-swap'))
          return {
            slot: 'Ring 1',
            verdict: 'Clear upgrade',
            scoreDelta: 9,
            beforeScore: 42,
            afterScore: 51,
            newGaps: [],
            resolvedGaps: ['55% fire resistance missing'],
            diagnosis: {},
          };
        if (url.endsWith('/api/gemini/chat'))
          return {
            available: true,
            model: 'gemini-test',
            result: {
              answer: 'Replace Ring 1 after preserving Dexterity.',
              confidence: 'High',
              factsUsed: ['Ring 1 is the weakest slot.'],
              suggestedActions: [
                { label: 'Inspect Ring 1', action: 'inspect_slot', slot: 'Ring 1', reason: 'It has the lowest score.' },
              ],
              warnings: [],
            },
          };
        return {
          profile: {
            build: {
              name: 'Generic Build Fit',
              className: 'Any',
              mainSkill: '',
              stage: 'endgame',
              defensiveLayers: ['life'],
              damageTypes: [],
            },
            overallScore: 42,
            status: 'Needs work',
            equipmentCoverage: { filled: 1, total: 1, percent: 100 },
            strengths: ['Equipment attribute requirements are currently met.'],
            gaps: ['55% fire resistance missing'],
            nextMove: 'Start with Ring 1: replace weak stats.',
          },
          resistances: {
            current: { fireResistance: 20, coldResistance: 0, lightningResistance: 0, chaosResistance: 0 },
            missing: { fireResistance: 55, coldResistance: 75, lightningResistance: 75, chaosResistance: 75 },
            cap: 75,
          },
          attributes: {
            total: { strength: 0, dexterity: 30, intelligence: 0 },
            required: { strength: 0, dexterity: 120, intelligence: 0 },
            met: { strength: true, dexterity: false, intelligence: true },
          },
          spirit: { current: 0, note: 'Spirit requirement depends on active skills/gems, which are not yet tracked.' },
          defenceByType: { armour: 100, evasion: 0, energyShield: 0, deflection: 0, runicWard: 0 },
          slots: [
            {
              slot: 'Ring 1',
              baseType: 'Gold Ring',
              overallScore: 40,
              weaknessRank: 40,
              wastedStats: [],
              scoreBreakdown: { offence: 0, defence: 30, utility: 10 },
              statBreakdown: [
                {
                  stat: 'Fire Resistance',
                  value: 20,
                  score: 30,
                  category: 'defence',
                  reason: 'Helps reach the resistance cap.',
                  conditional: true,
                  wasted: false,
                },
              ],
              contributions: { resistances: {}, attributes: {}, spirit: 0, defence: {} },
            },
          ],
          weakestSlots: ['Ring 1'],
          wastedStatsOverall: [],
          recommendedUpgradeOrder: [
            {
              slot: 'Ring 1',
              reason: 'Lowest stat-valuation score (40/100) among equipped items.',
              budgetPriority: 'High',
            },
          ],
          alerts: [
            {
              slot: 'Ring 1',
              message:
                'Do not replace this Ring 1 before recovering 90 dexterity; another equipped item requires 120 dexterity and only 30 would remain.',
            },
          ],
          limitations: [
            'Suggested budget is a relative priority (High/Medium/Low), not a currency amount, because no verified crafting/market cost model is attached to this diagnosis.',
          ],
        };
      },
    })),
  );
});

describe('build doctor page', () => {
  it('loads saved character equipment and diagnoses it without manual pasting', async () => {
    const user = userEvent.setup();
    render(<BuildDoctorPage />);
    await user.selectOptions(await screen.findByLabelText('Saved character'), '7');
    await user.click(screen.getByRole('button', { name: /Load & diagnose/i }));
    expect(await screen.findByRole('status')).toHaveTextContent('SavedHero');
    expect((screen.getByLabelText('Ring 1 item text') as HTMLTextAreaElement).value).toContain('Saved Loop');
    expect(await screen.findByTestId('build-doctor-result')).toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: 'Upgrade roadmaps' })).toBeInTheDocument();
    expect(screen.getByText('Economy')).toBeInTheDocument();
    await user.click(screen.getAllByRole('button', { name: 'Save roadmap' })[0]);
    expect(screen.getByRole('alertdialog')).toHaveTextContent('Save Economy roadmap?');
    await user.click(screen.getByRole('button', { name: /Confirm save/i }));
    expect(await screen.findByText(/Economy roadmap saved/i)).toBeInTheDocument();
  });

  it('diagnoses pasted equipment and shows swap-safety alerts', async () => {
    const user = userEvent.setup();
    render(<BuildDoctorPage />);
    fireEvent.change(screen.getByLabelText('Ring 1 item text'), {
      target: {
        value:
          'Item Class: Rings\nRarity: Rare\nEmber Loop\nGold Ring\n--------\nRequires: Level 60, 38 Dex\n--------\n+30 Dexterity\n+20% to Fire Resistance',
      },
    });
    await user.click(screen.getByRole('button', { name: /Diagnose build/i }));
    expect(await screen.findByText(/before recovering 90 dexterity/i)).toBeInTheDocument();
    expect(screen.getAllByText('Gold Ring').length).toBeGreaterThan(0);
    expect(screen.getByText('42')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Generic Build Fit' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Your next decisions' })).toBeInTheDocument();
    await user.click(screen.getByText(/Why this score/i));
    expect(screen.getByText(/Helps reach the resistance cap/i)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Ring 1 40 Gold Ring/i }));
    expect(screen.getByText(/70–90% finds cheaper alternatives/i)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Candidate item to simulate'), {
      target: { value: 'Item Class: Rings\nRarity: Rare\nUpgrade\nGold Ring\n+75% to Fire Resistance' },
    });
    await user.click(screen.getByRole('button', { name: /Simulate swap/i }));
    expect(await screen.findByText('Clear upgrade')).toBeInTheDocument();
    expect(screen.getByText(/42 → 51/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'What should I upgrade first within my budget?' }));
    expect(await screen.findByText(/Replace Ring 1 after preserving Dexterity/i)).toBeInTheDocument();
    expect(screen.getByText(/High confidence/i)).toBeInTheDocument();
  });
});
