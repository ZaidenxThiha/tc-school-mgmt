'use client';

import { useFormStatus } from 'react-dom';
import { Loader2 } from 'lucide-react';

// Submit button with instant pending feedback: while the server action runs it
// disables itself and shows a spinner, so a click never feels like nothing
// happened. Use inside any <form action={...}>.
export default function SubmitButton({
  children, pendingLabel, className = 'btn-primary',
}: { children: React.ReactNode; pendingLabel?: string; className?: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={className} aria-busy={pending}>
      {pending && <Loader2 size={14} className="animate-spin" />}
      {pending ? (pendingLabel ?? 'Saving…') : children}
    </button>
  );
}
