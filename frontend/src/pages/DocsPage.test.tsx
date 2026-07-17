import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { DocsPage } from './DocsPage';

describe('DocsPage', () => {
  it('renders every table-of-contents link to a section that actually exists on the page', () => {
    const { container } = render(<DocsPage />);
    const links = screen.getAllByRole('link', { name: /^(?!Open official).+/ }).filter((link) => {
      const href = link.getAttribute('href');
      return href?.startsWith('#');
    });
    expect(links.length).toBeGreaterThan(0);
    for (const link of links) {
      const id = link.getAttribute('href')!.slice(1);
      expect(container.querySelector(`#${id}`)).not.toBeNull();
    }
  });

  it('links to the official Trade2 site instead of fabricating a live search', () => {
    render(<DocsPage />);
    const officialLink = screen.getByRole('link', { name: /Open official Path of Exile 2 Trade/i });
    expect(officialLink).toHaveAttribute('href', expect.stringContaining('pathofexile.com/trade2'));
    expect(officialLink).toHaveAttribute('target', '_blank');
    expect(officialLink).toHaveAttribute('rel', 'noreferrer');
  });
});
