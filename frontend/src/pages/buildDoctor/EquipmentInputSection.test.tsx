import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { EquipmentInputSection } from './EquipmentInputSection';

const t = (key: string) => key;
const text = (english: string) => english;
const blankEquipment = [
  { slot: 'Weapon', itemText: '' },
  { slot: 'Boots', itemText: '' },
];

const baseProps = {
  selectedCharacterId: '',
  setSelectedCharacterId: vi.fn(),
  characters: [],
  importLoading: false,
  loadCharacter: vi.fn(),
  loadedCharacter: null,
  poe: null,
  previewOfficialSync: vi.fn(),
  clearEquipment: vi.fn(),
  reconciliation: null,
  applyOfficialSync: vi.fn(),
  syncApplied: [],
  bulkText: '',
  setBulkText: vi.fn(),
  setBulkPreview: vi.fn(),
  bulkPreview: null,
  previewBulkImport: vi.fn(),
  applyBulkImport: vi.fn(),
  buildProfiles: [],
  selectedBuildProfileId: 'generic-build-fit',
  setSelectedBuildProfileId: vi.fn(),
  equipment: blankEquipment,
  setSlotText: vi.fn(),
  error: '',
  diagnose: vi.fn(),
  loading: false,
  t,
  text,
};

describe('EquipmentInputSection', () => {
  it('renders one labeled textarea per slot and reports edits', async () => {
    const user = userEvent.setup();
    const setSlotText = vi.fn();
    render(<EquipmentInputSection {...baseProps} setSlotText={setSlotText} />);
    await user.type(screen.getByLabelText('Weapon item text'), 'X');
    expect(setSlotText).toHaveBeenCalledWith('Weapon', 'X');
  });

  it('runs the diagnosis when the button is clicked', async () => {
    const user = userEvent.setup();
    const diagnose = vi.fn();
    render(<EquipmentInputSection {...baseProps} diagnose={diagnose} />);
    await user.click(screen.getByRole('button', { name: 'doctor.diagnose' }));
    expect(diagnose).toHaveBeenCalledTimes(1);
  });

  it('shows the official synchronization preview and lets the user confirm it', async () => {
    const user = userEvent.setup();
    const applyOfficialSync = vi.fn();
    render(
      <EquipmentInputSection
        {...baseProps}
        reconciliation={{
          differences: [{ slot: 'Boots', localItemText: 'a', officialItemText: 'b', status: 'changed' }],
          applied: false,
          requiresConfirmation: true,
        }}
        applyOfficialSync={applyOfficialSync}
      />,
    );
    expect(screen.getByText('Official synchronization preview')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Confirm synchronization' }));
    expect(applyOfficialSync).toHaveBeenCalledTimes(1);
  });

  it('shows a validation error when present', () => {
    render(<EquipmentInputSection {...baseProps} error="Could not diagnose this build." />);
    expect(screen.getByText('Could not diagnose this build.')).toBeInTheDocument();
  });
});
