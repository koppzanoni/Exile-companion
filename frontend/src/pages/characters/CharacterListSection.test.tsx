import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { CharacterListSection } from './CharacterListSection';

const text = (english: string) => english;
const character = {
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
};

describe('CharacterListSection', () => {
  it('shows an empty state with no saved characters', () => {
    render(<CharacterListSection characters={[]} selectCharacter={vi.fn()} removeCharacter={vi.fn()} text={text} />);
    expect(screen.getByText('No characters saved yet.')).toBeInTheDocument();
  });

  it('selects and deletes a character from the list', async () => {
    const user = userEvent.setup();
    const selectCharacter = vi.fn();
    const removeCharacter = vi.fn();
    render(
      <CharacterListSection
        characters={[character]}
        selectCharacter={selectCharacter}
        removeCharacter={removeCharacter}
        text={text}
      />,
    );
    await user.click(screen.getByRole('button', { name: 'Select Frostbolt' }));
    expect(selectCharacter).toHaveBeenCalledWith(1);
    await user.click(screen.getByRole('button', { name: 'Delete Frostbolt' }));
    expect(removeCharacter).toHaveBeenCalledWith(1);
  });
});
