import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { SnapshotComparisonSection } from './SnapshotComparisonSection';

const text = (english: string) => english;

function snapshot(score: number, fireResistance: number, createdAt: string) {
  return {
    diagnosisJson: JSON.stringify({
      profile: { overallScore: score },
      resistances: { current: { fireResistance } },
    }),
    createdAt,
  };
}

describe('SnapshotComparisonSection', () => {
  it('renders nothing with fewer than two snapshots', () => {
    const { container } = render(
      <SnapshotComparisonSection snapshots={[snapshot(50, 40, '2026-01-01')]} text={text} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('shows the score delta between the two most recent snapshots', () => {
    render(
      <SnapshotComparisonSection
        snapshots={[snapshot(70, 60, '2026-01-02'), snapshot(50, 40, '2026-01-01')]}
        text={text}
      />,
    );
    expect(screen.getAllByText('+20')).toHaveLength(2);
    expect(screen.getByText((_, el) => el?.tagName === 'B' && el.textContent === '40% → 60%')).toBeInTheDocument();
  });

  it('renders nothing when a snapshot has no parseable diagnosis', () => {
    const { container } = render(
      <SnapshotComparisonSection
        snapshots={[{ diagnosisJson: 'not json', createdAt: '2026-01-02' }, snapshot(50, 40, '2026-01-01')]}
        text={text}
      />,
    );
    expect(container).toBeEmptyDOMElement();
  });
});
