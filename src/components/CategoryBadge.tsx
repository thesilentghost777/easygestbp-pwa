/**
 * EasyGest BP - Category Badge Component
 * Beautiful category indicator with icon
 */

import React from 'react';
import { Croissant, Cookie } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CategoryBadgeProps {
  category: 'boulangerie' | 'patisserie';
  showIcon?: boolean;
  size?: 'sm' | 'md';
}

export function CategoryBadge({ category, showIcon = true, size = 'sm' }: CategoryBadgeProps) {
  const configs = {
    boulangerie: {
      class: 'bg-gradient-to-r from-amber-50 to-orange-50 text-amber-700 border border-amber-200/50',
      icon: Croissant,
      label: 'Boulangerie',
    },
    patisserie: {
      class: 'bg-gradient-to-r from-pink-50 to-rose-50 text-pink-700 border border-pink-200/50',
      icon: Cookie,
      label: 'Pâtisserie',
    },
  };

  const config = configs[category];
  const Icon = config.icon;

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full font-medium transition-all duration-200',
        'shadow-sm hover:shadow-md',
        config.class,
        size === 'sm' ? 'px-2.5 py-1 text-xs' : 'px-3.5 py-1.5 text-sm'
      )}
    >
      {showIcon && (
        <Icon 
          className={cn(
            'shrink-0',
            size === 'sm' ? 'w-3 h-3' : 'w-4 h-4'
          )} 
        />
      )}
      <span>{config.label}</span>
    </span>
  );
}
