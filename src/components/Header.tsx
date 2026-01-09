/**
 * EasyGest BP - Composant Header avec indicateurs
 */

import React from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useSync } from '@/contexts/SyncContext';
import { RefreshCw, Wifi, WifiOff, LogOut, Database } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface HeaderProps {
  title: string;
  showSync?: boolean;
  onViewDatabase?: () => void;
}

export function Header({ title, showSync = true, onViewDatabase }: HeaderProps) {
  const { user, logout, isOnline } = useAuth();
  const { status, sync, isLoading } = useSync();

  const getRoleBadge = (role: string) => {
    const badges: Record<string, { class: string; label: string }> = {
      pdg: { class: 'role-badge role-pdg', label: 'PDG' },
      pointeur: { class: 'role-badge role-pointeur', label: 'Pointeur' },
      vendeur_boulangerie: { class: 'role-badge role-vendeur', label: 'Vendeur Boulangerie' },
      vendeur_patisserie: { class: 'role-badge role-vendeur', label: 'Vendeur Pâtisserie' },
      producteur: { class: 'role-badge', label: 'Producteur' },
    };
    return badges[role] || { class: 'role-badge', label: role };
  };

  const handleSync = async () => {
    if (!isLoading && isOnline) {
      await sync();
    }
  };

  return (
    <header className="header-glass px-4 py-3 safe-area-top">
      <div className="flex items-center justify-between gap-4">
        {/* Titre et rôle */}
        <div className="flex-1 min-w-0">
          <h1 className="font-display text-xl md:text-2xl font-semibold text-foreground truncate">
            {title}
          </h1>
          {user && (
            <div className="flex items-center gap-2 mt-1">
              <span className="text-sm text-muted-foreground truncate">
                {user.name}
              </span>
              <span className={getRoleBadge(user.role).class}>
                {getRoleBadge(user.role).label}
              </span>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          {/* Indicateur de connexion */}
          <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-muted/50">
            {isOnline ? (
              <>
                <div className="connection-indicator connection-online" />
                <Wifi className="w-4 h-4 text-success" />
              </>
            ) : (
              <>
                <div className="connection-indicator connection-offline" />
                <WifiOff className="w-4 h-4 text-destructive" />
              </>
            )}
          </div>

          {/* Bouton sync avec badge */}
          {showSync && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleSync}
              disabled={isLoading || !isOnline}
              className="relative gap-2"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Sync</span>
              {status.pendingCount > 0 && (
                <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-warning text-warning-foreground text-xs flex items-center justify-center font-bold">
                  {status.pendingCount}
                </span>
              )}
            </Button>
          )}

          {/* Menu utilisateur */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="rounded-full">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                  <span className="text-sm font-semibold text-primary">
                    {user?.name?.charAt(0).toUpperCase() || 'U'}
                  </span>
                </div>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <div className="px-2 py-1.5">
                <p className="text-sm font-medium">{user?.name}</p>
                <p className="text-xs text-muted-foreground">{user?.numero_telephone}</p>
              </div>
              <DropdownMenuSeparator />
              {status.lastSync && (
                <div className="px-2 py-1.5 text-xs text-muted-foreground">
                  Dernière sync: {new Date(status.lastSync).toLocaleString('fr-FR')}
                </div>
              )}
              <DropdownMenuSeparator />
              {onViewDatabase && (
                <DropdownMenuItem onClick={onViewDatabase}>
                  <Database className="w-4 h-4 mr-2" />
                  Voir la base locale
                </DropdownMenuItem>
              )}
              <DropdownMenuItem onClick={logout} className="text-destructive">
                <LogOut className="w-4 h-4 mr-2" />
                Déconnexion
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Barre de synchronisation en cours */}
      {status.isSyncing && (
        <div className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
          <RefreshCw className="w-3 h-3 animate-spin" />
          <span>Synchronisation en cours...</span>
        </div>
      )}

      {/* Barre offline */}
      {!isOnline && (
        <div className="offline-banner mt-2 -mx-4 rounded-none">
          <WifiOff className="w-4 h-4" />
          <span>Mode hors ligne - Les données seront synchronisées au retour de la connexion</span>
        </div>
      )}
    </header>
  );
}
