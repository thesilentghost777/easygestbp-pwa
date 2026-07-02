/**
 * EasyGest BP - Service de Synchronisation (CORRIGÉ v3)
 *
 * NOUVEAUTÉ v3 :
 * - Pull des raisons_retour depuis le serveur → stockées dans IDB
 * - Pas de push pour raisons_retour (read-only côté client)
 */

import { getDB, getConfig, setConfig } from './db';
import { syncApi, checkConnection } from './api';
import type {
  ReceptionPointeur,
  RetourProduit,
  Inventaire,
  InventaireDetail,
  SessionVente,
  Produit,
  User,
  VendeurActif,
  RaisonRetour,
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

// ─── État global de synchronisation ───────────────────────────────────────────
let isSyncing = false;
let syncListeners: ((status: SyncStatus) => void)[] = [];

const pushLock = new Map<string, boolean>();

function getPushKey(item: { local_id?: string; id?: number }): string {
  return item.local_id ?? `id_${item.id}`;
}

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

// ─── fullSync ─────────────────────────────────────────────────────────────────
export async function fullSync(): Promise<SyncResult> {
  console.log('🔄 [fullSync] Début synchronisation complète');

  if (isSyncing) {
    console.log('⏭️ [fullSync] Sync déjà en cours, ignorée');
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
    const isOnline = await checkConnection();
    if (!isOnline) {
      return {
        success: false,
        errors: ['Pas de connexion réseau'],
        syncedCount: 0,
        conflictsCount: 0,
        message: '📵 Hors ligne - synchronisation impossible',
      };
    }

    // Phase 1 : Push
    console.log('📤 [fullSync] Phase 1: Push');
    const pushResult = await pushLocalChanges();
    if (!pushResult.success) errors.push(...pushResult.errors);
    totalSynced    += pushResult.syncedCount;
    totalConflicts += pushResult.conflictsCount;

    // Phase 2 : Pull
    console.log('📥 [fullSync] Phase 2: Pull');
    const pullResult = await pullServerData();
    if (!pullResult.success) errors.push(...pullResult.errors);
    totalSynced += pullResult.syncedCount;

    await setConfig('last_sync', new Date().toISOString());

    const message =
      errors.length === 0
        ? `✅ Synchronisation réussie (${totalSynced} éléments)`
        : `⚠️ Synchronisation partielle (${errors.length} erreurs)`;

    console.log(
      `✅ [fullSync] Terminée: ${totalSynced} synced, ${totalConflicts} conflits`
    );

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

// ─── pushLocalChanges ─────────────────────────────────────────────────────────
async function pushLocalChanges(): Promise<SyncResult> {
  const db = await getDB();
  const errors: string[] = [];
  let syncedCount = 0;
  let conflictsCount = 0;

  const lockedReceptions: string[] = [];
  const lockedRetours: string[] = [];
  const lockedInventaires: string[] = [];
  const lockedSessions: string[] = [];

  try {
    const allPendingReceptions = await db.getAllFromIndex(
      'receptions_pointeur',
      'by-sync',
      'pending'
    );
    const allPendingRetours = await db.getAllFromIndex(
      'retours_produits',
      'by-sync',
      'pending'
    );
    const allPendingInventaires = await db.getAllFromIndex(
      'inventaires',
      'by-sync',
      'pending'
    );
    const allPendingSessions = await db.getAllFromIndex(
      'sessions_vente',
      'by-sync',
      'pending'
    );

    const pendingReceptions = allPendingReceptions.filter(r => {
      const key = getPushKey(r);
      if (pushLock.get(key)) return false;
      pushLock.set(key, true);
      lockedReceptions.push(key);
      return true;
    });

    const pendingRetours = allPendingRetours.filter(r => {
      const key = getPushKey(r);
      if (pushLock.get(key)) return false;
      pushLock.set(key, true);
      lockedRetours.push(key);
      return true;
    });

    const pendingInventaires = allPendingInventaires.filter(r => {
      const key = getPushKey(r);
      if (pushLock.get(key)) return false;
      pushLock.set(key, true);
      lockedInventaires.push(key);
      return true;
    });

    const pendingSessions = allPendingSessions.filter(r => {
      const key = getPushKey(r);
      if (pushLock.get(key)) return false;
      pushLock.set(key, true);
      lockedSessions.push(key);
      return true;
    });

    const total =
      pendingReceptions.length +
      pendingRetours.length +
      pendingInventaires.length +
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

    // ── PASSE 1 ──────────────────────────────────────────────────────────────
    const pass1Response = await syncApi.push({
      receptions: pendingReceptions,
      retours: pendingRetours,
      inventaires: pendingInventaires,
      inventaire_details: [],
      sessions: pendingSessions,
    });

    const synced1 = pass1Response.synced || [];
    const conflicts1 = pass1Response.conflicts || [];

    // Réceptions
    for (const rec of pendingReceptions) {
      const syncedItem = synced1.find(
        (s: any) =>
          s.table === 'receptions_pointeur' &&
          (s.local_id === rec.local_id || s.id === rec.id)
      );
      if (syncedItem) {
        const serverId = syncedItem.server_id || syncedItem.id;
        const oldIdbId = rec.id;
        if (oldIdbId !== undefined && oldIdbId !== serverId) {
          try { await db.delete('receptions_pointeur', oldIdbId); } catch {}
        }
        rec.id = serverId;
        rec.sync_status = 'synced';
        rec.last_synced_at = new Date().toISOString();
        await db.put('receptions_pointeur', rec);
        syncedCount++;
      }
    }

    // Retours
    for (const ret of pendingRetours) {
      const syncedItem = synced1.find(
        (s: any) =>
          s.table === 'retours_produits' &&
          (s.local_id === ret.local_id || s.id === ret.id)
      );
      if (syncedItem) {
        const serverId = syncedItem.server_id || syncedItem.id;
        const oldIdbId = ret.id;
        if (oldIdbId !== undefined && oldIdbId !== serverId) {
          try { await db.delete('retours_produits', oldIdbId); } catch {}
        }
        ret.id = serverId;
        ret.sync_status = 'synced';
        ret.last_synced_at = new Date().toISOString();
        await db.put('retours_produits', ret);
        syncedCount++;
      }
    }

    // Inventaires
    for (const inv of pendingInventaires) {
      const syncedItem = synced1.find(
        (s: any) =>
          s.table === 'inventaires' &&
          (s.local_id === inv.local_id || s.id === inv.id)
      );
      if (syncedItem) {
        const serverId = syncedItem.server_id || syncedItem.id;
        const oldIdbId = inv.id!;
        await db.delete('inventaires', oldIdbId);
        inv.id = serverId;
        inv.sync_status = 'synced';
        inv.last_synced_at = new Date().toISOString();
        await db.put('inventaires', inv);
        syncedCount++;

        const allDetails = await db.getAll('inventaire_details');
        for (const detail of allDetails) {
          if (detail.inventaire_local_id === inv.local_id) {
            detail.inventaire_id = serverId;
            detail.inventaire_local_id = undefined;
            detail.sync_status = 'pending';
            await db.put('inventaire_details', detail);
          }
        }
      }
    }

    // Sessions
    for (const sess of pendingSessions) {
      const syncedItem = synced1.find(
        (s: any) =>
          s.table === 'sessions_vente' &&
          (s.local_id === sess.local_id || s.id === sess.id)
      );
      if (syncedItem) {
        const serverId = syncedItem.server_id || syncedItem.id;
        const oldIdbId = sess.id;
        if (oldIdbId !== undefined && oldIdbId !== serverId) {
          try { await db.delete('sessions_vente', oldIdbId); } catch {}
        }
        sess.id = serverId;
        sess.sync_status = 'synced';
        sess.last_synced_at = new Date().toISOString();
        await db.put('sessions_vente', sess);
        syncedCount++;
      }
    }

    // ── PASSE 2 : détails inventaire ──────────────────────────────────────────
    const detailsToSend = await db.getAllFromIndex(
      'inventaire_details',
      'by-sync',
      'pending'
    );

    if (detailsToSend.length > 0) {
      const validDetails = detailsToSend.filter(
        d => d.inventaire_id !== undefined && d.inventaire_id !== null
      );
      const invalidDetails = detailsToSend.filter(d => !d.inventaire_id);

      if (invalidDetails.length > 0) {
        console.warn(
          `⚠️ [push] ${invalidDetails.length} détails sans inventaire_id ignorés`
        );
      }

      const pass2Response = await syncApi.push({
        receptions: [],
        retours: [],
        inventaires: [],
        inventaire_details: validDetails,
        sessions: [],
      });

      const synced2 = pass2Response.synced || [];

      for (const det of validDetails) {
        const syncedItem = synced2.find(
          (s: any) =>
            s.table === 'inventaire_details' &&
            (s.id === det.id || (s.server_id && s.server_id === det.id))
        );
        if (syncedItem) {
          const oldIdbId = det.id!;
          const newServerId = syncedItem.server_id || syncedItem.id;
          if (oldIdbId !== newServerId) {
            await db.delete('inventaire_details', oldIdbId);
          }
          det.id = newServerId;
          det.sync_status = 'synced';
          await db.put('inventaire_details', det);
          syncedCount++;
        } else if (pass2Response.success) {
          det.sync_status = 'synced';
          await db.put('inventaire_details', det);
          syncedCount++;
        }
      }

      for (const conflict of pass2Response.conflicts || []) {
        errors.push(
          `Conflit inventaire_details #${conflict.id}: ${conflict.reason}`
        );
        conflictsCount++;
      }
    }

    // Conflits passe 1
    for (const conflict of conflicts1) {
      errors.push(
        `Conflit ${conflict.table} #${conflict.id || conflict.local_id}: ${conflict.reason}`
      );
      conflictsCount++;
    }

    return {
      success: true,
      errors,
      syncedCount,
      conflictsCount,
      message: `${syncedCount} synchronisés`,
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
  } finally {
    for (const key of lockedReceptions) pushLock.delete(key);
    for (const key of lockedRetours) pushLock.delete(key);
    for (const key of lockedInventaires) pushLock.delete(key);
    for (const key of lockedSessions) pushLock.delete(key);
    console.log('🔓 [push] pushLock libéré');
  }
}

// ─── pullServerData ───────────────────────────────────────────────────────────
async function pullServerData(): Promise<SyncResult> {
  const db = await getDB();
  const errors: string[] = [];
  let syncedCount = 0;

  try {
    const lastSync = await getConfig<string>('last_sync');
    console.log(`📥 [pull] Depuis ${lastSync || 'le début'}...`);

    const response = await syncApi.pull(lastSync || undefined);

    if (!response.success) {
      return {
        success: false,
        errors: [response.message || 'Erreur serveur'],
        syncedCount: 0,
        conflictsCount: 0,
        message: response.message || 'Erreur',
      };
    }

    const data = response.data?.data || response.data || {};

    // ── Utilisateurs ──────────────────────────────────────────────────────────
    if (data.users && Array.isArray(data.users)) {
      for (const user of data.users) {
        await db.put('users', {
          ...user,
          sync_status: 'synced',
          last_synced_at: new Date().toISOString(),
        });
        syncedCount++;
      }
      console.log(`✅ [pull] ${data.users.length} utilisateurs`);
    }

    // ── Produits ──────────────────────────────────────────────────────────────
    if (data.produits && Array.isArray(data.produits)) {
      for (const produit of data.produits) {
        await db.put('produits', {
          ...produit,
          sync_status: 'synced',
          last_synced_at: new Date().toISOString(),
        });
        syncedCount++;
      }
      console.log(`✅ [pull] ${data.produits.length} produits`);
    }

    // ── Vendeurs actifs ───────────────────────────────────────────────────────
    if (data.vendeurs_actifs && Array.isArray(data.vendeurs_actifs)) {
      for (const va of data.vendeurs_actifs) {
        await db.put('vendeurs_actifs', {
          ...va,
          sync_status: 'synced',
          last_synced_at: new Date().toISOString(),
        });
        syncedCount++;
      }
      console.log(`✅ [pull] ${data.vendeurs_actifs.length} vendeurs actifs`);
    }

    // ── Raisons de retour (NOUVEAU) ───────────────────────────────────────────
    if (data.raisons_retour && Array.isArray(data.raisons_retour)) {
      for (const raison of data.raisons_retour) {
        await db.put('raisons_retour', {
          ...raison,
          sync_status: 'synced',
          last_synced_at: new Date().toISOString(),
        });
        syncedCount++;
      }
      console.log(`✅ [pull] ${data.raisons_retour.length} raisons de retour`);
    }

    // ── Réceptions ────────────────────────────────────────────────────────────
    if (data.receptions_pointeur && Array.isArray(data.receptions_pointeur)) {
      for (const rec of data.receptions_pointeur) {
        const existing = await db.get('receptions_pointeur', rec.id);
        if (existing && existing.sync_status === 'pending') {
          console.log(`⏭️ [pull] Réception ${rec.id} pending locale conservée`);
          continue;
        }
        if (rec.local_id) {
          const allLocal = await db.getAllFromIndex(
            'receptions_pointeur',
            'by-local-id',
            rec.local_id
          );
          for (const ghost of allLocal) {
            if (ghost.id !== rec.id) {
              try { await db.delete('receptions_pointeur', ghost.id!); } catch {}
            }
          }
        }
        await db.put('receptions_pointeur', {
          ...rec,
          sync_status: 'synced',
          last_synced_at: new Date().toISOString(),
        });
        syncedCount++;
      }
      console.log(`✅ [pull] ${data.receptions_pointeur.length} réceptions traitées`);
    }

    // ── Retours ───────────────────────────────────────────────────────────────
    if (data.retours_produits && Array.isArray(data.retours_produits)) {
      for (const ret of data.retours_produits) {
        const existing = await db.get('retours_produits', ret.id);
        if (existing && existing.sync_status === 'pending') {
          console.log(`⏭️ [pull] Retour ${ret.id} pending local conservé`);
          continue;
        }
        if (ret.local_id) {
          const allLocal = await db.getAllFromIndex(
            'retours_produits',
            'by-local-id',
            ret.local_id
          );
          for (const ghost of allLocal) {
            if (ghost.id !== ret.id) {
              try { await db.delete('retours_produits', ghost.id!); } catch {}
            }
          }
        }
        await db.put('retours_produits', {
          ...ret,
          sync_status: 'synced',
          last_synced_at: new Date().toISOString(),
        });
        syncedCount++;
      }
      console.log(`✅ [pull] ${data.retours_produits.length} retours traités`);
    }

    // ── Sessions ──────────────────────────────────────────────────────────────
    if (data.sessions_vente && Array.isArray(data.sessions_vente)) {
      for (const sess of data.sessions_vente) {
        const existing = await db.get('sessions_vente', sess.id);
        if (existing && existing.sync_status === 'pending') continue;
        await db.put('sessions_vente', {
          ...sess,
          sync_status: 'synced',
          last_synced_at: new Date().toISOString(),
        });
        syncedCount++;
      }
      console.log(`✅ [pull] ${data.sessions_vente.length} sessions`);
    }

    // ── ACK ───────────────────────────────────────────────────────────────────
    const syncedData: { table: string; ids: number[] }[] = [];
    for (const [table, records] of Object.entries(data)) {
      // On n'ack pas raisons_retour (table légère, toujours renvoyée complète)
      if (table === 'raisons_retour') continue;
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
      } catch (e) {
        console.warn('⚠️ [pull] ACK non-bloquant:', e);
      }
    }

    return {
      success: true,
      errors,
      syncedCount,
      conflictsCount: 0,
      message: `${syncedCount} éléments`,
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

// ─── getSyncStatus ────────────────────────────────────────────────────────────
export async function getSyncStatus(): Promise<SyncStatus> {
  const db = await getDB();
  const pendingReceptions = await db.countFromIndex(
    'receptions_pointeur',
    'by-sync',
    'pending'
  );
  const pendingRetours = await db.countFromIndex(
    'retours_produits',
    'by-sync',
    'pending'
  );
  const pendingInventaires = await db.countFromIndex(
    'inventaires',
    'by-sync',
    'pending'
  );
  const pendingSessions = await db.countFromIndex(
    'sessions_vente',
    'by-sync',
    'pending'
  );
  const pendingCount =
    pendingReceptions + pendingRetours + pendingInventaires + pendingSessions;
  const lastSync = await getConfig<string>('last_sync');
  const isOnline = await checkConnection();
  return { lastSync, pendingCount, isSyncing, isOnline };
}

// ─── autoSyncOnDashboard ──────────────────────────────────────────────────────
export async function autoSyncOnDashboard(): Promise<SyncResult | null> {
  const status = await getSyncStatus();
  if (!status.isOnline) {
    console.log('📵 [autoSync] Hors ligne, sync ignorée');
    return null;
  }
  console.log(`🔄 [autoSync] Lancement sync (${status.pendingCount} pending)`);
  return fullSync();
}

// ─── markAsSynced (debug) ─────────────────────────────────────────────────────
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