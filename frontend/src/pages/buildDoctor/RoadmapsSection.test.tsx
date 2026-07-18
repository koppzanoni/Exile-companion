import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { RoadmapsSection } from './RoadmapsSection';

const text = (english: string) => english;
const roadmap = {
  label: 'Balanced',
  plan: {
    characterId: 1,
    budget: 40,
    score: 60,
    purchases: [
      {
        rank: 1,
        slot: 'Boots',
        reason: 'Movement speed gap',
        priority: 'High' as const,
        suggestedBudget: 10,
        tradeUrl: null,
        requiresEquippedItem: false,
      },
    ],
    blockers: [],
    warning: '',
  },
};

describe('RoadmapsSection', () => {
  it('opens the save-confirmation dialog and confirms it', async () => {
    const user = userEvent.setup();
    const setRoadmapToSave = vi.fn();
    const { rerender } = render(
      <RoadmapsSection
        roadmaps={[roadmap]}
        savedRoadmap=""
        roadmapToSave={null}
        setRoadmapToSave={setRoadmapToSave}
        saveRoadmap={vi.fn()}
        importLoading={false}
        text={text}
      />,
    );
    await user.click(screen.getByRole('button', { name: 'Save roadmap' }));
    expect(setRoadmapToSave).toHaveBeenCalledWith(roadmap);

    const saveRoadmap = vi.fn();
    rerender(
      <RoadmapsSection
        roadmaps={[roadmap]}
        savedRoadmap=""
        roadmapToSave={roadmap}
        setRoadmapToSave={setRoadmapToSave}
        saveRoadmap={saveRoadmap}
        importLoading={false}
        text={text}
      />,
    );
    expect(screen.getByText('Save Balanced roadmap?')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Confirm save' }));
    expect(saveRoadmap).toHaveBeenCalledTimes(1);
  });

  it('shows a confirmation banner once a roadmap has been saved', () => {
    render(
      <RoadmapsSection
        roadmaps={[roadmap]}
        savedRoadmap="Balanced"
        roadmapToSave={null}
        setRoadmapToSave={vi.fn()}
        saveRoadmap={vi.fn()}
        importLoading={false}
        text={text}
      />,
    );
    expect(screen.getByText(/Balanced roadmap saved/)).toBeInTheDocument();
  });
});
