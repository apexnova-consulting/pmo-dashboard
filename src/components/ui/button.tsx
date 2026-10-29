import { Slot } from '@radix-ui/react-slot';
import type { ButtonHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

type Variant = 'primary' | 'secondary' | 'ghost' | 'header';

const variants: Record<Variant, string> = {
  primary: 'bg-brand text-on-brand hover:bg-brand-strong border border-transparent',
  secondary: 'bg-transparent text-brand-strong border border-brand hover:bg-brand-tint',
  ghost: 'bg-transparent text-brand-strong border border-transparent hover:bg-brand-tint',
  header:
    'header-control border border-white/80 text-on-brand hover:bg-white hover:text-brand-strong',
};

export function Button({
  variant = 'primary',
  className,
  asChild,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; asChild?: boolean }) {
  const Comp = asChild ? Slot : 'button';
  return (
    <Comp
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-full px-4 py-2 text-sm font-bold transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-60',
        variants[variant],
        className,
      )}
      {...props}
    />
  );
}

export function IconButton({ className, ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className={cn(
        'inline-flex h-10 w-10 items-center justify-center rounded-full border border-brand text-brand-strong transition-colors duration-150 hover:bg-brand-tint',
        className,
      )}
      {...props}
    />
  );
}
