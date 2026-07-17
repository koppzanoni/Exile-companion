import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ConfirmDialog } from './ConfirmDialog';

describe('ConfirmDialog', () => {
  it('renders nothing when closed', () => {
    const { container } = render(
      <ConfirmDialog open={false} title="Delete" description="Sure?" onCancel={vi.fn()} onConfirm={vi.fn()} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('confirms immediately when there is no required input', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    render(<ConfirmDialog open title="Delete" description="Sure?" onCancel={vi.fn()} onConfirm={onConfirm} />);
    await user.click(screen.getByRole('button', { name: 'Confirm' }));
    expect(onConfirm).toHaveBeenCalledWith('');
  });

  it('requires the typed confirmation text to match before enabling confirm', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    render(
      <ConfirmDialog
        open
        title="Delete account"
        description="Type DELETE to confirm."
        inputLabel="Confirmation"
        confirmLabel="Delete"
        onCancel={vi.fn()}
        onConfirm={onConfirm}
      />,
    );
    const confirmButton = screen.getByRole('button', { name: 'Delete' });
    expect(confirmButton).toBeDisabled();
    await user.type(screen.getByLabelText('Confirmation'), 'DELETE');
    expect(confirmButton).toBeEnabled();
    await user.click(confirmButton);
    expect(onConfirm).toHaveBeenCalledWith('DELETE');
  });

  it('cancels when clicking the backdrop or pressing Escape', async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();
    render(<ConfirmDialog open title="Delete" description="Sure?" onCancel={onCancel} onConfirm={vi.fn()} />);
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    expect(onCancel).toHaveBeenCalledTimes(1);
    await user.click(screen.getByRole('presentation'));
    expect(onCancel).toHaveBeenCalledTimes(2);
  });
});
