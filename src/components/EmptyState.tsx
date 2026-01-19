/**
 * EasyGest BP - Empty State Component
 * Beautiful empty state with icon and action
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
    <div
      className={cn(
        'flex flex-col items-center justify-center py-16 px-6 text-center',
        'animate-fade-in',
        className
      )}
    >
      <div className="relative mb-6">
        {/* Glow effect */}
        <div className="absolute inset-0 bg-primary/10 rounded-full blur-2xl scale-150" />
        
        {/* Icon container */}
        <div className="relative w-20 h-20 rounded-2xl bg-gradient-to-br from-muted to-secondary flex items-center justify-center shadow-lg">
          <Icon className="w-10 h-10 text-muted-foreground/60" strokeWidth={1.5} />
        </div>
      </div>

      <h3 className="font-display text-xl font-semibold text-foreground mb-2">
        {title}
      </h3>

      {description && (
        <p className="text-muted-foreground text-sm max-w-xs mb-6">
          {description}
        </p>
      )}

      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
