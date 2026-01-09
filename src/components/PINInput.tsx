/**
 * EasyGest BP - Input PIN stylisé
 */

import React, { useRef, useState, useEffect } from 'react';
import { cn } from '@/lib/utils';

interface PINInputProps {
  length?: number;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  error?: boolean;
  autoFocus?: boolean;
}

export function PINInput({
  length = 6,
  value,
  onChange,
  disabled = false,
  error = false,
  autoFocus = false,
}: PINInputProps) {
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    if (autoFocus && inputRefs.current[0]) {
      inputRefs.current[0].focus();
    }
  }, [autoFocus]);

  const handleChange = (index: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    
    // Accepter seulement les chiffres
    if (!/^\d*$/.test(val)) return;
    
    // Si on colle plusieurs chiffres
    if (val.length > 1) {
      const digits = val.slice(0, length - index);
      const newValue = value.slice(0, index) + digits + value.slice(index + digits.length);
      onChange(newValue.slice(0, length));
      
      const nextIndex = Math.min(index + digits.length, length - 1);
      inputRefs.current[nextIndex]?.focus();
      return;
    }
    
    // Un seul chiffre
    const newValue = value.slice(0, index) + val + value.slice(index + 1);
    onChange(newValue);
    
    if (val && index < length - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace') {
      if (!value[index] && index > 0) {
        inputRefs.current[index - 1]?.focus();
      }
      const newValue = value.slice(0, index) + value.slice(index + 1);
      onChange(newValue);
    } else if (e.key === 'ArrowLeft' && index > 0) {
      inputRefs.current[index - 1]?.focus();
    } else if (e.key === 'ArrowRight' && index < length - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasteData = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, length);
    onChange(pasteData);
    
    const nextIndex = Math.min(pasteData.length, length - 1);
    inputRefs.current[nextIndex]?.focus();
  };

  return (
    <div className="flex gap-2 md:gap-3 justify-center">
      {Array.from({ length }).map((_, index) => (
        <input
          key={index}
          ref={(el) => (inputRefs.current[index] = el)}
          type="password"
          inputMode="numeric"
          maxLength={1}
          value={value[index] || ''}
          onChange={(e) => handleChange(index, e)}
          onKeyDown={(e) => handleKeyDown(index, e)}
          onPaste={handlePaste}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          disabled={disabled}
          className={cn(
            'pin-input',
            error && 'border-destructive focus:border-destructive focus:ring-destructive/20',
            value[index] && 'border-primary bg-primary/5'
          )}
          aria-label={`PIN chiffre ${index + 1}`}
        />
      ))}
    </div>
  );
}
