/**
 * EasyGest BP - État vide stylisé
 */

import React from 'react';
import { Package, FileX, Inbox, BarChart3, Users } from 'lucide-react';
import { cn } from '@/lib/utils';

interface EmptyStateProps {
  icon?: 'package' | 'file' | 'inbox' | 'chart' | 'users';
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

export function EmptyState({
  icon = 'inbox',
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  const icons = {
    package: Package,
    file: FileX,
    inbox: Inbox,
    chart: BarChart3,
    users: Users,
  };

  const Icon = icons[icon];

  return (
    <div className={cn('empty-state', className)}>
      <div className="w-20 h-20 mb-4 rounded-full bg-muted/50 flex items-center justify-center">
        <Icon className="empty-state-icon w-10 h-10" />
      </div>
      <h3 className="text-lg font-medium text-foreground mb-1">{title}</h3>
      {description && (
        <p className="text-sm text-muted-foreground max-w-sm">{description}</p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
