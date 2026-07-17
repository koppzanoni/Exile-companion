import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AnalyzerPage } from './AnalyzerPage';

beforeEach(() => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => ({
      ok: true,
      status: 200,
      json: async () =>
        url.endsWith('/api/build-profiles')
          ? {
              profiles: [
                profile('generic-build-fit', 'Generic Build Fit'),
                profile('ice-shot-deadeye', 'Ice Shot Deadeye'),
                profile('cold-caster', 'Cold Caster'),
              ],
            }
          : url.endsWith('/api/item/normalize')
            ? { item: normalized() }
            : url.endsWith('/api/build-profile')
              ? { profile: null }
              : { divineToExalted: 65, defaultLeague: 'Runes of Aldur' },
    })),
  );
});

describe('analyzer form', () => {
  it('defaults to the simplified Beginner flow: paste item, choose character/build, analyze — advanced controls stay collapsed', async () => {
    render(<AnalyzerPage />);
    await screen.findByText(/Every recommendation explains itself/i);
    expect(screen.getByLabelText('Item text')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Who is this for?' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Analyze item' })).toBeInTheDocument();
    expect(screen.queryByLabelText('League')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Manual listings')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Enable equipped comparison' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Advanced options/i })).toHaveAttribute('aria-expanded', 'false');
  });

  it('accepts pasted item text and reveals manual overrides in Advanced options', async () => {
    const user = userEvent.setup();
    render(<AnalyzerPage />);
    const paste = screen.getByLabelText('Item text');
    fireEvent.change(paste, { target: { value: 'Rarity: Rare\nRune Pace\nStone Greaves' } });
    expect((paste as HTMLTextAreaElement).value).toContain('Rune Pace');
    await user.click(screen.getByRole('button', { name: /Advanced options/i }));
    expect(screen.getByLabelText('Base type')).toBeInTheDocument();
    expect(screen.getByLabelText('Movement speed %')).toBeInTheDocument();
  });

  it('exposes league, conversion and manual-listing controls under Advanced options', async () => {
    const user = userEvent.setup();
    render(<AnalyzerPage />);
    await screen.findByText(/Every recommendation explains itself/i);
    expect(screen.getByRole('button', { name: 'Analyze item' })).toBeInTheDocument();
    expect(await screen.findByLabelText('Build profile')).toHaveValue('generic-build-fit');
    expect(screen.getByRole('option', { name: 'Ice Shot Deadeye' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Advanced options/i }));
    expect(screen.getByLabelText('League')).toHaveValue('Runes of Aldur');
    expect(screen.getByLabelText('Divine to Exalted rate')).toHaveValue(65);
    expect(screen.getByLabelText('Manual listings')).toBeInTheDocument();
  });

  it('renders the equipped comparison toggle, textarea and character totals inside Advanced options', async () => {
    const user = userEvent.setup();
    render(<AnalyzerPage />);
    expect(screen.getByRole('heading', { name: 'What did you find?' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Advanced options/i }));
    const toggle = screen.getByRole('button', { name: 'Compare an equipped item' });
    await user.click(toggle);
    expect(screen.getByLabelText('Current Equipped Item')).toBeInTheDocument();
    expect(screen.getByLabelText('Current Fire Resistance')).toBeInTheDocument();
    expect(screen.getByLabelText('Current Cold Resistance')).toBeInTheDocument();
    expect(screen.getByLabelText('Current Dexterity')).toBeInTheDocument();
  });

  it('changes Build Fit Analysis when a different profile is selected', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, options?: RequestInit) => ({
        ok: true,
        status: 200,
        json: async () => {
          if (url.endsWith('/api/build-profiles'))
            return {
              profiles: [
                profile('generic-build-fit', 'Generic Build Fit'),
                profile('ice-shot-deadeye', 'Ice Shot Deadeye'),
                profile('cold-caster', 'Cold Caster'),
              ],
            };
          if (url.endsWith('/api/build-profile')) return { profile: null };
          if (url.endsWith('/api/settings')) return { divineToExalted: 65, defaultLeague: 'Standard' };
          if (url.endsWith('/api/item/normalize')) return { item: normalized() };
          if (url.endsWith('/api/analyze')) {
            const id = JSON.parse(String(options?.body)).selectedBuildProfileId;
            return analysis(id, id === 'cold-caster' ? 'Cold Caster' : 'Ice Shot Deadeye');
          }
          return {};
        },
      })),
    );
    const user = userEvent.setup();
    render(<AnalyzerPage />);
    const selector = await screen.findByLabelText('Build profile');
    fireEvent.change(screen.getByLabelText('Item text'), {
      target: { value: 'Item Class: Wands\nRarity: Rare\nTest\nAttuned Wand' },
    });
    fireEvent.change(selector, { target: { value: 'ice-shot-deadeye' } });
    await user.click(screen.getByRole('button', { name: 'Analyze item' }));
    expect(await screen.findByRole('heading', { name: 'Ice Shot Deadeye' })).toBeInTheDocument();
    fireEvent.change(selector, { target: { value: 'cold-caster' } });
    await user.click(screen.getByRole('button', { name: 'Analyze item' }));
    expect(await screen.findByRole('heading', { name: 'Cold Caster' })).toBeInTheDocument();
  });
});

function profile(id: string, name: string) {
  return {
    id,
    name,
    source: id === 'generic-build-fit' ? 'generic' : 'default',
    className: 'Any',
    mainSkill: 'Skill',
    preferredWeaponTypes: [],
    damageTypes: [],
    defensiveLayers: [],
    offensiveStats: [],
    defensiveStats: [],
    attributes: [],
    utilityStats: [],
    wastedStats: [],
    valuableSlots: [],
    categoryPriorities: {},
    explanationRules: [],
  };
}
function analysis(id: string, name: string) {
  return {
    item: { itemType: 'Weapon', baseType: 'Attuned Wand', rarity: 'rare', customMods: [] },
    evaluation: {
      score: 40,
      grade: 'basic',
      label: 'Usable',
      verdict: 'Test',
      marketability: 'niche',
      strengths: [],
      weaknesses: [],
      upgradePriorities: [],
      buildFits: [],
      buildFitAnalysis: {
        profileId: id,
        profileName: name,
        buildSpecific: true,
        score: id === 'cold-caster' ? 80 : 10,
        label: id === 'cold-caster' ? 'Great' : 'Bad',
        fitsBecause: [],
        doesNotFitBecause: [],
        bestUseCase: 'niche',
        missingImportantStats: [],
        wastedStats: [],
        recommendedAction: 'Craft',
        confidence: 80,
        warnings: [],
      },
    },
    league: 'Standard',
    dataSource: 'none',
    warning: 'No live price',
    officialUrl: '#',
    divineToExalted: 65,
    estimate: null,
    comparableListings: [],
    timestamp: new Date().toISOString(),
  };
}
function normalized() {
  return {
    itemClass: 'Weapons',
    baseType: 'Attuned Wand',
    rarity: 'rare',
    corrupted: false,
    prefixes: [],
    suffixes: [],
    implicitModifiers: [],
    unknownModifiers: [],
  };
}
