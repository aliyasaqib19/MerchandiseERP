import { forwardRef } from 'react';
import { cn } from '../../lib/utils';

// forwardRef is required so react-hook-form's register(...).ref reaches the
// real DOM <select> — without it, setValue()/reset() update RHF's internal
// state but can't imperatively sync the visible selection.
export const Select = forwardRef(function Select({ className, children, ...props }, ref) {
  return (
    <select
      ref={ref}
      className={cn(
        'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
        className
      )}
      {...props}
    >
      {children}
    </select>
  );
});
