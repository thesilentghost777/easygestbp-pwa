/**
 * EasyGest BP - Numeric Input optimisé
 * Performance maximale - zéro superflu
 */

import React, { useState, useRef } from 'react';

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

const SIZES = {
  sm: { btn: 32, input: 56, font: 14, icon: 16 },
  md: { btn: 44, input: 72, font: 18, icon: 20 },
  lg: { btn: 56, input: 96, font: 24, icon: 24 },
};

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
  // inputText pilote l'affichage. Vide quand value === 0 (placeholder visible).
  const [inputText, setInputText] = useState<string>(value > 0 ? String(value) : '');

  // Sync si value change depuis l'extérieur (ex: reset formulaire)
  const prevRef = useRef(value);
  if (prevRef.current !== value) {
    prevRef.current = value;
    const next = value > 0 ? String(value) : '';
    if (next !== inputText) setInputText(next);
  }

  const clamp = (n: number) => Math.min(max, Math.max(min, n));

  const handleDecrement = () => {
    const next = clamp(value - step);
    onChange(next);
    setInputText(next > 0 ? String(next) : '');
  };

  const handleIncrement = () => {
    const next = clamp(value + step);
    onChange(next);
    setInputText(String(next));
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    // Chiffres uniquement, zéros en tête supprimés
    const digits = raw.replace(/\D/g, '').replace(/^0+(\d)/, '$1');
    setInputText(digits);
    if (digits === '') {
      onChange(min);
    } else {
      const parsed = parseInt(digits, 10);
      if (!isNaN(parsed)) onChange(clamp(parsed));
    }
  };

  const handleBlur = () => {
    // Normalise au blur : si vide → garde vide (value reste min=0)
    if (inputText === '') return;
    const parsed = parseInt(inputText, 10);
    if (isNaN(parsed)) {
      setInputText('');
      onChange(min);
    } else {
      const clamped = clamp(parsed);
      setInputText(clamped > 0 ? String(clamped) : '');
      onChange(clamped);
    }
  };

  const s = SIZES[size];
  const canDecrement = !disabled && value > min;
  const canIncrement = !disabled && value < max;

  const btnStyle = (canClick: boolean) => ({
    width: s.btn,
    height: s.btn,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: '8px',
    backgroundColor: '#f3f4f6',
    border: '1px solid #e5e7eb',
    cursor: canClick ? 'pointer' : 'not-allowed',
    opacity: canClick ? 1 : 0.4,
    transition: 'all 0.15s',
    fontSize: s.font,
  });

  return (
    <div className={className} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
      <button
        type="button"
        onClick={handleDecrement}
        disabled={!canDecrement}
        style={btnStyle(canDecrement)}
        onMouseEnter={(e) => {
          if (canDecrement) {
            e.currentTarget.style.backgroundColor = '#3b82f6';
            e.currentTarget.style.color = '#fff';
            e.currentTarget.style.borderColor = '#3b82f6';
          }
        }}
        onMouseLeave={(e) => {
          if (canDecrement) {
            e.currentTarget.style.backgroundColor = '#f3f4f6';
            e.currentTarget.style.color = '#000';
            e.currentTarget.style.borderColor = '#e5e7eb';
          }
        }}
        aria-label="Diminuer"
      >
        −
      </button>

      <input
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        value={inputText}
        placeholder="0"
        onChange={handleChange}
        onBlur={handleBlur}
        disabled={disabled}
        style={{
          width: s.input,
          height: s.btn,
          textAlign: 'center',
          fontWeight: '700',
          fontSize: s.font,
          borderRadius: '8px',
          backgroundColor: '#fff',
          border: '2px solid #e5e7eb',
          outline: 'none',
          cursor: disabled ? 'not-allowed' : 'text',
          opacity: disabled ? 0.5 : 1,
        }}
        onFocus={(e) => {
          e.currentTarget.style.borderColor = '#3b82f6';
        }}
        onBlur={(e) => {
          e.currentTarget.style.borderColor = '#e5e7eb';
        }}
      />

      <button
        type="button"
        onClick={handleIncrement}
        disabled={!canIncrement}
        style={btnStyle(canIncrement)}
        onMouseEnter={(e) => {
          if (canIncrement) {
            e.currentTarget.style.backgroundColor = '#3b82f6';
            e.currentTarget.style.color = '#fff';
            e.currentTarget.style.borderColor = '#3b82f6';
          }
        }}
        onMouseLeave={(e) => {
          if (canIncrement) {
            e.currentTarget.style.backgroundColor = '#f3f4f6';
            e.currentTarget.style.color = '#000';
            e.currentTarget.style.borderColor = '#e5e7eb';
          }
        }}
        aria-label="Augmenter"
      >
        +
      </button>
    </div>
  );
}