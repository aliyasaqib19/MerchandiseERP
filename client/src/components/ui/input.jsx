import { forwardRef } from 'react';
import { cn } from '../../lib/utils';

// forwardRef is required so react-hook-form's register(...).ref reaches the
// real DOM <input> — without it, setValue()/reset() update RHF's internal
// state but can't imperatively sync the visible value.
export const Input = forwardRef(function Input({ className, type, ...props }, ref) {
  return (
    <input
      ref={ref}
      type={type}
      className={cn(
        'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
        className
      )}
      {...props}
    />
  );
});
