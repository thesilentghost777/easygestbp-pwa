/**
 * EasyGest BP - Database Layer (IndexedDB)
 * Gestion du stockage local offline-first
 */

import { openDB, DBSchema, IDBPDatabase } from 'idb';

// Types pour la base de données
export interface User {
  id: number;
  name: string;
  numero_telephone: string;
  role: 'pdg' | 'pointeur' | 'vendeur_boulangerie' | 'vendeur_patisserie' | 'producteur';
  code_pin?: string;
  actif: boolean;
  preferred_language: string;
  sync_status: 'synced' | 'pending' | 'conflict';
  last_synced_at?: string;
  created_at: string;
  updated_at: string;
}

export interface Produit {
  id: number;
  nom: string;
  prix: number;
  categorie: 'boulangerie' | 'patisserie';
  actif: boolean;
  sync_status: 'synced' | 'pending' | 'conflict';
  last_synced_at?: string;
  created_at: string;
  updated_at: string;
}

export interface VendeurActif {
  id: number;
  categorie: 'boulangerie' | 'patisserie';
  vendeur_id: number | null;
  connecte_a?: string;
  sync_status: 'synced' | 'pending' | 'conflict';
  last_synced_at?: string;
  created_at: string;
  updated_at: string;
}

export interface ReceptionPointeur {
  id?: number;
  local_id?: string;
  pointeur_id: number;
  producteur_id: number;
  produit_id: number;
  quantite: number;
  vendeur_assigne_id: number | null;
  verrou: boolean;
  date_reception: string;
  notes?: string;
  sync_status: 'synced' | 'pending' | 'conflict';
  last_synced_at?: string;
  created_at: string;
  updated_at: string;
}

export interface RetourProduit {
  id?: number;
  local_id?: string;
  pointeur_id: number;
  vendeur_id: number;
  produit_id: number;
  quantite: number;
  raison: 'perime' | 'abime' | 'autre';
  description?: string;
  verrou: boolean;
  date_retour: string;
  sync_status: 'synced' | 'pending' | 'conflict';
  last_synced_at?: string;
  created_at: string;
  updated_at: string;
}

export interface Inventaire {
  id?: number;
  local_id?: string;
  vendeur_sortant_id: number;
  vendeur_entrant_id: number;
  categorie: 'boulangerie' | 'patisserie';
  valide_sortant: boolean;
  valide_entrant: boolean;
  date_inventaire: string;
  sync_status: 'synced' | 'pending' | 'conflict';
  last_synced_at?: string;
  created_at: string;
  updated_at: string;
}

export interface InventaireDetail {
  id?: number;
  local_id?: string;
  inventaire_id: number;
  inventaire_local_id?: string;
  produit_id: number;
  quantite_restante: number;
  sync_status: 'synced' | 'pending' | 'conflict';
}

export interface SessionVente {
  id?: number;
  local_id?: string;
  vendeur_id: number;
  categorie: 'boulangerie' | 'patisserie';
  fond_vente: number;
  orange_money_initial: number;
  mtn_money_initial: number;
  montant_verse?: number;
  orange_money_final?: number;
  mtn_money_final?: number;
  manquant?: number;
  valeur_vente?: number;
  statut: 'ouverte' | 'fermee';
  fermee_par?: number;
  date_ouverture: string;
  date_fermeture?: string;
  sync_status: 'synced' | 'pending' | 'conflict';
  last_synced_at?: string;
  created_at: string;
  updated_at: string;
}

export interface SyncQueueItem {
  id?: number;
  table_name: string;
  record_id: number | string;
  action: 'create' | 'update' | 'delete';
  data: any;
  created_at: string;
  attempts: number;
  last_error?: string;
}

export interface AppConfig {
  key: string;
  value: any;
}

// Schema IndexedDB
interface EasyGestDB extends DBSchema {
  users: {
    key: number;
    value: User;
    indexes: { 'by-role': string; 'by-phone': string; 'by-sync': string };
  };
  produits: {
    key: number;
    value: Produit;
    indexes: { 'by-categorie': string; 'by-sync': string };
  };
  vendeurs_actifs: {
    key: number;
    value: VendeurActif;
    indexes: { 'by-categorie': string };
  };
  receptions_pointeur: {
    key: number;
    value: ReceptionPointeur;
    indexes: { 'by-date': string; 'by-pointeur': number; 'by-vendeur': number; 'by-sync': string; 'by-local-id': string };
  };
  retours_produits: {
    key: number;
    value: RetourProduit;
    indexes: { 'by-date': string; 'by-pointeur': number; 'by-vendeur': number; 'by-sync': string; 'by-local-id': string };
  };
  inventaires: {
    key: number;
    value: Inventaire;
    indexes: { 'by-date': string; 'by-sync': string; 'by-local-id': string };
  };
  inventaire_details: {
    key: number;
    value: InventaireDetail;
    indexes: { 'by-inventaire': number; 'by-sync': string };
  };
  sessions_vente: {
    key: number;
    value: SessionVente;
    indexes: { 'by-vendeur': number; 'by-statut': string; 'by-sync': string; 'by-local-id': string };
  };
  sync_queue: {
    key: number;
    value: SyncQueueItem;
    indexes: { 'by-table': string; 'by-created': string };
  };
  config: {
    key: string;
    value: AppConfig;
  };
}

const DB_NAME = 'easygest-bp';
const DB_VERSION = 1;

let dbInstance: IDBPDatabase<EasyGestDB> | null = null;

export async function initDB(): Promise<IDBPDatabase<EasyGestDB>> {
  if (dbInstance) return dbInstance;

  dbInstance = await openDB<EasyGestDB>(DB_NAME, DB_VERSION, {
    upgrade(db) {
      // Users
      if (!db.objectStoreNames.contains('users')) {
        const userStore = db.createObjectStore('users', { keyPath: 'id' });
        userStore.createIndex('by-role', 'role');
        userStore.createIndex('by-phone', 'numero_telephone');
        userStore.createIndex('by-sync', 'sync_status');
      }

      // Produits
      if (!db.objectStoreNames.contains('produits')) {
        const produitStore = db.createObjectStore('produits', { keyPath: 'id' });
        produitStore.createIndex('by-categorie', 'categorie');
        produitStore.createIndex('by-sync', 'sync_status');
      }

      // Vendeurs actifs
      if (!db.objectStoreNames.contains('vendeurs_actifs')) {
        const vaStore = db.createObjectStore('vendeurs_actifs', { keyPath: 'id' });
        vaStore.createIndex('by-categorie', 'categorie');
      }

      // Réceptions
      if (!db.objectStoreNames.contains('receptions_pointeur')) {
        const recStore = db.createObjectStore('receptions_pointeur', { keyPath: 'id', autoIncrement: true });
        recStore.createIndex('by-date', 'date_reception');
        recStore.createIndex('by-pointeur', 'pointeur_id');
        recStore.createIndex('by-vendeur', 'vendeur_assigne_id');
        recStore.createIndex('by-sync', 'sync_status');
        recStore.createIndex('by-local-id', 'local_id');
      }

      // Retours
      if (!db.objectStoreNames.contains('retours_produits')) {
        const retStore = db.createObjectStore('retours_produits', { keyPath: 'id', autoIncrement: true });
        retStore.createIndex('by-date', 'date_retour');
        retStore.createIndex('by-pointeur', 'pointeur_id');
        retStore.createIndex('by-vendeur', 'vendeur_id');
        retStore.createIndex('by-sync', 'sync_status');
        retStore.createIndex('by-local-id', 'local_id');
      }

      // Inventaires
      if (!db.objectStoreNames.contains('inventaires')) {
        const invStore = db.createObjectStore('inventaires', { keyPath: 'id', autoIncrement: true });
        invStore.createIndex('by-date', 'date_inventaire');
        invStore.createIndex('by-sync', 'sync_status');
        invStore.createIndex('by-local-id', 'local_id');
      }

      // Inventaire détails
      if (!db.objectStoreNames.contains('inventaire_details')) {
        const invDetailStore = db.createObjectStore('inventaire_details', { keyPath: 'id', autoIncrement: true });
        invDetailStore.createIndex('by-inventaire', 'inventaire_id');
        invDetailStore.createIndex('by-sync', 'sync_status');
      }

      // Sessions de vente
      if (!db.objectStoreNames.contains('sessions_vente')) {
        const sessStore = db.createObjectStore('sessions_vente', { keyPath: 'id', autoIncrement: true });
        sessStore.createIndex('by-vendeur', 'vendeur_id');
        sessStore.createIndex('by-statut', 'statut');
        sessStore.createIndex('by-sync', 'sync_status');
        sessStore.createIndex('by-local-id', 'local_id');
      }

      // Sync queue
      if (!db.objectStoreNames.contains('sync_queue')) {
        const syncStore = db.createObjectStore('sync_queue', { keyPath: 'id', autoIncrement: true });
        syncStore.createIndex('by-table', 'table_name');
        syncStore.createIndex('by-created', 'created_at');
      }

      // Config
      if (!db.objectStoreNames.contains('config')) {
        db.createObjectStore('config', { keyPath: 'key' });
      }
    },
  });

  return dbInstance;
}

export async function getDB(): Promise<IDBPDatabase<EasyGestDB>> {
  if (!dbInstance) {
    await initDB();
  }
  return dbInstance!;
}

// Helpers pour la configuration
export async function getConfig<T>(key: string): Promise<T | null> {
  const db = await getDB();
  const config = await db.get('config', key);
  return config?.value ?? null;
}

export async function setConfig<T>(key: string, value: T): Promise<void> {
  const db = await getDB();
  await db.put('config', { key, value });
}

// Génération d'ID local unique
export function generateLocalId(): string {
  return `local_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// Export pour debug
export async function exportAllData(): Promise<Record<string, any[]>> {
  const db = await getDB();
  const stores = ['users', 'produits', 'vendeurs_actifs', 'receptions_pointeur', 'retours_produits', 'inventaires', 'inventaire_details', 'sessions_vente', 'sync_queue'] as const;
  
  const data: Record<string, any[]> = {};
  
  for (const store of stores) {
    data[store] = await db.getAll(store);
  }
  
  return data;
}

// Clear all data (pour reset)
export async function clearAllData(): Promise<void> {
  const db = await getDB();
  const stores = ['users', 'produits', 'vendeurs_actifs', 'receptions_pointeur', 'retours_produits', 'inventaires', 'inventaire_details', 'sessions_vente', 'sync_queue', 'config'] as const;
  
  for (const store of stores) {
    await db.clear(store);
  }
}
