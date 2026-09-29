import React from 'react';
import { Star } from 'lucide-react';
import { cn } from '../../lib/utils';

// A row of rating stars (Lucide), filled up to `value`. Colour comes from the
// parent's text colour; empty stars use `emptyClassName`.
export function Stars({ value = 5, max = 5, className = 'w-4 h-4', emptyClassName = 'text-gray-200', label }: {
    value?: number; max?: number; className?: string; emptyClassName?: string; label?: string;
}) {
    const filled = Math.round(value);
    return (
        <span className="inline-flex items-center gap-0.5" role="img" aria-label={label ?? `${value} out of ${max} stars`}>
            {Array.from({ length: max }, (_, i) => (
                <Star
                    key={i} aria-hidden="true" strokeWidth={1.5}
                    className={cn(className, i >= filled && emptyClassName)}
                    fill={i < filled ? 'currentColor' : 'none'}
                />
            ))}
        </span>
    );
}
