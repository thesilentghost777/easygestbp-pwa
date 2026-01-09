/**
 * EasyGest BP - Badge de synchronisation
 */

import React from 'react';
import { Check, Clock, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SyncBadgeProps {
  status: 'synced' | 'pending' | 'conflict';
  showLabel?: boolean;
  size?: 'sm' | 'md';
}

export function SyncBadge({ status, showLabel = false, size = 'sm' }: SyncBadgeProps) {
  const configs = {
    synced: {
      class: 'sync-badge-synced',
      icon: Check,
      label: 'Synchronisé',
    },
    pending: {
      class: 'sync-badge-pending',
      icon: Clock,
      label: 'En attente',
    },
    conflict: {
      class: 'sync-badge-conflict',
      icon: AlertTriangle,
      label: 'Conflit',
    },
  };

  const config = configs[status];
  const Icon = config.icon;

  return (
    <span className={cn('sync-badge', config.class, size === 'sm' && 'text-[10px] px-1.5 py-0.5')}>
      <Icon className={cn('w-3 h-3', size === 'md' && 'w-3.5 h-3.5')} />
      {showLabel && <span>{config.label}</span>}
    </span>
  );
}
