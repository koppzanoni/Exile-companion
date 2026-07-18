import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { CharacterFormSection } from './CharacterFormSection';

const text = (english: string) => english;
const blankForm = {
  name: '',
  league: 'Runes of Aldur',
  className: '',
  ascendancy: '',
  buildProfileId: '',
  stage: 'endgame' as const,
  targetContent: '',
  currentIssues: '',
};

describe('CharacterFormSection', () => {
  it('shows the create form, disabled until a name is entered', async () => {
    const user = userEvent.setup();
    const setForm = vi.fn();
    const createCharacter = vi.fn();
    render(
      <CharacterFormSection
        selectedId={null}
        form={blankForm}
        setForm={setForm}
        roster={null}
        loading={false}
        saveCharacter={vi.fn()}
        createCharacter={createCharacter}
        text={text}
      />,
    );
    expect(screen.getByRole('heading', { name: 'New character' })).toBeInTheDocument();
    const createButton = screen.getByRole('button', { name: 'Create character' });
    expect(createButton).toBeDisabled();
    await user.type(screen.getByLabelText('Character name'), 'X');
    expect(setForm).toHaveBeenCalledWith({ ...blankForm, name: 'X' });
  });

  it('shows the edit form and saves an existing character', async () => {
    const user = userEvent.setup();
    const saveCharacter = vi.fn();
    render(
      <CharacterFormSection
        selectedId={1}
        form={{ ...blankForm, name: 'Frostbolt' }}
        setForm={vi.fn()}
        roster={null}
        loading={false}
        saveCharacter={saveCharacter}
        createCharacter={vi.fn()}
        text={text}
      />,
    );
    expect(screen.getByRole('heading', { name: 'Edit character' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Save character' }));
    expect(saveCharacter).toHaveBeenCalledTimes(1);
  });

  it('resets the ascendancy field when the class changes', async () => {
    const user = userEvent.setup();
    const setForm = vi.fn();
    render(
      <CharacterFormSection
        selectedId={null}
        form={{ ...blankForm, className: 'Sorceress' }}
        setForm={setForm}
        roster={null}
        loading={false}
        saveCharacter={vi.fn()}
        createCharacter={vi.fn()}
        text={text}
      />,
    );
    await user.selectOptions(screen.getByLabelText('Character class'), 'Choose a class');
    expect(setForm).toHaveBeenCalledWith({ ...blankForm, className: '', ascendancy: '' });
  });
});
