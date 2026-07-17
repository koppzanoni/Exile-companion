import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CharactersPage } from './CharactersPage';

const character = { id: 1, name: 'Frostbolt', league: 'Runes of Aldur', level: 62, className: 'Sorceress', ascendancy: 'Stormweaver', buildProfileId: '', stage: 'endgame', budget: 50, targetContent: 'T15 maps', currentIssues: '', updatedAt: '2026-01-01T00:00:00Z' };

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => ({ ok: true, status: init?.method === 'POST' ? 201 : 200, json: async () => {
    if (url.endsWith('/api/characters') && (!init || init.method === undefined)) return { characters: [character] };
    if (url.endsWith('/api/characters') && init?.method === 'POST') return { character };
    if (url.match(/\/api\/characters\/1$/) && init?.method === 'PUT') return { character };
    if (url.match(/\/api\/characters\/1$/)) return { character, equipment: [{ slot: 'Boots', itemText: '' }], diagnosis: { resistances: { current: { fireResistance: 20 }, missing: { fireResistance: 55 }, cap: 75 } }, history: [{ id: 1, checkId: null, summary: 'Keep: Rune Pace (~15 Exalted)', createdAt: '2026-01-01T00:00:00Z' }] };
    if (url.match(/\/api\/characters\/1\/equipment$/)) return { equipment: [] };
    if (url.endsWith('/api/characters/1/snapshots')) return {snapshots:[]};
    if (url.endsWith('/api/characters/1/loadout')) return {loadout:null};
    if (url.endsWith('/api/characters/1/build-knowledge')) return {analysis:{reservedSpirit:0,remainingSpirit:null,warnings:[]},similar:{sampleSize:0,confidence:'Low',matches:[],limitation:'No local sample.'},provenance:{patch:'unknown',source:'manual',confidence:'Low'}};
    return { characters: [character] };
  } })));
});

describe('characters page', () => {
  it('lists saved characters and loads their diagnosis and history when selected', async () => {
    const user = userEvent.setup(); render(<CharactersPage/>);
    expect(await screen.findByText('Frostbolt')).toBeInTheDocument();
    const selectButtons = screen.getAllByRole('button');
    const openButton = selectButtons.find((btn) => btn.closest('article')?.textContent?.includes('Frostbolt'));
    await user.click(openButton!);
    expect(await screen.findByText(/Keep: Rune Pace/i)).toBeInTheDocument();
    expect(screen.getByDisplayValue('Frostbolt')).toBeInTheDocument();
  });

  it('creates a new character from the form', async () => {
    const user = userEvent.setup(); render(<CharactersPage/>);
    await screen.findByText('Frostbolt');
    fireEvent.change(screen.getByLabelText('Character name'), { target: { value: 'Newchar' } });
    await user.click(screen.getByRole('button', { name: /Create character/i }));
    expect(await screen.findByText(/Character created/i)).toBeInTheDocument();
  });

  it('loads expensive build data only after the Build tab opens',async()=>{const user=userEvent.setup();render(<CharactersPage/>);await screen.findByText('Frostbolt');const openButton=screen.getAllByRole('button').find(button=>button.closest('article')?.textContent?.includes('Frostbolt'));await user.click(openButton!);await screen.findByText(/Keep: Rune Pace/i);expect(vi.mocked(fetch).mock.calls.some(([url])=>String(url).endsWith('/api/characters/1/snapshots'))).toBe(false);await user.click(screen.getByRole('tab',{name:'Build'}));await waitFor(()=>expect(vi.mocked(fetch).mock.calls.some(([url])=>String(url).endsWith('/api/characters/1/snapshots'))).toBe(true));});
});
