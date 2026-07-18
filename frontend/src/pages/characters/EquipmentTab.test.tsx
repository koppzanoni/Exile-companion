import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { EquipmentTab } from './EquipmentTab';

const text = (english: string) => english;

describe('EquipmentTab', () => {
  it('renders one labeled textarea per equipment slot and reports edits', async () => {
    const user = userEvent.setup();
    const setSlotText = vi.fn();
    render(
      <EquipmentTab
        equipment={[
          { slot: 'Boots', itemText: '' },
          { slot: 'Helmet', itemText: 'Old helmet text' },
        ]}
        setSlotText={setSlotText}
        text={text}
      />,
    );
    expect(screen.getByLabelText('Boots item text')).toHaveValue('');
    expect(screen.getByLabelText('Helmet item text')).toHaveValue('Old helmet text');
    await user.type(screen.getByLabelText('Boots item text'), 'X');
    expect(setSlotText).toHaveBeenCalledWith('Boots', 'X');
  });

  it('carries the equipment tab-group marker used for tab visibility', () => {
    const { container } = render(<EquipmentTab equipment={[]} setSlotText={vi.fn()} text={text} />);
    expect(container.querySelector('[data-tab-group="equipment"]')).not.toBeNull();
  });
});
