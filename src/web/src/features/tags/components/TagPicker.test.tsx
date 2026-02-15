import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { axe } from 'vitest-axe';
import { TagPicker } from './TagPicker';

vi.mock('../hooks/useTagSearch', () => ({
  useTagSearch: () => ({
    query: 'jav',
    setQuery: vi.fn(),
    isLoading: false,
    results: [
      {
        id: 't1',
        displayName: 'JavaScript',
        normalizedName: 'javascript',
        color: null,
        itemCount: 3,
        createdAt: '2026-02-15T00:00:00Z',
        updatedAt: '2026-02-15T00:00:00Z',
      },
    ],
  }),
}));

describe('TagPicker', () => {
  it('selects existing suggestion', () => {
    const onChange = vi.fn();

    render(<TagPicker selectedTags={[]} onChange={onChange} />);

    fireEvent.click(screen.getByRole('button', { name: /javascript/i }));

    expect(onChange).toHaveBeenCalledWith({
      selectedTags: [{ id: 't1', name: 'JavaScript', color: null }],
      tagIds: ['t1'],
      newTagNames: [],
    });
  });

  it('supports keyboard selection', () => {
    const onChange = vi.fn();

    render(<TagPicker selectedTags={[]} onChange={onChange} />);

    const input = screen.getByRole('textbox', { name: /search tags/i });
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(onChange).toHaveBeenCalled();
  });

  it('has no accessibility violations (WCAG 2.1 AA)', async () => {
    const onChange = vi.fn();

    const { container } = render(<TagPicker selectedTags={[]} onChange={onChange} />);

    const results = await axe(container, {
      rules: {
        // WCAG 2.1 Level AA rules
        'color-contrast': { enabled: true },
        'label': { enabled: true },
        'button-name': { enabled: true },
        'link-name': { enabled: true },
        'aria-valid-attr-value': { enabled: true },
        'aria-required-attr': { enabled: true },
        'list': { enabled: true },
      },
    });

    expect(results.violations).toHaveLength(0);
  });

  it('has no accessibility violations with selected tags', async () => {
    const onChange = vi.fn();

    const { container } = render(
      <TagPicker
        selectedTags={[
          { id: 't1', name: 'JavaScript', color: '#FF5733' },
          { id: 't2', name: 'React', color: null },
        ]}
        onChange={onChange}
      />
    );

    const results = await axe(container);

    expect(results.violations).toHaveLength(0);
  });

  it('has no accessibility violations with suggestions visible', async () => {
    const onChange = vi.fn();

    const { container } = render(<TagPicker selectedTags={[]} onChange={onChange} />);

    // Type to trigger suggestions dropdown
    const input = screen.getByRole('textbox', { name: /search tags/i });
    fireEvent.change(input, { target: { value: 'java' } });

    const results = await axe(container);

    expect(results.violations).toHaveLength(0);
  });
});
