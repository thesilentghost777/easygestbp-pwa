/**
 * PointeurDashboard.tsx — Refactorisé
 *
 * UI/UX ajouts :
 * - MorningCheckModal : affiché une seule fois à la connexion
 *   → demande si les retours d'hier ont été pointés
 *   → OUI : ferme   |   NON : re-pose la question / propose d'y aller
 *
 * Logique et données : inchangées.
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useSync } from '@/contexts/SyncContext';
import { Header } from '@/components/Header';
import { DatabaseViewer } from '@/components/DatabaseViewer';
import { Button } from '@/components/ui/button';
import {
  Package,
  Undo2,
  Check,
  AlertTriangle,
  Loader2,
  WifiOff,
  RotateCcw,
  List,
} from 'lucide-react';
import { getDB } from '@/lib/db';
import type {
  Produit,
  User as DBUser,
  ReceptionPointeur,
  RetourProduit,
} from '@/lib/db';
import { autoSyncOnDashboard } from '@/lib/sync';
import { toast } from 'sonner';

// ─── Screens ──────────────────────────────────────────────────────────────────
import ReceptionScreen from './Pointeur/ReceptionScreen';
import RetourScreen from './Pointeur/RetourScreen';
import RetourHierScreen from './Pointeur/RetourHierScreen';
import ListeReceptionsScreen from './Pointeur/ListeReceptionsScreen';
import ListeRetoursScreen from './Pointeur/ListeRetoursScreen';
import {
  VendeurSelectionModal,
  ChangeSellerModal,
  MorningCheckModal,
  type VendeurSelectionModalState,
  type ChangeSellerModalState,
  type MorningCheckModalState,
} from './Pointeur/PointeurModals';

// ─── Helpers ──────────────────────────────────────────────────────────────────

type TabType =
  | 'reception'
  | 'retour'
  | 'retour-hier'
  | 'mes-receptions'
  | 'mes-retours';

function isToday(dateStr: string | null | undefined): boolean {
  if (!dateStr) return false;
  return dateStr.slice(0, 10) === new Date().toISOString().slice(0, 10);
}

function deduplicateReceptions(
  items: ReceptionPointeur[]
): ReceptionPointeur[] {
  const byServerId = new Map<number, ReceptionPointeur>();
  const byLocalId = new Map<string, ReceptionPointeur>();
  const result: ReceptionPointeur[] = [];
  for (const item of items) {
    if (item.id != null && !byServerId.has(item.id))
      byServerId.set(item.id, item);
  }
  for (const item of items) {
    if (item.id != null) {
      if (byServerId.get(item.id) === item) result.push(item);
    } else if (item.local_id) {
      const hasSynced = Array.from(byServerId.values()).some(
        s => s.local_id === item.local_id
      );
      if (!hasSynced && !byLocalId.has(item.local_id)) {
        byLocalId.set(item.local_id, item);
        result.push(item);
      }
    }
  }
  return result;
}

function deduplicateRetours(items: RetourProduit[]): RetourProduit[] {
  const byServerId = new Map<number, RetourProduit>();
  const byLocalId = new Map<string, RetourProduit>();
  const result: RetourProduit[] = [];
  for (const item of items) {
    if (item.id != null && !byServerId.has(item.id))
      byServerId.set(item.id, item);
  }
  for (const item of items) {
    if (item.id != null) {
      if (byServerId.get(item.id) === item) result.push(item);
    } else if (item.local_id) {
      const hasSynced = Array.from(byServerId.values()).some(
        s => s.local_id === item.local_id
      );
      if (!hasSynced && !byLocalId.has(item.local_id)) {
        byLocalId.set(item.local_id, item);
        result.push(item);
      }
    }
  }
  return result;
}

// ─────────────────────────────────────────────────────────────────────────────

export default function PointeurDashboard() {
  const { user } = useAuth();
  const { sync } = useSync();

  const [activeTab, setActiveTab] = useState<TabType>('reception');
  const [showDbViewer, setShowDbViewer] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);

  // Données
  const [produits, setProduits] = useState<Produit[]>([]);
  const [producteurs, setProducteurs] = useState<DBUser[]>([]);
  const [vendeurs, setVendeurs] = useState<DBUser[]>([]);
  const [pointeurs, setPointeurs] = useState<DBUser[]>([]);
  const [vendeurActif, setVendeurActif] = useState<{
    boulangerie?: DBUser;
    patisserie?: DBUser;
  }>({});
  const [receptions, setReceptions] = useState<ReceptionPointeur[]>([]);
  const [retours, setRetours] = useState<RetourProduit[]>([]);
  const [allReceptions, setAllReceptions] = useState<ReceptionPointeur[]>([]);
  const [allRetours, setAllRetours] = useState<RetourProduit[]>([]);
  const [defaultHierVendeurId, setDefaultHierVendeurId] = useState<
    number | null
  >(null);

  // Modals
  const [vendeurSelectionModal, setVendeurSelectionModal] =
    useState<VendeurSelectionModalState>({ isOpen: false });
  const [changeSellerModal, setChangeSellerModal] =
    useState<ChangeSellerModalState>({ isOpen: false, category: null });
  const [isChangingSellerSubmitting, setIsChangingSellerSubmitting] =
    useState(false);

  // ── NOUVEAU : modal de vérification matinale ───────────────────────────────
  const [morningCheckModal, setMorningCheckModal] =
    useState<MorningCheckModalState>({ isOpen: false });
  /** Clé de session pour n'afficher le modal qu'une seule fois par login */
  const MORNING_CHECK_KEY = 'morning_check_done';
  const morningCheckShownRef = useRef(false);

  const loadDataRunningRef = useRef<Promise<void> | null>(null);
  const initializedRef = useRef(false);
  const vendeurSelectionShownRef = useRef(false);

  // Bandeau offline
  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // ── Chargement des données ────────────────────────────────────────────────
  const loadData = useCallback(
    async (showLoader = true) => {
      if (loadDataRunningRef.current) return loadDataRunningRef.current;

      const runner = (async () => {
        if (showLoader) setIsLoading(true);
        else setIsRefreshing(true);

        try {
          const db = await getDB();
          const allProduits = await db.getAll('produits');
          setProduits(allProduits.filter(p => p.actif));

          const allUsers = await db.getAll('users');
          setProducteurs(
            allUsers.filter(u => u.role === 'producteur' && u.actif)
          );
          const vendeursRaw = allUsers.filter(
            u =>
              (u.role === 'vendeur_boulangerie' ||
                u.role === 'vendeur_patisserie') &&
              u.actif
          );
          setVendeurs(vendeursRaw);
          setPointeurs(
            allUsers.filter(u => u.role === 'pointeur' && u.actif)
          );

          const vendeursActifs = await db.getAll('vendeurs_actifs');
          const vaBoula = vendeursActifs.find(
            v => v.categorie === 'boulangerie'
          );
          const vaPat = vendeursActifs.find(
            v => v.categorie === 'patisserie'
          );

          const newVendeurActif: {
            boulangerie?: DBUser;
            patisserie?: DBUser;
          } = {};
          if (vaBoula?.vendeur_id) {
            const vb = allUsers.find(u => u.id === vaBoula.vendeur_id);
            if (vb) newVendeurActif.boulangerie = vb;
          }
          if (vaPat?.vendeur_id) {
            const vp = allUsers.find(u => u.id === vaPat.vendeur_id);
            if (vp) newVendeurActif.patisserie = vp;
          }
          setVendeurActif(newVendeurActif);

          // Modal sélection vendeur si aucun défini
          if (
            !vendeurSelectionShownRef.current &&
            !newVendeurActif.boulangerie &&
            !newVendeurActif.patisserie &&
            vendeursRaw.length > 0
          ) {
            vendeurSelectionShownRef.current = true;
            setVendeurSelectionModal({ isOpen: true });
          }

          if (user) {
            const myReceptions = await db.getAllFromIndex(
              'receptions_pointeur',
              'by-pointeur',
              user.id
            );
            const todayRec = deduplicateReceptions(
              myReceptions.filter(r => isToday(r.date_reception))
            );
            setReceptions(todayRec);

            const myRetours = await db.getAllFromIndex(
              'retours_produits',
              'by-pointeur',
              user.id
            );
            const todayRet = deduplicateRetours(
              myRetours.filter(r => isToday(r.date_retour))
            );
            setRetours(todayRet);

            const allRec = await db.getAll('receptions_pointeur');
            setAllReceptions(deduplicateReceptions(allRec));

            const allRet = await db.getAll('retours_produits');
            setAllRetours(deduplicateRetours(allRet));

            const hier = (() => {
              const d = new Date();
              d.setDate(d.getDate() - 1);
              return d.toISOString().slice(0, 10);
            })();
            const hierRec = myReceptions.filter(
              r => r.date_reception?.slice(0, 10) === hier
            );
            if (hierRec.length > 0 && hierRec[0].vendeur_assigne_id) {
              setDefaultHierVendeurId(hierRec[0].vendeur_assigne_id);
            } else {
              setDefaultHierVendeurId(
                newVendeurActif.boulangerie?.id ?? null
              );
            }

            // ── Afficher le morning check une seule fois par session ──
            if (
              !morningCheckShownRef.current &&
              !sessionStorage.getItem(MORNING_CHECK_KEY)
            ) {
              morningCheckShownRef.current = true;
              // Petit délai pour laisser le dashboard s'afficher d'abord
              setTimeout(() => {
                setMorningCheckModal({ isOpen: true });
              }, 600);
            }
          }
        } catch (error) {
          console.error('❌ [PointeurDashboard] Erreur chargement:', error);
          toast.error('Erreur lors du chargement des données');
        } finally {
          if (showLoader) setIsLoading(false);
          else setIsRefreshing(false);
        }
      })();

      loadDataRunningRef.current = runner;
      try {
        await runner;
      } finally {
        loadDataRunningRef.current = null;
      }
    },
    [user]
  );

  // Init
  useEffect(() => {
    const init = async () => {
      if (initializedRef.current) return;
      initializedRef.current = true;
      try {
        await autoSyncOnDashboard();
        await loadData(true);
      } catch (error) {
        console.error('❌ Init error:', error);
        setIsLoading(false);
      }
    };
    init();
  }, [loadData]);

  // Écouter sync
  useEffect(() => {
    let running = false;
    const handleSyncComplete = async () => {
      if (running) return;
      running = true;
      try {
        await new Promise(r => setTimeout(r, 350));
        await loadData(false);
      } finally {
        running = false;
      }
    };
    window.addEventListener('global-sync-complete', handleSyncComplete);
    window.addEventListener('global-sync-start', () => setIsRefreshing(true));
    window.addEventListener('global-sync-error', () =>
      setIsRefreshing(false)
    );
    return () => {
      window.removeEventListener('global-sync-complete', handleSyncComplete);
    };
  }, [loadData]);

  // ── Handlers morning check ────────────────────────────────────────────────
  const handleMorningCheckOui = () => {
    sessionStorage.setItem(MORNING_CHECK_KEY, '1');
    setMorningCheckModal({ isOpen: false });
  };

  const handleMorningCheckGoToRetours = () => {
    sessionStorage.setItem(MORNING_CHECK_KEY, '1');
    setMorningCheckModal({ isOpen: false });
    setActiveTab('retour-hier');
  };

  // ── Sélection vendeur actif au login ─────────────────────────────────────
  const handleVendeurSelection = async (
    boulangerie_id: number | null,
    patisserie_id: number | null
  ) => {
    try {
      const db = await getDB();
      const now = new Date().toISOString();
      const existing = await db.getAll('vendeurs_actifs');

      if (boulangerie_id) {
        let rec = existing.find(v => v.categorie === 'boulangerie');
        if (rec) {
          rec.vendeur_id = boulangerie_id;
          rec.sync_status = 'pending';
          rec.updated_at = now;
          await db.put('vendeurs_actifs', rec);
        } else {
          await db.add('vendeurs_actifs', {
            id: 1,
            categorie: 'boulangerie',
            vendeur_id: boulangerie_id,
            sync_status: 'pending',
            created_at: now,
            updated_at: now,
          });
        }
      }

      if (patisserie_id) {
        let rec = existing.find(v => v.categorie === 'patisserie');
        if (rec) {
          rec.vendeur_id = patisserie_id;
          rec.sync_status = 'pending';
          rec.updated_at = now;
          await db.put('vendeurs_actifs', rec);
        } else {
          await db.add('vendeurs_actifs', {
            id: 2,
            categorie: 'patisserie',
            vendeur_id: patisserie_id,
            sync_status: 'pending',
            created_at: now,
            updated_at: now,
          });
        }
      }

      setVendeurSelectionModal({ isOpen: false });
      toast.success("Vendeurs actifs définis pour aujourd'hui");
      await loadData(false);
    } catch (error) {
      console.error('Erreur sélection vendeur:', error);
      toast.error('Erreur lors de la définition des vendeurs actifs');
    }
  };

  // ── Changement vendeur actif ──────────────────────────────────────────────
  const updateActiveSeller = useCallback(
    async (
      category: 'boulangerie' | 'patisserie',
      newVendeurId: number
    ) => {
      const db = await getDB();
      const tx = db.transaction('vendeurs_actifs', 'readwrite');
      const store = tx.objectStore('vendeurs_actifs');
      const existing = await store.getAll();
      let record = existing.find(v => v.categorie === category);
      const now = new Date().toISOString();
      if (record) {
        record.vendeur_id = newVendeurId;
        record.sync_status = 'pending';
        record.updated_at = now;
        await store.put(record);
      } else {
        const id = category === 'boulangerie' ? 1 : 2;
        await store.add({
          id,
          categorie: category,
          vendeur_id: newVendeurId,
          sync_status: 'pending',
          created_at: now,
          updated_at: now,
        });
      }
      await tx.done;
      toast.success('Vendeur actif mis à jour');
    },
    []
  );

  const handleChangeSellerSave = async (
    category: 'boulangerie' | 'patisserie',
    vendeurId: number
  ) => {
    setIsChangingSellerSubmitting(true);
    try {
      await updateActiveSeller(category, vendeurId);
      await loadData(false);
      setChangeSellerModal({ isOpen: false, category: null });
    } catch {
      toast.error('Erreur lors de la mise à jour du vendeur');
    } finally {
      setIsChangingSellerSubmitting(false);
    }
  };

  // ── Tabs ──────────────────────────────────────────────────────────────────
  const tabs = [
    { id: 'reception' as const, icon: Package, label: 'Réception' },
    { id: 'retour' as const, icon: Undo2, label: 'Retour' },
    {
      id: 'retour-hier' as const,
      icon: RotateCcw,
      label: "Retours d'hier",
      badge: 'HIER',
    },
    { id: 'mes-receptions' as const, icon: Check, label: 'Réceptions' },
    { id: 'mes-retours' as const, icon: List, label: 'Retours' },
  ];

  // ─── Rendu ──────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-background">
      <Header
        title="Tableau de bord Pointeur"
        onViewDatabase={() => setShowDbViewer(true)}
      />

      {isOffline && (
        <div className="sticky top-[73px] z-40 bg-warning/90 text-warning-foreground flex items-center justify-center gap-2 px-4 h-10">
          <WifiOff className="w-4 h-4" />
          <span className="text-sm font-medium">Mode hors ligne</span>
        </div>
      )}

      {/* Navigation */}
      <nav className="sticky top-[73px] z-50 bg-background/95 backdrop-blur-md border-b border-border">
        <div className="px-4 py-2 max-w-4xl mx-auto">
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-thin scrollbar-thumb-muted-foreground/30">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`
                  flex items-center gap-2
                  px-4 py-1.5 rounded-lg
                  text-sm font-medium whitespace-nowrap
                  transition-all duration-200
                  ${
                    activeTab === tab.id
                      ? tab.id === 'retour'
                        ? 'bg-red-600 text-white shadow-sm'
                        : 'bg-primary text-primary-foreground shadow-sm'
                      : tab.id === 'retour'
                      ? 'text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20 hover:text-red-700'
                      : 'text-muted-foreground hover:bg-muted/70 hover:text-foreground'
                  }
                `}
              >
                <tab.icon className="w-4 h-4" />
                <span>{tab.label}</span>
                {tab.badge && (
                  <span className="ml-1 px-1.5 py-0.5 rounded-full bg-orange-500 text-white text-[10px] font-bold leading-none">
                    {tab.badge}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      </nav>

      <main className="p-4 pb-24 max-w-4xl mx-auto">
        {isRefreshing && (
          <div className="flex items-center justify-end mb-3">
            <div className="bg-primary/10 border border-primary/20 rounded-lg px-3 py-2 flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin text-primary" />
              <span className="text-sm text-primary font-medium">
                Mise à jour...
              </span>
            </div>
          </div>
        )}

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : (
          <>
            {activeTab === 'reception' && user && (
              <ReceptionScreen
                user={user}
                produits={produits}
                producteurs={producteurs}
                vendeurs={vendeurs}
                vendeurActif={vendeurActif}
                onVendeurChange={cat =>
                  setChangeSellerModal({ isOpen: true, category: cat })
                }
                onRecorded={() => loadData(false)}
              />
            )}

            {activeTab === 'retour' && user && (
              <RetourScreen
                user={user}
                produits={produits}
                vendeurs={vendeurs}
                vendeurActif={vendeurActif}
                onVendeurChange={cat =>
                  setChangeSellerModal({ isOpen: true, category: cat })
                }
                onRecorded={() => loadData(false)}
              />
            )}

            {activeTab === 'retour-hier' && user && (
              <RetourHierScreen
                user={user}
                produits={produits}
                vendeurs={vendeurs}
                defaultVendeurId={defaultHierVendeurId}
                onRecorded={() => loadData(false)}
              />
            )}

            {activeTab === 'mes-receptions' && user && (
              <ListeReceptionsScreen
                currentUser={user}
                receptions={allReceptions}
                produits={produits}
                vendeurs={vendeurs}
                pointeurs={pointeurs}
                onRefresh={() => loadData(false)}
              />
            )}

            {activeTab === 'mes-retours' && user && (
              <ListeRetoursScreen
                currentUser={user}
                retours={allRetours}
                produits={produits}
                vendeurs={vendeurs}
                pointeurs={pointeurs}
                onRefresh={() => loadData(false)}
              />
            )}
          </>
        )}
      </main>

      {/* ── Modal sélection vendeur actif (login) ── */}
      <VendeurSelectionModal
        state={vendeurSelectionModal}
        vendeurs={vendeurs}
        onConfirm={handleVendeurSelection}
        currentVendeurActif={vendeurActif}
      />

      {/* ── Modal changement vendeur actif ── */}
      <ChangeSellerModal
        state={changeSellerModal}
        vendeurs={vendeurs}
        currentVendeurActif={vendeurActif}
        isSubmitting={isChangingSellerSubmitting}
        onSave={handleChangeSellerSave}
        onClose={() => setChangeSellerModal({ isOpen: false, category: null })}
      />

      {/* ── Modal vérification matinale ── */}
      {user && (
        <MorningCheckModal
          state={morningCheckModal}
          userName={user.name}
          onConfirm={handleMorningCheckOui}
          onGoToRetours={handleMorningCheckGoToRetours}
        />
      )}

      <DatabaseViewer
        isOpen={showDbViewer}
        onClose={() => setShowDbViewer(false)}
      />
    </div>
  );
}