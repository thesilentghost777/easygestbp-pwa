/**
 * EasyGest BP - Badge de catégorie
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
      class: 'category-boulangerie',
      icon: Croissant,
      label: 'Boulangerie',
    },
    patisserie: {
      class: 'category-patisserie',
      icon: Cookie,
      label: 'Pâtisserie',
    },
  };

  const config = configs[category];
  const Icon = config.icon;

  return (
    <span className={cn(
      'category-badge',
      config.class,
      size === 'md' && 'px-3 py-1 text-sm'
    )}>
      {showIcon && <Icon className={cn('w-3 h-3', size === 'md' && 'w-4 h-4')} />}
      <span>{config.label}</span>
    </span>
  );
}
