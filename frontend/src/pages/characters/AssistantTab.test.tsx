import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AssistantTab } from './AssistantTab';

beforeEach(() => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ conversations: [] }) })),
  );
});

const baseProps = {
  selectedId: 1,
  poeConnectionId: null,
  previewReconciliation: vi.fn(),
  applyReconciliation: vi.fn(),
  reconciliation: null,
  actionPlan: null,
  profileDiagnostics: [],
  onAskGemini: vi.fn(),
  characterId: 1,
  geminiContext: {},
  onGeminiAction: vi.fn(),
};

describe('AssistantTab', () => {
  it('hides the reconciliation section when there is no PoE connection, but always shows Build Lab and the Gemini coach', () => {
    render(<AssistantTab {...baseProps} />);
    expect(screen.queryByText('Official account reconciliation')).not.toBeInTheDocument();
    expect(screen.getByText('Build Lab')).toBeInTheDocument();
    expect(screen.getByText('Ask about this build')).toBeInTheDocument();
  });

  it('previews reconciliation against the connected PoE account when a connection exists', async () => {
    const user = userEvent.setup();
    const previewReconciliation = vi.fn();
    render(<AssistantTab {...baseProps} poeConnectionId={7} previewReconciliation={previewReconciliation} />);
    await user.click(screen.getByRole('button', { name: 'Compare with PoE account' }));
    expect(previewReconciliation).toHaveBeenCalledWith(7);
  });
});
