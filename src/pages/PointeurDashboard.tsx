import React, { useState, useEffect, useCallback } from 'react';
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
  Trash2
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
export default function PointeurDashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { sync, status } = useSync();
  const [activeTab, setActiveTab] = useState<TabType>('reception');
  const [showDbViewer, setShowDbViewer] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
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
  const [isSubmitting, setIsSubmitting] = useState(false);
  // Fonction pour charger les données depuis IndexedDB
  const loadData = useCallback(async (showLoader = true) => {
    if (showLoader) {
      setIsLoading(true);
    } else {
      setIsRefreshing(true);
    }
    try {
      console.log('🔄 [PointeurDashboard] Chargement des données...');
      const db = await getDB();
      // Charger produits actifs
      const allProduits = await db.getAll('produits');
      setProduits(allProduits.filter(p => p.actif));
      // Charger utilisateurs
      const allUsers = await db.getAll('users');
      setProducteurs(allUsers.filter(u => u.role === 'producteur' && u.actif));
      setVendeurs(allUsers.filter(u =>
        (u.role === 'vendeur_boulangerie' || u.role === 'vendeur_patisserie') && u.actif
      ));
      // Charger vendeurs actifs
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
      // Charger mes réceptions et retours
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
  }, [user]);
  // Charger les données au montage avec sync initiale
  useEffect(() => {
    const initDashboard = async () => {
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
  // Écouter les événements de synchronisation globale
  useEffect(() => {
    const handleSyncComplete = async () => {
      console.log('✅ [PointeurDashboard] Synchronisation terminée, rechargement des données...');
      await loadData(false); // Recharger sans loader pour une transition douce
    };
    const handleSyncStart = () => {
      console.log('🔄 [PointeurDashboard] Synchronisation démarrée...');
      setIsRefreshing(true);
    };
    const handleSyncError = () => {
      console.log('❌ [PointeurDashboard] Erreur de synchronisation');
      setIsRefreshing(false);
    };
    // S'abonner aux événements
    window.addEventListener('global-sync-complete', handleSyncComplete);
    window.addEventListener('global-sync-start', handleSyncStart);
    window.addEventListener('global-sync-error', handleSyncError);
    // Nettoyage
    return () => {
      window.removeEventListener('global-sync-complete', handleSyncComplete);
      window.removeEventListener('global-sync-start', handleSyncStart);
      window.removeEventListener('global-sync-error', handleSyncError);
    };
  }, [loadData]);
  // Trouver le vendeur assigné pour un produit
  const getVendeurAssigne = (produitId: number | null) => {
    if (!produitId) return null;
    const produit = produits.find(p => p.id === produitId);
    if (!produit) return null;
    return produit.categorie === 'boulangerie' ? vendeurActif.boulangerie : vendeurActif.patisserie;
  };
  // Soumettre une réception
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
      // Rafraîchir la liste
      const allReceptions = await db.getAllFromIndex('receptions_pointeur', 'by-pointeur', user.id);
      setReceptions(allReceptions.sort((a, b) =>
        new Date(b.date_reception).getTime() - new Date(a.date_reception).getTime()
      ));
      // Reset formulaire
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
  // Soumettre un retour
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
      // Rafraîchir la liste
      const allRetours = await db.getAllFromIndex('retours_produits', 'by-pointeur', user.id);
      setRetours(allRetours.sort((a, b) =>
        new Date(b.date_retour).getTime() - new Date(a.date_retour).getTime()
      ));
      // Reset formulaire
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
  // Ouvrir le modal d'édition
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
  // Sauvegarder les modifications
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
        // Rafraîchir
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
        // Rafraîchir
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
  return (
    <div className="min-h-screen bg-background">
      <Header
        title="Tableau de bord Pointeur"
        onViewDatabase={() => setShowDbViewer(true)}
      />
      {/* Indicateur de rafraîchissement subtil */}
      {isRefreshing && (
        <div className="fixed top-20 right-4 z-50 animate-fade-in">
          <div className="bg-primary/10 border border-primary/20 rounded-lg px-3 py-2 flex items-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin text-primary" />
            <span className="text-sm text-primary font-medium">Mise à jour...</span>
          </div>
        </div>
      )}
      {/* Navigation tabs */}
      <div className="px-4 py-3 border-b bg-card/50 sticky top-[73px] z-40">
        <div className="flex gap-2 overflow-x-auto pb-1">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`nav-icon flex-row px-4 py-2 ${activeTab === tab.id ? 'nav-icon-active' : ''}`}
            >
              <tab.icon className="w-5 h-5" />
              <span className="text-sm font-medium whitespace-nowrap">{tab.label}</span>
            </button>
          ))}
        </div>
      </div>
      {/* Contenu principal */}
      <main className="p-4 pb-24 max-w-4xl mx-auto">
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : (
          <>
            {/* Tab Réception */}
            {activeTab === 'reception' && (
              <div className="space-y-6 animate-fade-in">
                <div className="card-premium p-6">
                  <h2 className="font-display text-xl font-semibold mb-6">
                    Nouvelle réception
                  </h2>
                  {/* Producteur */}
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
                  {/* Produit */}
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
                  {/* Quantité */}
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
                  {/* Notes */}
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
                  {/* Vendeur assigné */}
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
            {/* Tab Retour */}
            {activeTab === 'retour' && (
              <div className="space-y-6 animate-fade-in">
                <div className="card-premium p-6">
                  <h2 className="font-display text-xl font-semibold mb-6">
                    Enregistrer un retour
                  </h2>
                  {/* Produit */}
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
                  {/* Quantité */}
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
                  {/* Raison */}
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
                  {/* Description */}
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
                  {/* Vendeur assigné */}
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
            {/* Tab Mes Réceptions */}
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
                      return (
                        <div
                          key={rec.id || rec.local_id}
                          className="card-premium p-4 cursor-pointer hover:ring-2 hover:ring-primary/20 transition-all"
                          onClick={() => openEditModal('reception', rec)}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="font-medium truncate">
                                  {produit?.nom || `Produit #${rec.produit_id}`}
                                </span>
                                {produit && <CategoryBadge category={produit.categorie} />}
                              </div>
                              <div className="flex items-center gap-3 text-sm text-muted-foreground">
                                <span className="font-semibold text-foreground">{rec.quantite} unités</span>
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
            {/* Tab Mes Retours */}
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
                                <span className="font-medium truncate">
                                  {produit?.nom || `Produit #${ret.produit_id}`}
                                </span>
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
            {/* Quantité */}
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
      {/* Database Viewer Modal */}
      <DatabaseViewer isOpen={showDbViewer} onClose={() => setShowDbViewer(false)} />
    </div>
  );
}