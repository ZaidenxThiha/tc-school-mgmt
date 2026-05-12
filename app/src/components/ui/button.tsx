import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from './cn';

const buttonVariants = cva('', {
  variants: {
    variant: {
      primary: 'btn-primary',
      ghost: 'btn-ghost',
      danger: 'btn bg-rose-600 text-white hover:bg-rose-700',
    },
    size: {
      md: '',
      sm: 'text-xs px-2 py-1',
    },
  },
  defaultVariants: { variant: 'primary', size: 'md' },
});

export type ButtonProps =
  React.ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof buttonVariants>;

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  function Button({ className, variant, size, ...props }, ref) {
    return (
      <button
        ref={ref}
        className={cn(buttonVariants({ variant, size }), className)}
        {...props}
      />
    );
  },
);
