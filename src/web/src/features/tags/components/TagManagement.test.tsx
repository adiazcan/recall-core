import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { act } from '@testing-library/react';
import { TagManagement } from './TagManagement';

const mockListTags = vi.fn();
const mockUpdateTag = vi.fn();
const mockDeleteTag = vi.fn();

vi.mock('../store', () => ({
  useTagsStore: (selector: (state: {
    tags: Map<string, { id: string; displayName: string; normalizedName: string; color: string | null; itemCount: number; createdAt: string; updatedAt: string }>;
    isLoading: boolean;
    listTags: () => Promise<void>;
    updateTag: (id: string, name?: string, color?: string | null) => Promise<unknown>;
    deleteTag: (id: string) => Promise<void>;
  }) => unknown) =>
    selector({
      tags: new Map([
        [
          't1',
          {
            id: 't1',
            displayName: 'JavaScript',
            normalizedName: 'javascript',
            color: null,
            itemCount: 2,
            createdAt: '2026-02-15T00:00:00Z',
            updatedAt: '2026-02-15T00:00:00Z',
          },
        ],
      ]),
      isLoading: false,
      listTags: mockListTags,
      updateTag: mockUpdateTag,
      deleteTag: mockDeleteTag,
    }),
}));

describe('TagManagement', () => {
  it('renders list and supports rename + delete actions', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    mockUpdateTag.mockResolvedValue({ id: 't1' });
    mockDeleteTag.mockResolvedValue(undefined);

    render(<TagManagement />);

    expect(screen.getByText('JavaScript')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /rename/i }));
    const input = screen.getByRole('textbox', { name: /rename javascript/i });
    fireEvent.change(input, { target: { value: 'TypeScript' } });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /save/i }));
    });

    expect(mockUpdateTag).toHaveBeenCalledWith('t1', 'TypeScript');

    fireEvent.click(screen.getByRole('button', { name: /delete/i }));
    expect(mockDeleteTag).toHaveBeenCalledWith('t1');
  });
});
