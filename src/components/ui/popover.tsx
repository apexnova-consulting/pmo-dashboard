import * as PopoverPrimitive from '@radix-ui/react-popover';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export function Popover({
  trigger,
  children,
  open,
  onOpenChange,
  align = 'end',
  label,
}: {
  trigger: ReactNode;
  children: ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  align?: 'start' | 'center' | 'end';
  label?: string;
}) {
  return (
    <PopoverPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <PopoverPrimitive.Trigger asChild>{trigger}</PopoverPrimitive.Trigger>
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          align={align}
          sideOffset={8}
          aria-label={label}
          className={cn('z-50 w-80 rounded-[12px] border border-line bg-card p-4 text-sm text-ink')}
        >
          {children}
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}
