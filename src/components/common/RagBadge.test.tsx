import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { RagBadge } from '@/components/common/RagBadge';
import { TooltipProvider } from '@/components/ui/tooltip';

describe('RagBadge', () => {
  it('shows a text label with the color', () => {
    render(
      <TooltipProvider>
        <RagBadge rag="red" />
      </TooltipProvider>,
    );
    expect(screen.getByText('Red')).toBeInTheDocument();
  });
});
