import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Currency } from './Currency';

describe('Currency', () => {
  it('renders the exalted orb glyph, value and full label', () => {
    render(<Currency kind="exalted" value={25} />);
    expect(screen.getByText('E')).toBeInTheDocument();
    expect(screen.getByText('25')).toBeInTheDocument();
    expect(screen.getByText('Exalted')).toBeInTheDocument();
  });

  it('renders the divine orb glyph and label', () => {
    render(<Currency kind="divine" value={3} />);
    expect(screen.getByText('D')).toBeInTheDocument();
    expect(screen.getByText('Divine')).toBeInTheDocument();
  });

  it('omits the label in compact mode', () => {
    render(<Currency kind="exalted" value={10} compact />);
    expect(screen.queryByText('Exalted')).not.toBeInTheDocument();
    expect(screen.getByText('10')).toBeInTheDocument();
  });
});
