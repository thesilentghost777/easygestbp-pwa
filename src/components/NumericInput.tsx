/**
 * EasyGest BP - Numeric Input Component
 * Elegant numeric input with increment/decrement controls
 */

import React from 'react';
import { Minus, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';

interface NumericInputProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  disabled?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function NumericInput({
  value,
  onChange,
  min = 0,
  max = 9999,
  step = 1,
  disabled = false,
  size = 'md',
  className,
}: NumericInputProps) {
  const handleDecrement = () => {
    const newValue = Math.max(min, value - step);
    onChange(newValue);
  };

  const handleIncrement = () => {
    const newValue = Math.min(max, value + step);
    onChange(newValue);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = parseInt(e.target.value, 10);
    if (!isNaN(newValue)) {
      onChange(Math.min(max, Math.max(min, newValue)));
    } else if (e.target.value === '') {
      onChange(min);
    }
  };

  const sizes = {
    sm: {
      btn: 'w-8 h-8 text-base',
      input: 'w-14 h-8 text-sm',
      icon: 'w-4 h-4',
    },
    md: {
      btn: 'w-11 h-11 text-lg',
      input: 'w-18 h-11 text-lg',
      icon: 'w-5 h-5',
    },
    lg: {
      btn: 'w-14 h-14 text-xl',
      input: 'w-24 h-14 text-2xl',
      icon: 'w-6 h-6',
    },
  };

  const sizeConfig = sizes[size];

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <button
        type="button"
        onClick={handleDecrement}
        disabled={disabled || value <= min}
        className={cn(
          'flex items-center justify-center rounded-xl',
          'bg-secondary text-secondary-foreground border border-border/50',
          'transition-all duration-200',
          'hover:bg-primary hover:text-primary-foreground hover:border-primary hover:shadow-md',
          'active:scale-95',
          'disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-secondary disabled:hover:text-secondary-foreground disabled:hover:border-border/50',
          sizeConfig.btn
        )}
        aria-label="Diminuer"
      >
        <Minus className={sizeConfig.icon} />
      </button>

      <input
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        value={value}
        onChange={handleChange}
        disabled={disabled}
        className={cn(
          'text-center font-bold rounded-xl',
          'bg-background border-2 border-border',
          'transition-all duration-200',
          'focus:border-primary focus:ring-4 focus:ring-primary/10 focus:outline-none',
          'disabled:opacity-50 disabled:cursor-not-allowed',
          sizeConfig.input
        )}
      />

      <button
        type="button"
        onClick={handleIncrement}
        disabled={disabled || value >= max}
        className={cn(
          'flex items-center justify-center rounded-xl',
          'bg-secondary text-secondary-foreground border border-border/50',
          'transition-all duration-200',
          'hover:bg-primary hover:text-primary-foreground hover:border-primary hover:shadow-md',
          'active:scale-95',
          'disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-secondary disabled:hover:text-secondary-foreground disabled:hover:border-border/50',
          sizeConfig.btn
        )}
        aria-label="Augmenter"
      >
        <Plus className={sizeConfig.icon} />
      </button>
    </div>
  );
}
