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
  // Nouveau: compteur de synchronisation pour déclencher les rechargements
  syncCounter: number;
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
  const [syncCounter, setSyncCounter] = useState(0);
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
  // Écouter les événements globaux pour incrémenter le compteur
  useEffect(() => {
    const handleSyncComplete = () => {
      setSyncCounter(prev => prev + 1);
    };
    window.addEventListener('global-sync-complete', handleSyncComplete);
    return () => {
      window.removeEventListener('global-sync-complete', handleSyncComplete);
    };
  }, []);
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
       
        // Incrémenter le compteur pour déclencher le rechargement dans les composants
        setSyncCounter(prev => prev + 1);
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
        syncCounter,
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