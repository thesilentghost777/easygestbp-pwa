import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useSync } from '@/contexts/SyncContext';
import { Header } from '@/components/Header';
import { NumericInput } from '@/components/NumericInput';
import { SearchableSelect } from '@/components/SearchableSelect';
import { SyncBadge } from '@/components/SyncBadge';
import { CategoryBadge } from '@/components/CategoryBadge';
import { EmptyState } from '@/components/EmptyState';
import { DatabaseViewer } from '@/components/DatabaseViewer';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Package,
  Undo2,
  Check,
  ChevronRight,
  Clock,
  User,
  Loader2,
  AlertTriangle,
  Edit2,
  X,
  Trash2,
  WifiOff
} from 'lucide-react';
import { getDB, generateLocalId, type Produit, type User as DBUser, type ReceptionPointeur, type RetourProduit } from '@/lib/db';
import { autoSyncOnDashboard } from '@/lib/sync';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
type TabType = 'reception' | 'retour' | 'mes-receptions' | 'mes-retours';
interface EditModalState {
  isOpen: boolean;
  type: 'reception' | 'retour' | null;
  item: ReceptionPointeur | RetourProduit | null;
}
interface ChangeSellerModalState {
  isOpen: boolean;
  category: 'boulangerie' | 'patisserie' | null;
}
export default function PointeurDashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { sync, status } = useSync();
  const [activeTab, setActiveTab] = useState<TabType>('reception');
  const [showDbViewer, setShowDbViewer] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  // Données
  const [produits, setProduits] = useState<Produit[]>([]);
  const [producteurs, setProducteurs] = useState<DBUser[]>([]);
  const [vendeurs, setVendeurs] = useState<DBUser[]>([]);
  const [vendeurActif, setVendeurActif] = useState<{ boulangerie?: DBUser; patisserie?: DBUser }>({});
  const [receptions, setReceptions] = useState<ReceptionPointeur[]>([]);
  const [retours, setRetours] = useState<RetourProduit[]>([]);
  // Formulaire réception
  const [receptionForm, setReceptionForm] = useState({
    producteur_id: 1,
    produit_id: null as number | null,
    quantite: 0,
    notes: '',
  });
  // Formulaire retour
  const [retourForm, setRetourForm] = useState({
    produit_id: null as number | null,
    quantite: 0,
    raison: 'perime' as 'perime' | 'abime' | 'autre',
    description: '',
  });
  // Modal d'édition
  const [editModal, setEditModal] = useState<EditModalState>({
    isOpen: false,
    type: null,
    item: null,
  });
  const [editForm, setEditForm] = useState({
    quantite: 0,
    notes: '',
    raison: 'perime' as 'perime' | 'abime' | 'autre',
    description: '',
  });
  // Modal changement vendeur
  const [changeSellerModal, setChangeSellerModal] = useState<ChangeSellerModalState>({
    isOpen: false,
    category: null,
  });
  const [selectedNewSeller, setSelectedNewSeller] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  // contrôle visuel du bandeau offline (séparé de isOffline)
  const [showOfflineBannerVisible, setShowOfflineBannerVisible] = useState(false);
  const offlineDismissTimerRef = useRef<number | null>(null);
  const hasTouchedRef = useRef(false);
  // protège loadData de double exécution
  const loadDataRunningRef = useRef<Promise<void> | null>(null);
  const initializedRef = useRef(false);
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
  // Synchroniser visibilité du bandeau quand isOffline change
  useEffect(() => {
    if (isOffline) {
      setShowOfflineBannerVisible(true);
      hasTouchedRef.current = false; // prêt à capter la première interaction
    } else {
      // quand on redevient online, masquer immédiatement le bandeau
      setShowOfflineBannerVisible(false);
      if (offlineDismissTimerRef.current) {
        window.clearTimeout(offlineDismissTimerRef.current);
        offlineDismissTimerRef.current = null;
      }
    }
  }, [isOffline]);
  // Sur la première interaction utilisateur (touch/click) lancer un timer de 10s qui ferme le bandeau
  useEffect(() => {
    if (!isOffline) return;
    const onFirstInteraction = () => {
      if (hasTouchedRef.current) return;
      hasTouchedRef.current = true;
      if (offlineDismissTimerRef.current) window.clearTimeout(offlineDismissTimerRef.current);
      offlineDismissTimerRef.current = window.setTimeout(() => {
        setShowOfflineBannerVisible(false);
        offlineDismissTimerRef.current = null;
      }, 10000); // 10s
    };
    window.addEventListener('touchstart', onFirstInteraction, { passive: true });
    window.addEventListener('click', onFirstInteraction);
    return () => {
      window.removeEventListener('touchstart', onFirstInteraction);
      window.removeEventListener('click', onFirstInteraction);
      if (offlineDismissTimerRef.current) {
        window.clearTimeout(offlineDismissTimerRef.current);
        offlineDismissTimerRef.current = null;
      }
    };
  }, [isOffline]);
  // Fonction pour charger les données depuis IndexedDB
  const loadData = useCallback(async (showLoader = true) => {
    // si une exécution est en cours, retourne la même promesse (évite double exécution)
    if (loadDataRunningRef.current) {
      return loadDataRunningRef.current;
    }
    const runner = (async () => {
      if (showLoader) {
        setIsLoading(true);
      } else {
        setIsRefreshing(true);
      }
      try {
        console.log('🔄 [PointeurDashboard] Chargement des données...');
        const db = await getDB();
        const allProduits = await db.getAll('produits');
        setProduits(allProduits.filter(p => p.actif));
        const allUsers = await db.getAll('users');
        setProducteurs(allUsers.filter(u => u.role === 'producteur' && u.actif));
        setVendeurs(allUsers.filter(u =>
          (u.role === 'vendeur_boulangerie' || u.role === 'vendeur_patisserie') && u.actif
        ));
        const vendeursActifs = await db.getAll('vendeurs_actifs');
        const vendeurBoulangerie = vendeursActifs.find(v => v.categorie === 'boulangerie');
        const vendeurPatisserie = vendeursActifs.find(v => v.categorie === 'patisserie');
        const newVendeurActif: { boulangerie?: DBUser; patisserie?: DBUser } = {};
        if (vendeurBoulangerie?.vendeur_id) {
          const vb = allUsers.find(u => u.id === vendeurBoulangerie.vendeur_id);
          if (vb) newVendeurActif.boulangerie = vb;
        }
        if (vendeurPatisserie?.vendeur_id) {
          const vp = allUsers.find(u => u.id === vendeurPatisserie.vendeur_id);
          if (vp) newVendeurActif.patisserie = vp;
        }
        setVendeurActif(newVendeurActif);
        if (user) {
          const allReceptions = await db.getAllFromIndex('receptions_pointeur', 'by-pointeur', user.id);
          setReceptions(allReceptions.sort((a, b) =>
            new Date(b.date_reception).getTime() - new Date(a.date_reception).getTime()
          ));
          const allRetours = await db.getAllFromIndex('retours_produits', 'by-pointeur', user.id);
          setRetours(allRetours.sort((a, b) =>
            new Date(b.date_retour).getTime() - new Date(a.date_retour).getTime()
          ));
        }
        console.log('✅ [PointeurDashboard] Données chargées avec succès');
      } catch (error) {
        console.error('❌ [PointeurDashboard] Erreur chargement données:', error);
        toast.error('Erreur lors du chargement des données');
      } finally {
        if (showLoader) {
          setIsLoading(false);
        } else {
          setIsRefreshing(false);
        }
      }
    })();
    loadDataRunningRef.current = runner;
    try {
      await runner;
    } finally {
      loadDataRunningRef.current = null;
    }
  }, [user]);
  useEffect(() => {
    const initDashboard = async () => {
      if (initializedRef.current) return;
      initializedRef.current = true;
      setIsLoading(true);
      try {
        console.log('🚀 [PointeurDashboard] Initialisation du dashboard...');
        await autoSyncOnDashboard();
        await loadData(true);
      } catch (error) {
        console.error('❌ [PointeurDashboard] Erreur initialisation:', error);
        setIsLoading(false);
      }
    };
    initDashboard();
  }, [loadData]);
  useEffect(() => {
    const handleSyncComplete = async () => {
      console.log('✅ [PointeurDashboard] Synchronisation terminée, rechargement des données...');
      await loadData(false);
    };
    const handleSyncStart = () => {
      console.log('🔄 [PointeurDashboard] Synchronisation démarrée...');
      setIsRefreshing(true);
    };
    const handleSyncError = () => {
      console.log('❌ [PointeurDashboard] Erreur de synchronisation');
      setIsRefreshing(false);
    };
    window.addEventListener('global-sync-complete', handleSyncComplete);
    window.addEventListener('global-sync-start', handleSyncStart);
    window.addEventListener('global-sync-error', handleSyncError);
    return () => {
      window.removeEventListener('global-sync-complete', handleSyncComplete);
      window.removeEventListener('global-sync-start', handleSyncStart);
      window.removeEventListener('global-sync-error', handleSyncError);
    };
  }, [loadData]);
  useEffect(() => {
    if (changeSellerModal.isOpen && changeSellerModal.category) {
      setSelectedNewSeller(vendeurActif[changeSellerModal.category]?.id || null);
    }
  }, [changeSellerModal.isOpen, changeSellerModal.category, vendeurActif]);
  const getVendeurAssigne = (produitId: number | null) => {
    if (!produitId) return null;
    const produit = produits.find(p => p.id === produitId);
    if (!produit) return null;
    return produit.categorie === 'boulangerie' ? vendeurActif.boulangerie : vendeurActif.patisserie;
  };
  const updateActiveSeller = useCallback(async (category: 'boulangerie' | 'patisserie', newVendeurId: number) => {
    try {
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
        record = {
          id,
          categorie: category,
          vendeur_id: newVendeurId,
          sync_status: 'pending',
          created_at: now,
          updated_at: now,
        };
        await store.add(record);
      }
      await tx.done;
      toast.success('Vendeur actif mis à jour localement');
    } catch (error) {
      console.error('Erreur mise à jour vendeur actif:', error);
      toast.error('Erreur lors de la mise à jour du vendeur');
    }
  }, []);
  const handleSubmitReception = async () => {
    if (!receptionForm.produit_id || receptionForm.quantite <= 0 || !user) {
      toast.error('Veuillez remplir tous les champs obligatoires');
      return;
    }
    const vendeurAssigne = getVendeurAssigne(receptionForm.produit_id);
    if (!vendeurAssigne) {
      toast.error('Aucun vendeur actif pour cette catégorie');
      return;
    }
    setIsSubmitting(true);
    try {
      const db = await getDB();
      const now = new Date().toISOString();
      const reception: ReceptionPointeur = {
        local_id: generateLocalId(),
        pointeur_id: user.id,
        producteur_id: receptionForm.producteur_id,
        produit_id: receptionForm.produit_id,
        quantite: receptionForm.quantite,
        vendeur_assigne_id: vendeurAssigne.id,
        verrou: false,
        date_reception: now,
        notes: receptionForm.notes || undefined,
        sync_status: 'pending',
        created_at: now,
        updated_at: now,
      };
      await db.add('receptions_pointeur', reception);
      const allReceptions = await db.getAllFromIndex('receptions_pointeur', 'by-pointeur', user.id);
      setReceptions(allReceptions.sort((a, b) =>
        new Date(b.date_reception).getTime() - new Date(a.date_reception).getTime()
      ));
      setReceptionForm({
        producteur_id: 1,
        produit_id: null,
        quantite: 0,
        notes: '',
      });
      toast.success('Réception enregistrée !', {
        description: `${receptionForm.quantite} unité(s) assignées à ${vendeurAssigne.name}`,
      });
    } catch (error) {
      console.error('Erreur réception:', error);
      toast.error('Erreur lors de l\'enregistrement');
    } finally {
      setIsSubmitting(false);
    }
  };
  const handleSubmitRetour = async () => {
    if (!retourForm.produit_id || retourForm.quantite <= 0 || !user) {
      toast.error('Veuillez remplir tous les champs obligatoires');
      return;
    }
    const vendeurAssigne = getVendeurAssigne(retourForm.produit_id);
    if (!vendeurAssigne) {
      toast.error('Aucun vendeur actif pour cette catégorie');
      return;
    }
    setIsSubmitting(true);
    try {
      const db = await getDB();
      const now = new Date().toISOString();
      const retour: RetourProduit = {
        local_id: generateLocalId(),
        pointeur_id: user.id,
        vendeur_id: vendeurAssigne.id,
        produit_id: retourForm.produit_id,
        quantite: retourForm.quantite,
        raison: retourForm.raison,
        description: retourForm.description || undefined,
        verrou: false,
        date_retour: now,
        sync_status: 'pending',
        created_at: now,
        updated_at: now,
      };
      await db.add('retours_produits', retour);
      const allRetours = await db.getAllFromIndex('retours_produits', 'by-pointeur', user.id);
      setRetours(allRetours.sort((a, b) =>
        new Date(b.date_retour).getTime() - new Date(a.date_retour).getTime()
      ));
      setRetourForm({
        produit_id: null,
        quantite: 0,
        raison: 'perime',
        description: '',
      });
      toast.success('Retour enregistré !', {
        description: `${retourForm.quantite} unité(s) retournées par ${vendeurAssigne.name}`,
      });
    } catch (error) {
      console.error('Erreur retour:', error);
      toast.error('Erreur lors de l\'enregistrement');
    } finally {
      setIsSubmitting(false);
    }
  };
  const openEditModal = (type: 'reception' | 'retour', item: ReceptionPointeur | RetourProduit) => {
    if (item.verrou) {
      toast.error('Cet enregistrement est verrouillé par le PDG');
      return;
    }
    setEditModal({ isOpen: true, type, item });
    if (type === 'reception') {
      const rec = item as ReceptionPointeur;
      setEditForm({
        quantite: rec.quantite,
        notes: rec.notes || '',
        raison: 'perime',
        description: '',
      });
    } else {
      const ret = item as RetourProduit;
      setEditForm({
        quantite: ret.quantite,
        notes: '',
        raison: ret.raison,
        description: ret.description || '',
      });
    }
  };
  const handleSaveEdit = async () => {
    if (!editModal.item || !user) return;
    setIsSubmitting(true);
    try {
      const db = await getDB();
      const now = new Date().toISOString();
      if (editModal.type === 'reception') {
        const rec = editModal.item as ReceptionPointeur;
        const updated: ReceptionPointeur = {
          ...rec,
          quantite: editForm.quantite,
          notes: editForm.notes || undefined,
          sync_status: 'pending',
          updated_at: now,
        };
        await db.put('receptions_pointeur', updated);
        const allReceptions = await db.getAllFromIndex('receptions_pointeur', 'by-pointeur', user.id);
        setReceptions(allReceptions.sort((a, b) =>
          new Date(b.date_reception).getTime() - new Date(a.date_reception).getTime()
        ));
      } else {
        const ret = editModal.item as RetourProduit;
        const updated: RetourProduit = {
          ...ret,
          quantite: editForm.quantite,
          raison: editForm.raison,
          description: editForm.description || undefined,
          sync_status: 'pending',
          updated_at: now,
        };
        await db.put('retours_produits', updated);
        const allRetours = await db.getAllFromIndex('retours_produits', 'by-pointeur', user.id);
        setRetours(allRetours.sort((a, b) =>
          new Date(b.date_retour).getTime() - new Date(a.date_retour).getTime()
        ));
      }
      setEditModal({ isOpen: false, type: null, item: null });
      toast.success('Modification enregistrée !');
    } catch (error) {
      console.error('Erreur modification:', error);
      toast.error('Erreur lors de la modification');
    } finally {
      setIsSubmitting(false);
    }
  };
  const handleSaveChangeSeller = async () => {
    if (!changeSellerModal.category || !selectedNewSeller) return;
    setIsSubmitting(true);
    try {
      await updateActiveSeller(changeSellerModal.category, selectedNewSeller);
      await loadData(false);
      setChangeSellerModal({ isOpen: false, category: null });
      setSelectedNewSeller(null);
    } catch (error) {
      toast.error('Erreur lors de la mise à jour');
    } finally {
      setIsSubmitting(false);
    }
  };
  const selectedProduitReception = produits.find(p => p.id === receptionForm.produit_id);
  const vendeurAssigneReception = getVendeurAssigne(receptionForm.produit_id);
  const selectedProduitRetour = produits.find(p => p.id === retourForm.produit_id);
  const vendeurAssigneRetour = getVendeurAssigne(retourForm.produit_id);
  const raisonLabels = {
    perime: '🕐 Périmé',
    abime: '💔 Abîmé',
    autre: '📝 Autre',
  };
  const tabs = [
    { id: 'reception' as const, icon: Package, label: 'Réception' },
    { id: 'retour' as const, icon: Undo2, label: 'Retour' },
    { id: 'mes-receptions' as const, icon: Check, label: 'Mes Réceptions' },
    { id: 'mes-retours' as const, icon: AlertTriangle, label: 'Mes Retours' },
  ];
  const headerHeight = 73;
  const offlineBannerHeight = 48;
  const navHeight = 56;
 
  // La navigation doit TOUJOURS être visible, donc on calcule son top dynamiquement
  const navTop = (isOffline && showOfflineBannerVisible) ? headerHeight + offlineBannerHeight : headerHeight;
  // réduire l'espace vertical entre nav et contenu de 3/4 (donc garder 25%)
  const contentPaddingTop = navTop + Math.round((navHeight + 8) * 0.25);
 
  return (
    <div className="min-h-screen bg-background">
      {/* Header fixe en haut */}
      <Header
        title="Tableau de bord Pointeur"
        onViewDatabase={() => setShowDbViewer(true)}
      />
      {/* Indicateur de rafraîchissement */}
      {isRefreshing && (
        <div
          className="fixed right-4 z-40 animate-fade-in"
          style={{ top: `${headerHeight + 8}px` }}
        >
          <div className="bg-primary/10 border border-primary/20 rounded-lg px-3 py-2 flex items-center gap-2 shadow-sm">
            <Loader2 className="w-4 h-4 animate-spin text-primary" />
            <span className="text-sm text-primary font-medium">Mise à jour...</span>
          </div>
        </div>
      )}
      
      <nav
  className="fixed left-0 right-0 bg-background/95 backdrop-blur-md border-b border-border transition-all duration-300"
  style={{
    top: `${navTop}px`,
    zIndex: 150,
  }}
>
  <div className="px-4 py-2 max-w-4xl mx-auto"> {/* ← réduit : py-3 → py-2 */}
    <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-thin scrollbar-thumb-muted-foreground/30">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => setActiveTab(tab.id)}
          className={`
            flex items-center gap-2
            px-5 py-1.5 rounded-lg {/* ← un peu plus compact que py-2 */}
            text-sm font-medium
            whitespace-nowrap
            transition-all duration-200
            ${activeTab === tab.id
              ? 'bg-primary text-primary-foreground shadow-sm'
              : 'text-muted-foreground hover:bg-muted/70 hover:text-foreground'
            }
          `}
        >
          <tab.icon className="w-5 h-5" />
          <span>{tab.label}</span>
        </button>
      ))}
    </div>
  </div>
</nav>
{/* Contenu principal */}
<main
  className="pb-24 px-4 max-w-4xl mx-auto transition-all duration-300"
  style={{
    paddingTop: `${contentPaddingTop}px`,
  }}
>
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : (
          <>
            {activeTab === 'reception' && (
              <div className="space-y-6 animate-fade-in">
                <div className="card-premium p-6">
                  <h2 className="font-display text-xl font-semibold mb-6">
                    Nouvelle réception
                  </h2>
                  <div className="space-y-2 mb-4">
                    <Label>Producteur</Label>
                    <SearchableSelect
                      options={[
                        { value: 1, label: 'Producteur par défaut', description: 'Utilisé si non spécifié' },
                        ...producteurs.map(p => ({
                          value: p.id,
                          label: p.name,
                          description: p.numero_telephone,
                        }))
                      ]}
                      value={receptionForm.producteur_id}
                      onChange={(v) => setReceptionForm({ ...receptionForm, producteur_id: v as number })}
                      placeholder="Sélectionner un producteur"
                    />
                  </div>
                  <div className="space-y-2 mb-4">
                    <Label>Produit *</Label>
                    <SearchableSelect
                      options={produits.map(p => ({
                        value: p.id,
                        label: p.nom,
                        description: `${p.prix} XAF - ${p.categorie}`,
                      }))}
                      value={receptionForm.produit_id}
                      onChange={(v) => setReceptionForm({ ...receptionForm, produit_id: v as number })}
                      placeholder="Rechercher un produit..."
                    />
                  </div>
                  <div className="space-y-2 mb-4">
                    <Label>Quantité *</Label>
                    <NumericInput
                      value={receptionForm.quantite}
                      onChange={(v) => setReceptionForm({ ...receptionForm, quantite: v })}
                      min={0}
                      max={9999}
                      size="lg"
                    />
                  </div>
                  <div className="space-y-2 mb-6">
                    <Label>Notes (optionnel)</Label>
                    <Textarea
                      value={receptionForm.notes}
                      onChange={(e) => setReceptionForm({ ...receptionForm, notes: e.target.value })}
                      placeholder="Ajouter une note..."
                      className="resize-none"
                      rows={2}
                    />
                  </div>
                  {vendeurAssigneReception && selectedProduitReception && (
                    <div className="p-4 rounded-lg bg-success/10 border border-success/30 mb-6 animate-scale-in">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-success/20 flex items-center justify-center">
                          <User className="w-5 h-5 text-success" />
                        </div>
                        <div>
                          <p className="text-sm text-success font-medium">Vendeur assigné automatiquement</p>
                          <p className="font-semibold">{vendeurAssigneReception.name}</p>
                        </div>
                        <CategoryBadge category={selectedProduitReception.categorie} size="md" />
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setChangeSellerModal({ isOpen: true, category: selectedProduitReception.categorie })}
                        >
                          Changer
                        </Button>
                      </div>
                    </div>
                  )}
                  <Button
                    onClick={handleSubmitReception}
                    disabled={isSubmitting || !receptionForm.produit_id || receptionForm.quantite <= 0}
                    className="btn-golden w-full"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        <span>Enregistrement...</span>
                      </>
                    ) : (
                      <>
                        <Check className="w-5 h-5" />
                        <span>Enregistrer la réception</span>
                      </>
                    )}
                  </Button>
                </div>
              </div>
            )}
            {activeTab === 'retour' && (
              <div className="space-y-6 animate-fade-in">
                <div className="card-premium p-6">
                  <h2 className="font-display text-xl font-semibold mb-6">
                    Enregistrer un retour
                  </h2>
                  <div className="space-y-2 mb-4">
                    <Label>Produit *</Label>
                    <SearchableSelect
                      options={produits.map(p => ({
                        value: p.id,
                        label: p.nom,
                        description: `${p.prix} XAF - ${p.categorie}`,
                      }))}
                      value={retourForm.produit_id}
                      onChange={(v) => setRetourForm({ ...retourForm, produit_id: v as number })}
                      placeholder="Rechercher un produit..."
                    />
                  </div>
                  <div className="space-y-2 mb-4">
                    <Label>Quantité *</Label>
                    <NumericInput
                      value={retourForm.quantite}
                      onChange={(v) => setRetourForm({ ...retourForm, quantite: v })}
                      min={0}
                      max={9999}
                      size="lg"
                    />
                  </div>
                  <div className="space-y-2 mb-4">
                    <Label>Raison du retour *</Label>
                    <div className="grid grid-cols-3 gap-2">
                      {(['perime', 'abime', 'autre'] as const).map((raison) => (
                        <button
                          key={raison}
                          type="button"
                          onClick={() => setRetourForm({ ...retourForm, raison })}
                          className={`p-3 rounded-lg border-2 text-center transition-all ${
                            retourForm.raison === raison
                              ? 'border-primary bg-primary/5'
                              : 'border-border hover:border-primary/50'
                          }`}
                        >
                          <span className="text-sm font-medium">{raisonLabels[raison]}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-2 mb-6">
                    <Label>Description (optionnel)</Label>
                    <Textarea
                      value={retourForm.description}
                      onChange={(e) => setRetourForm({ ...retourForm, description: e.target.value })}
                      placeholder="Détails supplémentaires..."
                      className="resize-none"
                      rows={2}
                    />
                  </div>
                  {vendeurAssigneRetour && selectedProduitRetour && (
                    <div className="p-4 rounded-lg bg-success/10 border border-success/30 mb-6 animate-scale-in">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-success/20 flex items-center justify-center">
                          <User className="w-5 h-5 text-success" />
                        </div>
                        <div>
                          <p className="text-sm text-success font-medium">Vendeur assigné automatiquement</p>
                          <p className="font-semibold">{vendeurAssigneRetour.name}</p>
                        </div>
                        <CategoryBadge category={selectedProduitRetour.categorie} size="md" />
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setChangeSellerModal({ isOpen: true, category: selectedProduitRetour.categorie })}
                        >
                          Changer
                        </Button>
                      </div>
                    </div>
                  )}
                  <Button
                    onClick={handleSubmitRetour}
                    disabled={isSubmitting || !retourForm.produit_id || retourForm.quantite <= 0}
                    className="btn-golden w-full"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        <span>Enregistrement...</span>
                      </>
                    ) : (
                      <>
                        <Undo2 className="w-5 h-5" />
                        <span>Enregistrer le retour</span>
                      </>
                    )}
                  </Button>
                </div>
              </div>
            )}
            {activeTab === 'mes-receptions' && (
              <div className="space-y-4 animate-fade-in">
                <div className="flex items-center justify-between">
                  <h2 className="font-display text-xl font-semibold">
                    Mes Réceptions
                  </h2>
                  <span className="text-sm text-muted-foreground">
                    {receptions.length} réception(s)
                  </span>
                </div>
                {receptions.length === 0 ? (
                  <EmptyState
                    icon="inbox"
                    title="Aucune réception"
                    description="Vos réceptions apparaîtront ici"
                  />
                ) : (
                  <div className="space-y-3">
                    {receptions.map((rec) => {
                      const produit = produits.find(p => p.id === rec.produit_id);
                      const vendeur = vendeurs.find(v => v.id === rec.vendeur_assigne_id);
                      return (
                        <div
                          key={rec.id || rec.local_id}
                          className="card-premium p-4 cursor-pointer hover:ring-2 hover:ring-primary/20 transition-all"
                          onClick={() => openEditModal('reception', rec)}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <div className="flex items-center gap-2">
                                  <span className="font-medium truncate">
                                    {produit?.nom || `Produit #${rec.produit_id}`}
                                  </span>
                                  {produit?.prix != null && (
                                    <span className="text-sm text-muted-foreground ml-2">{produit.prix} XAF</span>
                                  )}
                                  {produit && <CategoryBadge category={produit.categorie} />}
                                </div>
                              </div>
                              <div className="flex items-center gap-3 text-sm text-muted-foreground">
                                <span className="font-semibold text-foreground">{rec.quantite} unités</span>
                                <span className="flex items-center gap-1">
                                  <User className="w-3 h-3" />
                                  {vendeur?.name || 'Inconnu'}
                                </span>
                                <span className="flex items-center gap-1">
                                  <Clock className="w-3 h-3" />
                                  {format(new Date(rec.date_reception), 'HH:mm', { locale: fr })}
                                </span>
                              </div>
                              {rec.notes && (
                                <p className="text-sm text-muted-foreground mt-1 truncate">{rec.notes}</p>
                              )}
                            </div>
                            <div className="flex flex-col items-end gap-1">
                              <SyncBadge status={rec.sync_status} />
                              {rec.verrou ? (
                                <span className="text-xs text-muted-foreground">🔒 Verrouillé</span>
                              ) : (
                                <Edit2 className="w-4 h-4 text-muted-foreground" />
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
            {activeTab === 'mes-retours' && (
              <div className="space-y-4 animate-fade-in">
                <div className="flex items-center justify-between">
                  <h2 className="font-display text-xl font-semibold">
                    Mes Retours
                  </h2>
                  <span className="text-sm text-muted-foreground">
                    {retours.length} retour(s)
                  </span>
                </div>
                {retours.length === 0 ? (
                  <EmptyState
                    icon="inbox"
                    title="Aucun retour"
                    description="Vos retours apparaîtront ici"
                  />
                ) : (
                  <div className="space-y-3">
                    {retours.map((ret) => {
                      const produit = produits.find(p => p.id === ret.produit_id);
                      const vendeur = vendeurs.find(v => v.id === ret.vendeur_id);
                      return (
                        <div
                          key={ret.id || ret.local_id}
                          className="card-premium p-4 cursor-pointer hover:ring-2 hover:ring-primary/20 transition-all"
                          onClick={() => openEditModal('retour', ret)}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <div className="flex items-center gap-2">
                                  <span className="font-medium truncate">
                                    {produit?.nom || `Produit #${ret.produit_id}`}
                                  </span>
                                  {produit?.prix != null && (
                                    <span className="text-sm text-muted-foreground ml-2">{produit.prix} XAF</span>
                                  )}
                                  {produit && <CategoryBadge category={produit.categorie} />}
                                </div>
                                <span className="text-xs px-2 py-0.5 rounded-full bg-warning/10 text-warning">
                                  {raisonLabels[ret.raison]}
                                </span>
                              </div>
                              <div className="flex items-center gap-3 text-sm text-muted-foreground">
                                <span className="font-semibold text-foreground">{ret.quantite} unités</span>
                                <span className="flex items-center gap-1">
                                  <User className="w-3 h-3" />
                                  {vendeur?.name || 'Vendeur inconnu'}
                                </span>
                                <span className="flex items-center gap-1">
                                  <Clock className="w-3 h-3" />
                                  {format(new Date(ret.date_retour), 'HH:mm', { locale: fr })}
                                </span>
                              </div>
                              {ret.description && (
                                <p className="text-sm text-muted-foreground mt-1 truncate">{ret.description}</p>
                              )}
                            </div>
                            <div className="flex flex-col items-end gap-1">
                              <SyncBadge status={ret.sync_status} />
                              {ret.verrou ? (
                                <span className="text-xs text-muted-foreground">🔒 Verrouillé</span>
                              ) : (
                                <Edit2 className="w-4 h-4 text-muted-foreground" />
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </main>
      {/* Modal d'édition */}
      <Dialog open={editModal.isOpen} onOpenChange={(open) => !open && setEditModal({ isOpen: false, type: null, item: null })}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editModal.type === 'reception' ? 'Modifier la réception' : 'Modifier le retour'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Quantité</Label>
              <NumericInput
                value={editForm.quantite}
                onChange={(v) => setEditForm({ ...editForm, quantite: v })}
                min={0}
                max={9999}
                size="lg"
              />
            </div>
            {editModal.type === 'reception' ? (
              <div className="space-y-2">
                <Label>Notes</Label>
                <Textarea
                  value={editForm.notes}
                  onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                  placeholder="Ajouter une note..."
                  className="resize-none"
                  rows={2}
                />
              </div>
            ) : (
              <>
                <div className="space-y-2">
                  <Label>Raison</Label>
                  <div className="grid grid-cols-3 gap-2">
                    {(['perime', 'abime', 'autre'] as const).map((raison) => (
                      <button
                        key={raison}
                        type="button"
                        onClick={() => setEditForm({ ...editForm, raison })}
                        className={`p-2 rounded-lg border-2 text-center transition-all text-sm ${
                          editForm.raison === raison
                            ? 'border-primary bg-primary/5'
                            : 'border-border hover:border-primary/50'
                        }`}
                      >
                        {raisonLabels[raison]}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Description</Label>
                  <Textarea
                    value={editForm.description}
                    onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                    placeholder="Détails supplémentaires..."
                    className="resize-none"
                    rows={2}
                  />
                </div>
              </>
            )}
          </div>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setEditModal({ isOpen: false, type: null, item: null })}
            >
              Annuler
            </Button>
            <Button
              onClick={handleSaveEdit}
              disabled={isSubmitting || editForm.quantite <= 0}
              className="btn-golden"
            >
              {isSubmitting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                'Enregistrer'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* Modal changement vendeur */}
      <Dialog open={changeSellerModal.isOpen} onOpenChange={(open) => !open && setChangeSellerModal({ isOpen: false, category: null })}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              Changer le vendeur actif pour {changeSellerModal.category}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Nouveau vendeur</Label>
              <SearchableSelect
                options={vendeurs
                  .filter(u => u.role === `vendeur_${changeSellerModal.category}`)
                  .map(u => ({
                    value: u.id,
                    label: u.name,
                    description: u.numero_telephone,
                  }))
                }
                value={selectedNewSeller}
                onChange={(v) => setSelectedNewSeller(v as number)}
                placeholder="Sélectionner un vendeur..."
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setChangeSellerModal({ isOpen: false, category: null })}
            >
              Annuler
            </Button>
            <Button
              onClick={handleSaveChangeSeller}
              disabled={isSubmitting || !selectedNewSeller || selectedNewSeller === (vendeurActif[changeSellerModal.category]?.id || null)}
              className="btn-golden"
            >
              {isSubmitting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                'Enregistrer'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* Database Viewer Modal */}
      <DatabaseViewer isOpen={showDbViewer} onClose={() => setShowDbViewer(false)} />
    </div>
  );
}