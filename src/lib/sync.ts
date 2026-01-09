/**
 * EasyGest BP - Service de Synchronisation
 * Gère la sync bidirectionnelle entre IndexedDB et l'API Laravel
 */

import { getDB, getConfig, setConfig, generateLocalId } from './db';
import { syncApi, checkConnection } from './api';
import type { 
  ReceptionPointeur, 
  RetourProduit, 
  Inventaire, 
  InventaireDetail, 
  SessionVente,
  Produit,
  User,
  VendeurActif
} from './db';

export interface SyncResult {
  success: boolean;
  errors: string[];
  syncedCount: number;
  conflictsCount: number;
  message: string;
}

export interface SyncStatus {
  lastSync: string | null;
  pendingCount: number;
  isSyncing: boolean;
  isOnline: boolean;
}

// État global de synchronisation
let isSyncing = false;
let syncListeners: ((status: SyncStatus) => void)[] = [];

export function addSyncListener(listener: (status: SyncStatus) => void) {
  syncListeners.push(listener);
  return () => {
    syncListeners = syncListeners.filter(l => l !== listener);
  };
}

async function notifyListeners() {
  const status = await getSyncStatus();
  syncListeners.forEach(listener => listener(status));
}

/**
 * Synchronisation complète (Push + Pull)
 */
export async function fullSync(): Promise<SyncResult> {
  console.log('🔄 [fullSync] Début synchronisation complète');
  
  if (isSyncing) {
    return {
      success: false,
      errors: ['Synchronisation déjà en cours'],
      syncedCount: 0,
      conflictsCount: 0,
      message: 'Synchronisation déjà en cours',
    };
  }
  
  isSyncing = true;
  await notifyListeners();
  
  const errors: string[] = [];
  let totalSynced = 0;
  let totalConflicts = 0;
  
  try {
    // Vérifier la connexion
    const isOnline = await checkConnection();
    if (!isOnline) {
      isSyncing = false;
      await notifyListeners();
      return {
        success: false,
        errors: ['Pas de connexion réseau'],
        syncedCount: 0,
        conflictsCount: 0,
        message: '📵 Hors ligne - synchronisation impossible',
      };
    }
    
    // Phase 1: Push (envoyer les données locales)
    console.log('📤 [fullSync] Phase 1: Push');
    const pushResult = await pushLocalChanges();
    if (!pushResult.success) {
      errors.push(...pushResult.errors);
    }
    totalSynced += pushResult.syncedCount;
    totalConflicts += pushResult.conflictsCount;
    
    // Phase 2: Pull (récupérer les données serveur)
    console.log('📥 [fullSync] Phase 2: Pull');
    const pullResult = await pullServerData();
    if (!pullResult.success) {
      errors.push(...pullResult.errors);
    }
    totalSynced += pullResult.syncedCount;
    
    // Sauvegarder le timestamp de dernière sync
    await setConfig('last_sync', new Date().toISOString());
    
    const message = errors.length === 0
      ? `✅ Synchronisation réussie (${totalSynced} éléments)`
      : `⚠️ Synchronisation partielle (${errors.length} erreurs)`;
    
    console.log(`✅ [fullSync] Terminée: ${totalSynced} synced, ${totalConflicts} conflits`);
    
    return {
      success: errors.length === 0,
      errors,
      syncedCount: totalSynced,
      conflictsCount: totalConflicts,
      message,
    };
    
  } catch (error: any) {
    console.error('❌ [fullSync] Erreur:', error);
    return {
      success: false,
      errors: [error.message],
      syncedCount: 0,
      conflictsCount: 0,
      message: `❌ Erreur: ${error.message}`,
    };
  } finally {
    isSyncing = false;
    await notifyListeners();
  }
}

/**
 * Push: Envoyer les modifications locales au serveur
 */
async function pushLocalChanges(): Promise<SyncResult> {
  const db = await getDB();
  const errors: string[] = [];
  let syncedCount = 0;
  let conflictsCount = 0;
  
  try {
    // Récupérer toutes les données en attente
    const pendingReceptions = await db.getAllFromIndex('receptions_pointeur', 'by-sync', 'pending');
    const pendingRetours = await db.getAllFromIndex('retours_produits', 'by-sync', 'pending');
    const pendingInventaires = await db.getAllFromIndex('inventaires', 'by-sync', 'pending');
    const pendingDetails = await db.getAllFromIndex('inventaire_details', 'by-sync', 'pending');
    const pendingSessions = await db.getAllFromIndex('sessions_vente', 'by-sync', 'pending');
    
    const total = pendingReceptions.length + pendingRetours.length + 
                  pendingInventaires.length + pendingDetails.length + 
                  pendingSessions.length;
    
    if (total === 0) {
      console.log('✅ [push] Aucune donnée à synchroniser');
      return {
        success: true,
        errors: [],
        syncedCount: 0,
        conflictsCount: 0,
        message: 'Aucune donnée à synchroniser',
      };
    }
    
    console.log(`📤 [push] Envoi de ${total} enregistrements...`);
    
    // Envoyer au serveur
    const response = await syncApi.push({
      receptions: pendingReceptions,
      retours: pendingRetours,
      inventaires: pendingInventaires,
      inventaire_details: pendingDetails,
      sessions: pendingSessions,
    });
    
    if (!response.success) {
      return {
        success: false,
        errors: [response.message || 'Erreur serveur'],
        syncedCount: 0,
        conflictsCount: 0,
        message: response.message || 'Erreur lors de l\'envoi',
      };
    }
    
    const { synced = [], conflicts = [] } = response.data || {};
    
    // Marquer les enregistrements synchronisés
    for (const item of synced) {
      const { table, id, server_id } = item;
      
      if (table === 'receptions_pointeur') {
        const record = pendingReceptions.find(r => r.local_id === id || r.id === id);
        if (record) {
          record.id = server_id;
          record.sync_status = 'synced';
          record.last_synced_at = new Date().toISOString();
          await db.put('receptions_pointeur', record);
        }
      } else if (table === 'retours_produits') {
        const record = pendingRetours.find(r => r.local_id === id || r.id === id);
        if (record) {
          record.id = server_id;
          record.sync_status = 'synced';
          record.last_synced_at = new Date().toISOString();
          await db.put('retours_produits', record);
        }
      }
      // ... autres tables
      
      syncedCount++;
    }
    
    // Gérer les conflits
    for (const conflict of conflicts) {
      const { table, id, reason } = conflict;
      errors.push(`Conflit ${table} #${id}: ${reason}`);
      conflictsCount++;
      
      // Marquer comme conflit dans la DB locale
      // ...
    }
    
    return {
      success: true,
      errors,
      syncedCount,
      conflictsCount,
      message: `${syncedCount} synchronisés, ${conflictsCount} conflits`,
    };
    
  } catch (error: any) {
    console.error('❌ [push] Erreur:', error);
    return {
      success: false,
      errors: [error.message],
      syncedCount: 0,
      conflictsCount: 0,
      message: error.message,
    };
  }
}

/**
 * Pull: Récupérer les données du serveur
 */
async function pullServerData(): Promise<SyncResult> {
  const db = await getDB();
  const errors: string[] = [];
  let syncedCount = 0;
  
  try {
    const lastSync = await getConfig<string>('last_sync');
    
    console.log(`📥 [pull] Récupération des données depuis ${lastSync || 'le début'}...`);
    
    const response = await syncApi.pull(lastSync || undefined);
    
    if (!response.success) {
      return {
        success: false,
        errors: [response.message || 'Erreur serveur'],
        syncedCount: 0,
        conflictsCount: 0,
        message: response.message || 'Erreur lors de la récupération',
      };
    }
    
    const data = response.data?.data || response.data || {};
    
    // Mise à jour des utilisateurs
    if (data.users && Array.isArray(data.users)) {
      for (const user of data.users) {
        await db.put('users', {
          ...user,
          sync_status: 'synced',
          last_synced_at: new Date().toISOString(),
        });
        syncedCount++;
      }
      console.log(`✅ [pull] ${data.users.length} utilisateurs mis à jour`);
    }
    
    // Mise à jour des produits
    if (data.produits && Array.isArray(data.produits)) {
      for (const produit of data.produits) {
        await db.put('produits', {
          ...produit,
          sync_status: 'synced',
          last_synced_at: new Date().toISOString(),
        });
        syncedCount++;
      }
      console.log(`✅ [pull] ${data.produits.length} produits mis à jour`);
    }
    
    // Mise à jour des vendeurs actifs
    if (data.vendeurs_actifs && Array.isArray(data.vendeurs_actifs)) {
      for (const va of data.vendeurs_actifs) {
        await db.put('vendeurs_actifs', {
          ...va,
          sync_status: 'synced',
          last_synced_at: new Date().toISOString(),
        });
        syncedCount++;
      }
      console.log(`✅ [pull] ${data.vendeurs_actifs.length} vendeurs actifs mis à jour`);
    }
    
    // Mise à jour des réceptions
    if (data.receptions_pointeur && Array.isArray(data.receptions_pointeur)) {
      for (const rec of data.receptions_pointeur) {
        const existing = await db.get('receptions_pointeur', rec.id);
        if (!existing || existing.sync_status !== 'pending') {
          await db.put('receptions_pointeur', {
            ...rec,
            sync_status: 'synced',
            last_synced_at: new Date().toISOString(),
          });
          syncedCount++;
        }
      }
      console.log(`✅ [pull] ${data.receptions_pointeur.length} réceptions mises à jour`);
    }
    
    // Mise à jour des retours
    if (data.retours_produits && Array.isArray(data.retours_produits)) {
      for (const ret of data.retours_produits) {
        const existing = await db.get('retours_produits', ret.id);
        if (!existing || existing.sync_status !== 'pending') {
          await db.put('retours_produits', {
            ...ret,
            sync_status: 'synced',
            last_synced_at: new Date().toISOString(),
          });
          syncedCount++;
        }
      }
      console.log(`✅ [pull] ${data.retours_produits.length} retours mis à jour`);
    }
    
    // Mise à jour des sessions de vente
    if (data.sessions_vente && Array.isArray(data.sessions_vente)) {
      for (const sess of data.sessions_vente) {
        const existing = await db.get('sessions_vente', sess.id);
        if (!existing || existing.sync_status !== 'pending') {
          await db.put('sessions_vente', {
            ...sess,
            sync_status: 'synced',
            last_synced_at: new Date().toISOString(),
          });
          syncedCount++;
        }
      }
      console.log(`✅ [pull] ${data.sessions_vente.length} sessions mises à jour`);
    }
    
    // Envoyer l'ACK
    const syncedData: { table: string; ids: number[] }[] = [];
    
    for (const [table, records] of Object.entries(data)) {
      if (Array.isArray(records) && records.length > 0) {
        syncedData.push({
          table,
          ids: records.map((r: any) => r.id),
        });
      }
    }
    
    if (syncedData.length > 0) {
      await syncApi.ack(syncedData);
      console.log('✅ [pull] ACK envoyé');
    }
    
    return {
      success: true,
      errors,
      syncedCount,
      conflictsCount: 0,
      message: `${syncedCount} éléments récupérés`,
    };
    
  } catch (error: any) {
    console.error('❌ [pull] Erreur:', error);
    return {
      success: false,
      errors: [error.message],
      syncedCount: 0,
      conflictsCount: 0,
      message: error.message,
    };
  }
}

/**
 * Obtenir le statut de synchronisation
 */
export async function getSyncStatus(): Promise<SyncStatus> {
  const db = await getDB();
  
  // Compter les enregistrements en attente
  const pendingReceptions = await db.countFromIndex('receptions_pointeur', 'by-sync', 'pending');
  const pendingRetours = await db.countFromIndex('retours_produits', 'by-sync', 'pending');
  const pendingInventaires = await db.countFromIndex('inventaires', 'by-sync', 'pending');
  const pendingSessions = await db.countFromIndex('sessions_vente', 'by-sync', 'pending');
  
  const pendingCount = pendingReceptions + pendingRetours + pendingInventaires + pendingSessions;
  
  const lastSync = await getConfig<string>('last_sync');
  const isOnline = await checkConnection();
  
  return {
    lastSync,
    pendingCount,
    isSyncing,
    isOnline,
  };
}

/**
 * Sync automatique au retour sur le dashboard
 */
export async function autoSyncOnDashboard(): Promise<SyncResult | null> {
  const status = await getSyncStatus();
  
  if (!status.isOnline) {
    console.log('📵 [autoSync] Hors ligne, sync ignorée');
    return null;
  }
  
  if (status.pendingCount > 0 || !status.lastSync) {
    console.log(`🔄 [autoSync] ${status.pendingCount} données en attente, sync...`);
    return fullSync();
  }
  
  // Faire un pull même sans données en attente (pour récupérer les MAJ serveur)
  return fullSync();
}
