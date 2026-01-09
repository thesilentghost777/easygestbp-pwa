/**
 * EasyGest BP - Contexte de synchronisation
 */

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { fullSync, getSyncStatus, addSyncListener, type SyncStatus, type SyncResult } from '@/lib/sync';
import { useAuth } from './AuthContext';
import { toast } from 'sonner';

interface SyncContextType {
  status: SyncStatus;
  lastResult: SyncResult | null;
  sync: () => Promise<SyncResult>;
  isLoading: boolean;
}

const SyncContext = createContext<SyncContextType | undefined>(undefined);

export function SyncProvider({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isOnline } = useAuth();
  const [status, setStatus] = useState<SyncStatus>({
    lastSync: null,
    pendingCount: 0,
    isSyncing: false,
    isOnline: true,
  });
  const [lastResult, setLastResult] = useState<SyncResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Écouter les changements de statut
  useEffect(() => {
    const unsubscribe = addSyncListener(setStatus);
    
    // Charger le statut initial
    getSyncStatus().then(setStatus);
    
    return unsubscribe;
  }, []);

  // Mettre à jour isOnline quand la connexion change
  useEffect(() => {
    setStatus(prev => ({ ...prev, isOnline }));
  }, [isOnline]);

  const sync = useCallback(async (): Promise<SyncResult> => {
    if (!isAuthenticated) {
      const result: SyncResult = {
        success: false,
        errors: ['Non authentifié'],
        syncedCount: 0,
        conflictsCount: 0,
        message: 'Vous devez être connecté pour synchroniser',
      };
      return result;
    }

    setIsLoading(true);
    
    try {
      const result = await fullSync();
      setLastResult(result);
      
      // Afficher le toast de résultat
      if (result.success) {
        toast.success(result.message, {
          description: result.syncedCount > 0 
            ? `${result.syncedCount} élément(s) synchronisé(s)`
            : undefined,
        });
      } else {
        toast.error('Synchronisation échouée', {
          description: result.message,
        });
      }
      
      return result;
    } finally {
      setIsLoading(false);
      // Rafraîchir le statut
      const newStatus = await getSyncStatus();
      setStatus(newStatus);
    }
  }, [isAuthenticated]);

  return (
    <SyncContext.Provider
      value={{
        status,
        lastResult,
        sync,
        isLoading,
      }}
    >
      {children}
    </SyncContext.Provider>
  );
}

export function useSync() {
  const context = useContext(SyncContext);
  if (context === undefined) {
    throw new Error('useSync must be used within a SyncProvider');
  }
  return context;
}
