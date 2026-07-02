import React, { useRef, useEffect, useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';

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
  const [showPin, setShowPin] = useState(false);

  useEffect(() => {
    if (autoFocus && inputRefs.current[0]) {
      inputRefs.current[0].focus();
    }
  }, [autoFocus]);

  const handleChange = (index: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const rawValue = e.target.value;
    // Ne garder que les chiffres, et seulement le premier caractère
    const digit = rawValue.replace(/\D/g, '')[0] || '';
    
    // Construire la nouvelle valeur complète
    const newValue = value.slice(0, index) + digit + value.slice(index + 1);
    onChange(newValue.slice(0, length));

    // Si un chiffre a été saisi, passer au champ suivant
    if (digit && index < length - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace') {
      // Si le champ est vide, on recule et on efface le champ précédent
      if (!value[index] && index > 0) {
        const newValue = value.slice(0, index - 1) + '' + value.slice(index);
        onChange(newValue);
        inputRefs.current[index - 1]?.focus();
      } else {
        // Sinon on efface simplement le champ courant
        const newValue = value.slice(0, index) + '' + value.slice(index + 1);
        onChange(newValue);
      }
      e.preventDefault(); // Empêche la suppression du caractère déjà gérée
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
    // Placer le focus sur le dernier champ rempli ou sur le premier vide
    const nextIndex = Math.min(pasteData.length, length - 1);
    inputRefs.current[nextIndex]?.focus();
  };

  const inputType = showPin ? 'text' : 'password';

  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', alignItems: 'center' }}>
        {Array.from({ length }).map((_, index) => (
          <input
            key={index}
            ref={(el) => (inputRefs.current[index] = el)}
            type={inputType}
            inputMode="numeric"
            maxLength={1}
            value={value[index] || ''}
            onChange={(e) => handleChange(index, e)}
            onKeyDown={(e) => handleKeyDown(index, e)}
            onPaste={handlePaste}
            disabled={disabled}
            style={{
              width: '48px',
              height: '56px',
              textAlign: 'center',
              fontSize: '24px',
              fontWeight: '600',
              border: error ? '2px solid #ef4444' : value[index] ? '2px solid #3b82f6' : '2px solid #e5e7eb',
              borderRadius: '8px',
              outline: 'none',
              backgroundColor: value[index] ? '#eff6ff' : '#fff',
            }}
            aria-label={`PIN chiffre ${index + 1}`}
          />
        ))}
        <button
          type="button"
          onClick={() => setShowPin(!showPin)}
          disabled={disabled}
          style={{
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            marginLeft: '8px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '40px',
            height: '40px',
            borderRadius: '8px',
            color: '#6b7280',
          }}
          aria-label={showPin ? 'Masquer le code PIN' : 'Afficher le code PIN'}
        >
          {showPin ? <EyeOff size={20} /> : <Eye size={20} />}
        </button>
      </div>
    </div>
  );
}