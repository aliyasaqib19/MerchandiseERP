import { X } from 'lucide-react';
import { cn } from '../../lib/utils';

export function Dialog({ open, onOpenChange, children }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={() => onOpenChange(false)}
      />
      <div className="relative z-50">{children}</div>
    </div>
  );
}

export function DialogContent({ className, children, onClose }) {
  return (
    <div className={cn('relative bg-card rounded-lg shadow-lg p-6 w-full max-w-lg mx-4', className)}>
      {onClose && (
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-muted-foreground hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      )}
      {children}
    </div>
  );
}

export function DialogHeader({ className, ...props }) {
  return <div className={cn('mb-4', className)} {...props} />;
}

export function DialogTitle({ className, ...props }) {
  return <h2 className={cn('text-lg font-semibold', className)} {...props} />;
}

export function DialogFooter({ className, ...props }) {
  return <div className={cn('flex justify-end gap-2 mt-6', className)} {...props} />;
}
