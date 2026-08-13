import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { cn } from '../../lib/utils';

export function Dialog({ open, onOpenChange, children }) {
  if (!open) return null;
  // Portalled to <body> so a dialog opened from inside a <form> (e.g. the
  // quick "Add New Client" dialog inside the Sale form) never ends up as a
  // nested <form> in the DOM — nested forms are invalid HTML and browsers
  // silently break them, causing the inner submit button to misfire.
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={() => onOpenChange(false)}
      />
      {/*
        React re-fires DOM events through the *React* tree for portalled
        content, not the DOM tree — so a <form> submitted inside this dialog
        (e.g. the quick "Add New Client" form opened from inside the Sale
        form) would otherwise still bubble up as a submit on whatever real
        <form> the Dialog was declared inside, wrongly triggering its
        validation. Stopping it here isolates every dialog's forms from any
        outer form, regardless of what opens it.
      */}
      <div className="relative z-50" onSubmit={(e) => e.stopPropagation()}>{children}</div>
    </div>,
    document.body
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
