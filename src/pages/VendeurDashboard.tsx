/**
 * EasyGest BP — Dashboard Vendeur (orchestrateur)
 *
 * Ce fichier ne fait plus que :
 *  1. Charger les données depuis IndexedDB
 *  2. Gérer la navigation par onglets
 *  3. Déléguer le rendu à des sous-screens modulaires
 *
 * Toute la logique d'inventaire (verrou, saisie, validation) vit dans
 * pages/Vendeur/InventaireScreen.tsx
 */

import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useSync } from '@/contexts/SyncContext';
import { Header } from '@/components/Header';
import { CategoryBadge } from '@/components/CategoryBadge';
import { DatabaseViewer } from '@/components/DatabaseViewer';
import { Button } from '@/components/ui/button';
import {
  ClipboardList,
  CreditCard,
  Package,
  Undo2,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import {
  getDB,
  generateLocalId,
  type Produit,
  type User as DBUser,
  type SessionVente,
  type ReceptionPointeur,
  type RetourProduit,
} from '@/lib/db';
import { autoSyncOnDashboard } from '@/lib/sync';
import { toast } from 'sonner';

// ── Sous-screens ──────────────────────────────────────────────────────────────
import { InventaireScreen } from './Vendeur/InventaireScreen';
import { ReceptionsScreen } from './Vendeur/ReceptionsScreen';
import { SessionScreen } from './Vendeur/SessionScreen';
import { RetoursScreen } from './Vendeur/RetoursScreen';

type TabType = 'inventaire' | 'receptions' | 'session' | 'retours';

const sanitizeReceptions = (receptions: ReceptionPointeur[]): ReceptionPointeur[] =>
  receptions.filter((r) => r && typeof r.quantite === 'number' && r.date_reception);

const sanitizeRetours = (retours: RetourProduit[]): RetourProduit[] =>
  retours.filter((r) => r && typeof r.quantite === 'number' && r.date_retour);

// ─────────────────────────────────────────────────────────────────────────────
export default function VendeurDashboard() {
  const { user, logout } = useAuth();
  const { syncCounter } = useSync();

  const [activeTab, setActiveTab] = useState<TabType>('inventaire');
  const [showDbViewer, setShowDbViewer] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const isLoadingRef = useRef(false);
  const mountedRef = useRef(true);

  // ── Données ───────────────────────────────────────────────────────────────
  const [produits, setProduits] = useState<Produit[]>([]);
  const [vendeurs, setVendeurs] = useState<DBUser[]>([]);
  const [receptions, setReceptions] = useState<ReceptionPointeur[]>([]);
  const [retours, setRetours] = useState<RetourProduit[]>([]);
  const [sessionActive, setSessionActive] = useState<SessionVente | null>(null);

  const [sessionForm, setSessionForm] = useState({
    fond_vente: 0,
    orange_money_initial: 0,
    mtn_money_initial: 0,
  });
  const [isSessionSubmitting, setIsSessionSubmitting] = useState(false);

  const categorie =
    user?.role === 'vendeur_boulangerie' ? 'boulangerie' : 'patisserie';

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // ── Chargement des données ─────────────────────────────────────────────────
  useEffect(() => {
    const loadData = async () => {
      if (isLoadingRef.current || !user) return;
      isLoadingRef.current = true;
      setIsLoading(true);
      setLoadError(null);

      try {
        if (syncCounter === 0) await autoSyncOnDashboard();
        const db = await getDB();
        if (!mountedRef.current) return;

        const allProduits = await db.getAll('produits');
        setProduits(
          allProduits.filter((p) => p?.actif && p.categorie === categorie && p.nom)
        );

        const allUsers = await db.getAll('users');
        setVendeurs(
          allUsers.filter(
            (u) => u?.role === `vendeur_${categorie}` && u.actif && u.id !== user?.id && u.name
          )
        );

        const allReceptions = await db.getAllFromIndex(
          'receptions_pointeur',
          'by-vendeur',
          user.id
        );
        const today = new Date().toISOString().split('T')[0];
        setReceptions(
          sanitizeReceptions(
            allReceptions.filter((r) => r?.date_reception?.startsWith(today))
          )
        );

        const allRetours = await db.getAllFromIndex(
          'retours_produits',
          'by-vendeur',
          user.id
        );
        setRetours(
          sanitizeRetours(
            allRetours.filter((r) => r?.date_retour?.startsWith(today))
          )
        );

        const allSessions = await db.getAllFromIndex(
          'sessions_vente',
          'by-vendeur',
          user.id
        );
        setSessionActive(allSessions.find((s) => s?.statut === 'ouverte') || null);
      } catch (error) {
        console.error('Erreur chargement:', error);
        setLoadError('Erreur lors du chargement des données');
        if (mountedRef.current) toast.error('Erreur lors du chargement');
      } finally {
        if (mountedRef.current) setIsLoading(false);
        isLoadingRef.current = false;
      }
    };

    loadData();
  }, [user?.id, categorie, syncCounter]);

  // ── Ouverture de session ───────────────────────────────────────────────────
  const handleOpenSession = async () => {
    if (!user) return;
    setIsSessionSubmitting(true);
    try {
      const db = await getDB();
      const now = new Date().toISOString();
      const session: SessionVente = {
        local_id: generateLocalId(),
        vendeur_id: user.id,
        categorie,
        fond_vente: sessionForm.fond_vente,
        orange_money_initial: sessionForm.orange_money_initial,
        mtn_money_initial: sessionForm.mtn_money_initial,
        statut: 'ouverte',
        date_ouverture: now,
        sync_status: 'pending',
        created_at: now,
        updated_at: now,
      };
      await db.add('sessions_vente', session);
      setSessionActive(session);
      toast.success('Session ouverte !');
    } catch (error) {
      console.error('Erreur session:', error);
      toast.error("Erreur lors de l'ouverture");
    } finally {
      setIsSessionSubmitting(false);
    }
  };

  // ── Onglets ────────────────────────────────────────────────────────────────
  const tabs = [
    { id: 'inventaire' as const, icon: ClipboardList, label: 'Inventaire' },
    { id: 'receptions' as const, icon: Package, label: 'Réceptions' },
    { id: 'session' as const, icon: CreditCard, label: 'Session' },
    { id: 'retours' as const, icon: Undo2, label: 'Retours' },
  ];

  // ── Erreur de chargement ───────────────────────────────────────────────────
  if (loadError) {
    return (
      <div className="min-h-screen bg-background">
        <Header
          title={`Vendeur ${categorie === 'boulangerie' ? 'Boulangerie' : 'Pâtisserie'}`}
          onViewDatabase={() => setShowDbViewer(true)}
        />
        <div className="flex items-center justify-center py-20 px-4">
          <div className="text-center space-y-4">
            <AlertCircle className="w-16 h-16 mx-auto text-destructive" />
            <h2 className="text-xl font-semibold">Erreur de chargement</h2>
            <p className="text-muted-foreground">{loadError}</p>
            <Button onClick={() => window.location.reload()} className="mt-4">
              Recharger
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // ── Rendu principal ────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-background">
      <Header
        title={`Vendeur ${categorie === 'boulangerie' ? 'Boulangerie' : 'Pâtisserie'}`}
        onViewDatabase={() => setShowDbViewer(true)}
      />

      {/* Bandeau catégorie + statut session */}
      <div className="px-4 py-2 bg-muted/30 border-b flex items-center justify-between">
        <CategoryBadge category={categorie} size="md" />
        {sessionActive && (
          <span className="flex items-center gap-1.5 text-sm text-success">
            <span className="w-2 h-2 rounded-full bg-success animate-pulse" />
            Session active
          </span>
        )}
      </div>

      {/* Navigation par onglets */}
      <div className="px-4 py-3 border-b bg-card sticky top-[73px] z-50 overflow-x-auto">
        <div className="flex gap-2 min-w-max">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`nav-icon flex-row px-4 py-2 ${
                activeTab === tab.id ? 'nav-icon-active' : ''
              }`}
            >
              <tab.icon className="w-5 h-5" />
              <span className="text-sm font-medium whitespace-nowrap">{tab.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Contenu */}
      <main className="p-4 pb-24 max-w-4xl mx-auto">
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : (
          <>
            {activeTab === 'inventaire' && (
              <InventaireScreen
                produits={produits}
                vendeurs={vendeurs}
                categorie={categorie}
              />
            )}

            {activeTab === 'receptions' && (
              <ReceptionsScreen receptions={receptions} produits={produits} />
            )}

            {activeTab === 'session' && (
              <SessionScreen
                sessionActive={sessionActive}
                sessionForm={sessionForm}
                onFormChange={setSessionForm}
                onOpenSession={handleOpenSession}
                isSubmitting={isSessionSubmitting}
              />
            )}

            {activeTab === 'retours' && (
              <RetoursScreen retours={retours} produits={produits} />
            )}
          </>
        )}
      </main>

      <DatabaseViewer isOpen={showDbViewer} onClose={() => setShowDbViewer(false)} />
    </div>
  );
}