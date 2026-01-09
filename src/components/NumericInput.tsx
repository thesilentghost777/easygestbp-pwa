/**
 * EasyGest BP - Input numérique avec contrôles
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
    },
    md: {
      btn: 'w-10 h-10 md:w-12 md:h-12 text-lg',
      input: 'w-16 md:w-20 h-10 md:h-12 text-base md:text-lg',
    },
    lg: {
      btn: 'w-12 h-12 md:w-14 md:h-14 text-xl',
      input: 'w-20 md:w-24 h-12 md:h-14 text-lg md:text-xl',
    },
  };

  return (
    <div className={cn('numeric-input-group', className)}>
      <button
        type="button"
        onClick={handleDecrement}
        disabled={disabled || value <= min}
        className={cn('numeric-btn', sizes[size].btn)}
        aria-label="Diminuer"
      >
        <Minus className="w-5 h-5" />
      </button>
      
      <input
        type="number"
        inputMode="numeric"
        value={value}
        onChange={handleChange}
        disabled={disabled}
        min={min}
        max={max}
        className={cn(
          'text-center font-bold rounded-lg border-2 border-border bg-background',
          'focus:border-primary focus:ring-2 focus:ring-primary/20 focus:outline-none',
          'transition-all duration-200',
          'disabled:opacity-50 disabled:cursor-not-allowed',
          sizes[size].input
        )}
      />
      
      <button
        type="button"
        onClick={handleIncrement}
        disabled={disabled || value >= max}
        className={cn('numeric-btn', sizes[size].btn)}
        aria-label="Augmenter"
      >
        <Plus className="w-5 h-5" />
      </button>
    </div>
  );
}
