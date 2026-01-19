/**
 * EasyGest BP - Service de Synchronisation (CORRIGÉ)
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
 * 🔥 CORRECTION MAJEURE: Envoi des détails d'inventaire en 2 passes
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
    console.log(`📊 [push] Détails: ${pendingInventaires.length} inventaires, ${pendingDetails.length} détails`);
    
    // 🔥 CORRECTION: Envoi en 2 PASSES
    // PASSE 1: Envoyer UNIQUEMENT les inventaires (sans détails)
    console.log('🔵 [push] PASSE 1: Envoi des inventaires seuls');
    const pass1Response = await syncApi.push({
      receptions: pendingReceptions,
      retours: pendingRetours,
      inventaires: pendingInventaires,
      inventaire_details: [], // Vide pour l'instant
      sessions: pendingSessions,
    });
    
    // 🔥 CORRECTION: Le backend peut retourner synced directement OU dans data
    const synced1 = pass1Response.synced || [];
    const conflicts1 = pass1Response.conflicts || [];
    
    console.log('📋 [push] Réponse PASSE 1:', {
      success: pass1Response.success,
      synced: synced1.length,
      conflicts: conflicts1.length,
      raw_response: pass1Response
    });
    
    // Traiter les inventaires synchronisés
    for (const inv of pendingInventaires) {
      const syncedItem = synced1.find((s: any) => 
        s.table === 'inventaires' && (s.local_id === inv.local_id || s.id === inv.id)
      );
      
      if (syncedItem) {
        const serverId = syncedItem.server_id || syncedItem.id;
        console.log(`✅ [push] Inventaire trouvé dans synced`, {
          local_id: inv.local_id,
          old_id: inv.id,
          server_id: serverId,
          syncedItem
        });
        
        inv.id = serverId;
        inv.sync_status = 'synced';
        inv.last_synced_at = new Date().toISOString();
        await db.put('inventaires', inv);
        syncedCount++;
        
        // 🔥 IMPORTANT: Mettre à jour TOUS les détails avec cet inventaire_id
        const allDetails = await db.getAll('inventaire_details');
        let detailsUpdated = 0;
        
        for (const detail of allDetails) {
          if (detail.inventaire_local_id === inv.local_id) {
            console.log(`🔗 [push] Liaison détail`, {
              produit_id: detail.produit_id,
              old_inventaire_local_id: detail.inventaire_local_id,
              new_inventaire_id: serverId
            });
            
            detail.inventaire_id = serverId;
            detail.inventaire_local_id = undefined;
            detail.sync_status = 'pending'; // Forcer re-sync
            await db.put('inventaire_details', detail);
            detailsUpdated++;
          }
        }
        
        console.log(`✅ [push] ${detailsUpdated} détails liés à l'inventaire ${serverId}`);
      } else {
        console.warn(`⚠️ [push] Inventaire non trouvé dans synced`, {
          local_id: inv.local_id,
          id: inv.id,
          synced1_length: synced1.length
        });
      }
    }
    
    // Traiter les autres entités (réceptions, retours, sessions)
    for (const rec of pendingReceptions) {
      const syncedItem = synced1.find((s: any) => 
        s.table === 'receptions_pointeur' && (s.local_id === rec.local_id || s.id === rec.id)
      );
      if (syncedItem) {
        rec.id = syncedItem.server_id || syncedItem.id || rec.id;
        rec.sync_status = 'synced';
        rec.last_synced_at = new Date().toISOString();
        await db.put('receptions_pointeur', rec);
        syncedCount++;
      }
    }
    
    for (const ret of pendingRetours) {
      const syncedItem = synced1.find((s: any) => 
        s.table === 'retours_produits' && (s.local_id === ret.local_id || s.id === ret.id)
      );
      if (syncedItem) {
        ret.id = syncedItem.server_id || syncedItem.id || ret.id;
        ret.sync_status = 'synced';
        ret.last_synced_at = new Date().toISOString();
        await db.put('retours_produits', ret);
        syncedCount++;
      }
    }
    
    for (const sess of pendingSessions) {
      const syncedItem = synced1.find((s: any) => 
        s.table === 'sessions_vente' && (s.local_id === sess.local_id || s.id === sess.id)
      );
      if (syncedItem) {
        sess.id = syncedItem.server_id || syncedItem.id || sess.id;
        sess.sync_status = 'synced';
        sess.last_synced_at = new Date().toISOString();
        await db.put('sessions_vente', sess);
        syncedCount++;
      }
    }
    
    // 🔥 PASSE 2: Envoyer UNIQUEMENT les détails d'inventaire (maintenant liés)
    const detailsToSend = await db.getAllFromIndex('inventaire_details', 'by-sync', 'pending');
    
    if (detailsToSend.length > 0) {
      console.log(`🟢 [push] PASSE 2: Envoi de ${detailsToSend.length} détails d'inventaire`);
      
      // Vérifier que tous les détails ont un inventaire_id valide
      const validDetails = detailsToSend.filter(d => d.inventaire_id !== undefined && d.inventaire_id !== null);
      const invalidDetails = detailsToSend.filter(d => !d.inventaire_id);
      
      if (invalidDetails.length > 0) {
        console.warn(`⚠️ [push] ${invalidDetails.length} détails sans inventaire_id seront ignorés`);
        invalidDetails.forEach(d => {
          console.warn(`  - Détail produit_id=${d.produit_id}, inventaire_local_id=${d.inventaire_local_id}`);
        });
      }
      
      console.log(`📤 [push] Envoi de ${validDetails.length} détails valides`);
      validDetails.forEach(d => {
        console.log(`  - Détail: inventaire_id=${d.inventaire_id}, produit_id=${d.produit_id}, qty=${d.quantite_restante}`);
      });
      
      const pass2Response = await syncApi.push({
        receptions: [],
        retours: [],
        inventaires: [],
        inventaire_details: validDetails,
        sessions: [],
      });
      
      // 🔥 CORRECTION: Le backend retourne synced/conflicts à la racine de la réponse
      const synced2 = pass2Response.synced || [];
      const conflicts2 = pass2Response.conflicts || [];
      
      console.log('📋 [push] Réponse PASSE 2:', {
        success: pass2Response.success,
        confirmed: pass2Response.confirmed,
        synced: synced2.length,
        conflicts: conflicts2.length,
        synced_items: synced2
      });
      
      // Traiter les détails synchronisés
      for (const det of validDetails) {
        const syncedItem = synced2.find((s: any) => 
          s.table === 'inventaire_details' && 
          (s.id === det.id || (s.server_id && s.server_id === det.id))
        );
        
        if (syncedItem) {
          console.log(`✅ [push] Détail produit_id=${det.produit_id} synchronisé`);
          det.id = syncedItem.server_id || syncedItem.id || det.id;
          det.sync_status = 'synced';
          await db.put('inventaire_details', det);
          syncedCount++;
        } else {
          // Vérifier si c'est un conflit
          const isConflict = conflicts2.some((c: any) => 
            c.table === 'inventaire_details' && c.id === det.id
          );
          
          if (!isConflict && pass2Response.success) {
            // Pas de conflit et réponse succès = considérer comme synchronisé
            console.log(`✅ [push] Détail produit_id=${det.produit_id} marqué synced (succès global)`);
            det.sync_status = 'synced';
            await db.put('inventaire_details', det);
            syncedCount++;
          } else if (isConflict) {
            console.warn(`⚠️ [push] Conflit sur détail produit_id=${det.produit_id}`);
            conflictsCount++;
          }
        }
      }
      
      // Gérer les conflits de la passe 2
      for (const conflict of conflicts2) {
        const { table, id, reason } = conflict;
        errors.push(`Conflit ${table} #${id}: ${reason}`);
        console.error(`❌ [push] Conflit: ${table} #${id} - ${reason}`);
      }
    } else {
      console.log('ℹ️ [push] Aucun détail d\'inventaire à synchroniser');
    }
    
    // Gérer les conflits de la passe 1
    for (const conflict of conflicts1) {
      const { table, id, local_id, reason } = conflict;
      errors.push(`Conflit ${table} #${id || local_id}: ${reason}`);
      conflictsCount++;
      console.error(`❌ [push] Conflit: ${table} #${id || local_id} - ${reason}`);
    }
    
    console.log(`✅ [push] Total: ${syncedCount} enregistrements synchronisés, ${conflictsCount} conflits`);
    
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
    const currentUser = await getConfig<User>('current_user');
    
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
    
    // Mise à jour des sessions
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
          ids: records.map((r: any) => r.id).filter(Boolean),
        });
      }
    }
    
    if (syncedData.length > 0) {
      try {
        await syncApi.ack(syncedData);
        console.log('✅ [pull] ACK envoyé');
      } catch (ackError) {
        console.warn('⚠️ [pull] Erreur ACK (non-bloquant):', ackError);
      }
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
  
  return fullSync();
}

/**
 * Marquer un enregistrement local comme synchronisé (pour tests)
 */
export async function markAsSynced(table: string, id: number): Promise<void> {
  const db = await getDB();
  
  if (table === 'receptions_pointeur') {
    const record = await db.get('receptions_pointeur', id);
    if (record) {
      record.sync_status = 'synced';
      record.last_synced_at = new Date().toISOString();
      await db.put('receptions_pointeur', record);
    }
  } else if (table === 'retours_produits') {
    const record = await db.get('retours_produits', id);
    if (record) {
      record.sync_status = 'synced';
      record.last_synced_at = new Date().toISOString();
      await db.put('retours_produits', record);
    }
  }
}