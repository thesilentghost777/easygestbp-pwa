import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useSync } from '@/contexts/SyncContext';
import { Header } from '@/components/Header';
import { CategoryBadge } from '@/components/CategoryBadge';
import { EmptyState } from '@/components/EmptyState';
import { DatabaseViewer } from '@/components/DatabaseViewer';
import { NumericInput } from '@/components/NumericInput';
import { SearchableSelect } from '@/components/SearchableSelect';
import { PINInput } from '@/components/PINInput';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  ClipboardList,
  CreditCard,
  Package,
  Undo2,
  TrendingUp,
  Loader2,
  Check,
  Clock,
  DollarSign,
  Smartphone,
  ArrowRightLeft,
  UserCheck,
  Zap,
  Copy,
  Search,
  Plus,
  Minus,
  Hash
} from 'lucide-react';
import { getDB, generateLocalId, type Produit, type User as DBUser, type SessionVente, type ReceptionPointeur, type RetourProduit, type Inventaire, type InventaireDetail } from '@/lib/db';
import { autoSyncOnDashboard } from '@/lib/sync';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import bcrypt from 'bcryptjs';

type TabType = 'receptions' | 'inventaire' | 'session' | 'retours' | 'flux';

type QuickFillMode = 'none' | 'same' | 'sequence' | 'pattern';

export default function VendeurDashboard() {
  const { user, login, logout } = useAuth();
  const { sync, status, syncCounter } = useSync();
  const [activeTab, setActiveTab] = useState<TabType>('receptions');
  const [showDbViewer, setShowDbViewer] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  
  // État du splash screen
  const [showSplash, setShowSplash] = useState(false);
  const [splashVendeurName, setSplashVendeurName] = useState('');
  
  // Données
  const [produits, setProduits] = useState<Produit[]>([]);
  const [vendeurs, setVendeurs] = useState<DBUser[]>([]);
  const [receptions, setReceptions] = useState<ReceptionPointeur[]>([]);
  const [retours, setRetours] = useState<RetourProduit[]>([]);
  const [sessionActive, setSessionActive] = useState<SessionVente | null>(null);
  
  // Formulaire session
  const [sessionForm, setSessionForm] = useState({
    fond_vente: 0,
    orange_money_initial: 0,
    mtn_money_initial: 0,
  });
  
  // Formulaire inventaire amélioré
  const [inventaireForm, setInventaireForm] = useState({
    vendeur_entrant_id: null as number | null,
    produits: {} as Record<number, number>,
    pin_sortant: '',
    pin_entrant: '',
    step: 1,
  });
  
  // États pour remplissage rapide
  const [quickFillValue, setQuickFillValue] = useState<number>(0);
  const [searchTerm, setSearchTerm] = useState('');
  const [showQuickFillPanel, setShowQuickFillPanel] = useState(false);
  const [sequenceStart, setSequenceStart] = useState(0);
  const [sequenceStep, setSequenceStep] = useState(1);
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const categorie = user?.role === 'vendeur_boulangerie' ? 'boulangerie' : 'patisserie';

  // Charger les données
  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      try {
        if (syncCounter === 0) {
          await autoSyncOnDashboard();
        }
        const db = await getDB();
        const allProduits = await db.getAll('produits');
        const filtered = allProduits.filter(p => p.actif && p.categorie === categorie);
        console.log('after filtre', filtered.map(p => ({ id: p.id, nom: p.nom })));
        setProduits(allProduits.filter(p => p.actif && p.categorie === categorie));
        const allUsers = await db.getAll('users');
        const vendeurRole = `vendeur_${categorie}`;
        setVendeurs(allUsers.filter(u => u.role === vendeurRole && u.actif && u.id !== user?.id));
        if (user) {
          const allReceptions = await db.getAllFromIndex('receptions_pointeur', 'by-vendeur', user.id);
          const today = new Date().toISOString().split('T')[0];
          setReceptions(allReceptions.filter(r => r.date_reception.startsWith(today)));
        }
        if (user) {
          const allRetours = await db.getAllFromIndex('retours_produits', 'by-vendeur', user.id);
          const today = new Date().toISOString().split('T')[0];
          setRetours(allRetours.filter(r => r.date_retour.startsWith(today)));
        }
        if (user) {
          const allSessions = await db.getAllFromIndex('sessions_vente', 'by-vendeur', user.id);
          const active = allSessions.find(s => s.statut === 'ouverte');
          setSessionActive(active || null);
        }
      } catch (error) {
        console.error('Erreur chargement:', error);
        toast.error('Erreur lors du chargement');
      } finally {
        setIsLoading(false);
      }
    };
    loadData();
  }, [user, categorie, syncCounter]);

  // Utiliser useMemo pour mémoriser les produits filtrés et éviter les re-rendus
  const filteredProduits = useMemo(() => {
    if (!searchTerm.trim()) return produits;
    const term = searchTerm.toLowerCase().trim();
    return produits.filter(p => 
      p.nom.toLowerCase().includes(term)
    );
  }, [produits, searchTerm]);

  // Fonctions de remplissage rapide
  const applyQuickFillSame = () => {
    const newProduits = { ...inventaireForm.produits };
    filteredProduits.forEach(p => {
      newProduits[p.id] = quickFillValue;
    });
    setInventaireForm({ ...inventaireForm, produits: newProduits });
    toast.success(`${filteredProduits.length} produits mis à ${quickFillValue}`);
  };

  const applyQuickFillSequence = () => {
    const newProduits = { ...inventaireForm.produits };
    filteredProduits.forEach((p, index) => {
      newProduits[p.id] = sequenceStart + (index * sequenceStep);
    });
    setInventaireForm({ ...inventaireForm, produits: newProduits });
    toast.success(`Séquence appliquée à ${filteredProduits.length} produits`);
  };

  const copyFromReceptions = () => {
    const newProduits = { ...inventaireForm.produits };
    filteredProduits.forEach(p => {
      const recu = receptions
        .filter(r => r.produit_id === p.id)
        .reduce((sum, r) => sum + r.quantite, 0);
      if (recu > 0) {
        newProduits[p.id] = recu;
      }
    });
    setInventaireForm({ ...inventaireForm, produits: newProduits });
    toast.success('Quantités copiées depuis les réceptions');
  };

  const incrementAll = (amount: number) => {
    const newProduits = { ...inventaireForm.produits };
    filteredProduits.forEach(p => {
      const current = newProduits[p.id] || 0;
      newProduits[p.id] = Math.max(0, current + amount);
    });
    setInventaireForm({ ...inventaireForm, produits: newProduits });
  };

  const resetFiltered = () => {
    const newProduits = { ...inventaireForm.produits };
    filteredProduits.forEach(p => {
      newProduits[p.id] = 0;
    });
    setInventaireForm({ ...inventaireForm, produits: newProduits });
    toast.success(`${filteredProduits.length} produits réinitialisés`);
  };

  // Ouvrir une session
  const handleOpenSession = async () => {
    if (!user) return;
    setIsSubmitting(true);
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
      toast.success('Session ouverte !', {
        description: `Fond de vente: ${sessionForm.fond_vente} XAF`,
      });
    } catch (error) {
      console.error('Erreur session:', error);
      toast.error('Erreur lors de l\'ouverture');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Valider et créer l'inventaire
  const handleValidateInventaire = async () => {
    if (!user || !inventaireForm.vendeur_entrant_id) return;
    setIsSubmitting(true);
    try {
      const db = await getDB();
      const now = new Date().toISOString();
      
      // Récupérer les utilisateurs
      const sortantUser = await db.get('users', user.id);
      if (!sortantUser) {
        throw new Error('Utilisateur sortant non trouvé');
      }
      const isSortantValid = bcrypt.compareSync(inventaireForm.pin_sortant, sortantUser.code_pin);
      if (!isSortantValid) {
        throw new Error('PIN sortant incorrect');
      }
      
      const entrantUser = await db.get('users', inventaireForm.vendeur_entrant_id);
      if (!entrantUser) {
        throw new Error('Utilisateur entrant non trouvé');
      }
      const isEntrantValid = bcrypt.compareSync(inventaireForm.pin_entrant, entrantUser.code_pin);
      if (!isEntrantValid) {
        throw new Error('PIN entrant incorrect');
      }
      
      const local_id = generateLocalId();
      const inventaire: Inventaire = {
        local_id,
        vendeur_sortant_id: user.id,
        vendeur_entrant_id: inventaireForm.vendeur_entrant_id,
        categorie,
        valide_sortant: true,
        valide_entrant: true,
        date_inventaire: now,
        sync_status: 'pending',
        created_at: now,
        updated_at: now,
      };
      await db.add('inventaires', inventaire);
      
      // Ajouter les détails
      for (const [produit_id_str, quantite_restante] of Object.entries(inventaireForm.produits)) {
        const produit_id = parseInt(produit_id_str);
        const detail: InventaireDetail = {
          inventaire_local_id: local_id,
          produit_id,
          quantite_restante,
          sync_status: 'pending',
          created_at: now,
          updated_at: now,
        };
        await db.add('inventaire_details', detail);
      }
      
      toast.success('Inventaire créé avec succès !');
      
      // Afficher le splash screen avec le nom du vendeur entrant
      setSplashVendeurName(entrantUser.name);
      setShowSplash(true);
      
      // Attendre 4 secondes
      await new Promise(resolve => setTimeout(resolve, 4000));
      
      // Masquer le splash
      setShowSplash(false);
      
      // Déconnexion du sortant
      await logout();
      
      // Connexion automatique de l'entrant
      const entrantPhone = entrantUser.numero_telephone;
      const loginResult = await login(entrantPhone, inventaireForm.pin_entrant);
      if (!loginResult.success) {
        window.location.href = '/login';
      } else {
        // Reset form
        setInventaireForm({
          vendeur_entrant_id: null,
          produits: {},
          pin_sortant: '',
          pin_entrant: '',
          step: 1,
        });
        setSearchTerm('');
        setShowQuickFillPanel(false);
      }
    } catch (error: any) {
      console.error('Erreur inventaire:', error);
      toast.error(error.message || 'Erreur lors de la validation de l\'inventaire');
    } finally {
      setIsSubmitting(false);
    }
  };

  const tabs = [
    { id: 'receptions' as const, icon: Package, label: 'Réceptions' },
    { id: 'inventaire' as const, icon: ClipboardList, label: 'Inventaire' },
    { id: 'session' as const, icon: CreditCard, label: 'Session' },
    { id: 'retours' as const, icon: Undo2, label: 'Retours' },
    { id: 'flux' as const, icon: TrendingUp, label: 'Mon Flux' },
  ];

  const totalReceptions = receptions.reduce((sum, r) => sum + r.quantite, 0);
  const totalRetours = retours.reduce((sum, r) => sum + r.quantite, 0);
  const totalInventaire = Object.values(inventaireForm.produits).reduce((a, b) => a + b, 0);
  const produitsRemplis = Object.values(inventaireForm.produits).filter(v => v > 0).length;

  // Splash Screen pour changement de vendeur
  if (showSplash) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-gradient-to-br from-primary/20 via-background to-primary/10">
        <div className="text-center space-y-6 animate-fade-in p-8">
          <div className="w-24 h-24 mx-auto rounded-full bg-primary/10 flex items-center justify-center shadow-golden animate-pulse">
            <UserCheck className="w-12 h-12 text-primary" />
          </div>
          <div className="space-y-2">
            <h2 className="font-display text-2xl font-bold">Changement de vendeur</h2>
            <p className="text-lg text-muted-foreground">
              Le vendeur actif sera désormais
            </p>
            <p className="text-xl font-bold text-primary">
              {splashVendeurName}
            </p>
          </div>
          <Loader2 className="w-8 h-8 mx-auto animate-spin text-primary" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header
        title={`Vendeur ${categorie === 'boulangerie' ? 'Boulangerie' : 'Pâtisserie'}`}
        onViewDatabase={() => setShowDbViewer(true)}
      />
      
      <div className="px-4 py-2 bg-muted/30 border-b flex items-center justify-between">
        <CategoryBadge category={categorie} size="md" />
        {sessionActive && (
          <span className="flex items-center gap-1.5 text-sm text-success">
            <span className="w-2 h-2 rounded-full bg-success animate-pulse" />
            Session active
          </span>
        )}
      </div>

      <div className="px-4 py-3 border-b bg-card sticky top-[73px] z-50 overflow-x-auto">
        <div className="flex gap-2 min-w-max">
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

      <main className="p-4 pb-24 max-w-4xl mx-auto">
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : (
          <>
            {activeTab === 'receptions' && (
              <div className="space-y-4 animate-fade-in">
                <div className="flex items-center justify-between">
                  <h2 className="font-display text-xl font-semibold">
                    Produits reçus aujourd'hui
                  </h2>
                  <span className="px-3 py-1 rounded-full bg-primary/10 text-primary font-medium">
                    {totalReceptions} unités
                  </span>
                </div>
                {receptions.length === 0 ? (
                  <EmptyState
                    icon="inbox"
                    title="Aucune réception"
                    description="Les produits qui vous sont assignés apparaîtront ici"
                  />
                ) : (
                  <div className="space-y-3">
                    {receptions.map((rec) => {
                      const produit = produits.find(p => p.id === rec.produit_id);
                      return (
                        <div key={rec.id || rec.local_id} className="card-premium p-4">
                          <div className="flex items-center justify-between">
                            <div className="flex-1">
                              <p className="font-medium">{produit?.nom || `Produit #${rec.produit_id}`}</p>
                              <div className="flex items-center gap-3 text-sm mt-1">
                                <span className="flex items-center gap-1 text-muted-foreground">
                                  <Clock className="w-3 h-3" />
                                  {format(new Date(rec.date_reception), 'HH:mm', { locale: fr })}
                                </span>
                                {produit && (
                                  <span className="text-primary font-medium">
                                    {produit.prix.toLocaleString()} XAF
                                  </span>
                                )}
                              </div>
                            </div>
                            <span className="text-2xl font-bold text-primary">{rec.quantite}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'inventaire' && (
              <div className="space-y-6 animate-fade-in">
                <div className="card-premium p-6">
                  <h2 className="font-display text-xl font-semibold mb-2">
                    Créer un inventaire
                  </h2>
                  <p className="text-sm text-muted-foreground mb-6">
                    Passation de service avec le vendeur suivant
                  </p>

                  {inventaireForm.step === 1 && (
                    <div className="space-y-6">
                      <div className="space-y-2">
                        <Label>Vendeur entrant</Label>
                        <SearchableSelect
                          options={vendeurs.map(v => ({
                            value: v.id,
                            label: v.name,
                            description: v.numero_telephone,
                          }))}
                          value={inventaireForm.vendeur_entrant_id}
                          onChange={(v) => setInventaireForm({ ...inventaireForm, vendeur_entrant_id: v as number })}
                          placeholder="Sélectionner le vendeur entrant"
                        />
                      </div>

                      {/* Statistiques et outils rapides */}
                      <div className="grid grid-cols-2 gap-3">
                        <div className="p-3 rounded-lg bg-primary/5 border border-primary/20">
                          <div className="text-xs text-muted-foreground mb-1">Produits remplis</div>
                          <div className="text-2xl font-bold text-primary">{produitsRemplis}/{produits.length}</div>
                        </div>
                        <div className="p-3 rounded-lg bg-primary/5 border border-primary/20">
                          <div className="text-xs text-muted-foreground mb-1">Total unités</div>
                          <div className="text-2xl font-bold text-primary">{totalInventaire}</div>
                        </div>
                      </div>

                      {/* Panneau d'outils rapides */}
                      <div className="border rounded-lg overflow-hidden">
                        <button
                          onClick={() => setShowQuickFillPanel(!showQuickFillPanel)}
                          className="w-full flex items-center justify-between p-4 bg-gradient-to-r from-primary/10 to-primary/5 hover:from-primary/15 hover:to-primary/10 transition-colors"
                        >
                          <div className="flex items-center gap-2">
                            <Zap className="w-5 h-5 text-primary" />
                            <span className="font-medium">Outils de remplissage rapide</span>
                          </div>
                          <span className="text-xs px-2 py-1 rounded-full bg-primary/20 text-primary">
                            {showQuickFillPanel ? 'Masquer' : 'Afficher'}
                          </span>
                        </button>

                        {showQuickFillPanel && (
                          <div className="p-4 space-y-4 bg-muted/30">
                            {/* Copier depuis réceptions */}
                            <div className="space-y-2">
                              <button
                                onClick={copyFromReceptions}
                                className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-success/10 hover:bg-success/20 text-success font-medium transition-colors"
                              >
                                <Copy className="w-4 h-4" />
                                Copier depuis mes réceptions du jour
                              </button>
                              <p className="text-xs text-center text-muted-foreground">
                                Remplir automatiquement avec les quantités reçues aujourd'hui
                              </p>
                            </div>

                            <div className="h-px bg-border" />

                            {/* Même valeur pour tous */}
                            <div className="space-y-3">
                              <Label className="text-sm font-medium flex items-center gap-2">
                                <Hash className="w-4 h-4" />
                                Appliquer la même valeur
                              </Label>
                              <div className="flex gap-2">
                                <Input
                                  type="number"
                                  inputMode="numeric"
                                  value={quickFillValue || ''}
                                  onChange={(e) => setQuickFillValue(parseInt(e.target.value) || 0)}
                                  placeholder="Valeur"
                                  className="flex-1"
                                />
                                <Button
                                  onClick={applyQuickFillSame}
                                  variant="outline"
                                  className="whitespace-nowrap"
                                >
                                  Appliquer
                                </Button>
                              </div>
                            </div>

                            <div className="h-px bg-border" />

                            {/* Séquence */}
                            <div className="space-y-3">
                              <Label className="text-sm font-medium">Remplissage en séquence</Label>
                              <div className="grid grid-cols-2 gap-2">
                                <div>
                                  <Label className="text-xs text-muted-foreground">Départ</Label>
                                  <Input
                                    type="number"
                                    inputMode="numeric"
                                    value={sequenceStart || ''}
                                    onChange={(e) => setSequenceStart(parseInt(e.target.value) || 0)}
                                    placeholder="0"
                                  />
                                </div>
                                <div>
                                  <Label className="text-xs text-muted-foreground">Pas</Label>
                                  <Input
                                    type="number"
                                    inputMode="numeric"
                                    value={sequenceStep || ''}
                                    onChange={(e) => setSequenceStep(parseInt(e.target.value) || 1)}
                                    placeholder="1"
                                  />
                                </div>
                              </div>
                              <Button
                                onClick={applyQuickFillSequence}
                                variant="outline"
                                className="w-full"
                              >
                                Appliquer séquence
                              </Button>
                              <p className="text-xs text-muted-foreground">
                                Ex: Départ=5, Pas=2 → 5, 7, 9, 11...
                              </p>
                            </div>

                            <div className="h-px bg-border" />

                            {/* Actions groupées */}
                            <div className="space-y-2">
                              <Label className="text-sm font-medium">Actions groupées</Label>
                              <div className="grid grid-cols-3 gap-2">
                                <Button
                                  onClick={() => incrementAll(1)}
                                  variant="outline"
                                  size="sm"
                                  className="flex items-center gap-1"
                                >
                                  <Plus className="w-3 h-3" />
                                  +1
                                </Button>
                                <Button
                                  onClick={() => incrementAll(5)}
                                  variant="outline"
                                  size="sm"
                                  className="flex items-center gap-1"
                                >
                                  <Plus className="w-3 h-3" />
                                  +5
                                </Button>
                                <Button
                                  onClick={() => incrementAll(10)}
                                  variant="outline"
                                  size="sm"
                                  className="flex items-center gap-1"
                                >
                                  <Plus className="w-3 h-3" />
                                  +10
                                </Button>
                              </div>
                              <div className="grid grid-cols-3 gap-2">
                                <Button
                                  onClick={() => incrementAll(-1)}
                                  variant="outline"
                                  size="sm"
                                  className="flex items-center gap-1"
                                >
                                  <Minus className="w-3 h-3" />
                                  -1
                                </Button>
                                <Button
                                  onClick={() => incrementAll(-5)}
                                  variant="outline"
                                  size="sm"
                                  className="flex items-center gap-1"
                                >
                                  <Minus className="w-3 h-3" />
                                  -5
                                </Button>
                                <Button
                                  onClick={() => incrementAll(-10)}
                                  variant="outline"
                                  size="sm"
                                  className="flex items-center gap-1"
                                >
                                  <Minus className="w-3 h-3" />
                                  -10
                                </Button>
                              </div>
                              <Button
                                onClick={resetFiltered}
                                variant="outline"
                                size="sm"
                                className="w-full text-destructive hover:text-destructive"
                              >
                                Réinitialiser (filtrés)
                              </Button>
                              <p className="text-xs text-muted-foreground">
                                Les actions s'appliquent aux produits filtrés
                              </p>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Recherche */}
                      <div className="space-y-2">
                        <Label className="flex items-center gap-2">
                          <Search className="w-4 h-4" />
                          Rechercher un produit
                        </Label>
                        <Input
                          type="text"
                          value={searchTerm}
                          onChange={(e) => setSearchTerm(e.target.value)}
                          placeholder="Nom du produit..."
                          className="input-golden"
                        />
                        {searchTerm && (
                          <p className="text-sm text-muted-foreground">
                            {filteredProduits.length} produit(s) trouvé(s)
                          </p>
                        )}
                      </div>

                      {/* Liste des produits */}
                      <div className="border-t pt-4">
                        <Label className="mb-4 block">Quantités restantes par produit</Label>
                        <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2">
                          {filteredProduits.length === 0 ? (
                            <div className="text-center py-8 text-muted-foreground">
                              <Search className="w-8 h-8 mx-auto mb-2 opacity-50" />
                              <p>Aucun produit trouvé</p>
                            </div>
                          ) : (
                            filteredProduits.map((produit) => (
                              <div key={produit.id} className="flex items-center justify-between gap-3 p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors">
                                <div className="flex-1 min-w-0">
                                  <span className="font-medium truncate block">{produit.nom}</span>
                                  <div className="flex items-center gap-2 flex-wrap mt-1">
                                    <span className="text-xs font-medium text-primary">
                                      {produit.prix.toLocaleString()} XAF
                                    </span>
                                    {inventaireForm.produits[produit.id] > 0 && (
                                      <span className="text-xs text-success">
                                        ✓ Rempli
                                      </span>
                                    )}
                                  </div>
                                </div>
                                <NumericInput
                                  value={inventaireForm.produits[produit.id] || 0}
                                  onChange={(v) => setInventaireForm({
                                    ...inventaireForm,
                                    produits: { ...inventaireForm.produits, [produit.id]: v }
                                  })}
                                  size="sm"
                                />
                              </div>
                            ))
                          )}
                        </div>
                      </div>

                      <Button
                        onClick={() => setInventaireForm({ ...inventaireForm, step: 2 })}
                        disabled={!inventaireForm.vendeur_entrant_id}
                        className="btn-golden w-full mt-4"
                      >
                        Continuer
                      </Button>
                    </div>
                  )}

                  {inventaireForm.step === 2 && (
                    <div className="space-y-6">
                      <div className="p-4 rounded-lg bg-muted/50 space-y-2">
                        <h3 className="font-medium">Résumé de l'inventaire</h3>
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <span className="text-muted-foreground">Produits remplis</span>
                            <p className="font-medium text-lg">{produitsRemplis}/{produits.length}</p>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Total unités</span>
                            <p className="font-medium text-lg text-primary">{totalInventaire}</p>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-3">
                        <Label className="text-center block">Votre code PIN (sortant)</Label>
                        <PINInput
                          value={inventaireForm.pin_sortant}
                          onChange={(v) => setInventaireForm({ ...inventaireForm, pin_sortant: v })}
                        />
                      </div>

                      <div className="space-y-3">
                        <Label className="text-center block">Code PIN du vendeur entrant</Label>
                        <PINInput
                          value={inventaireForm.pin_entrant}
                          onChange={(v) => setInventaireForm({ ...inventaireForm, pin_entrant: v })}
                        />
                      </div>

                      <div className="flex gap-3">
                        <Button
                          variant="outline"
                          onClick={() => setInventaireForm({ ...inventaireForm, step: 1 })}
                          className="flex-1"
                        >
                          Retour
                        </Button>
                        <Button
                          onClick={handleValidateInventaire}
                          disabled={isSubmitting || inventaireForm.pin_sortant.length !== 6 || inventaireForm.pin_entrant.length !== 6}
                          className="btn-golden flex-1"
                        >
                          {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Valider l\'inventaire'}
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeTab === 'session' && (
              <div className="space-y-6 animate-fade-in">
                {sessionActive ? (
                  <div className="card-premium p-6">
                    <div className="flex items-center justify-between mb-6">
                      <h2 className="font-display text-xl font-semibold">Session en cours</h2>
                      <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-success/10 text-success text-sm font-medium">
                        <span className="w-2 h-2 rounded-full bg-success animate-pulse" />
                        Ouverte
                      </span>
                    </div>
                    <div className="space-y-4">
                      <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                        <span className="text-muted-foreground">Ouverture</span>
                        <span className="font-medium">
                          {format(new Date(sessionActive.date_ouverture), 'dd/MM/yyyy HH:mm', { locale: fr })}
                        </span>
                      </div>
                      <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                        <span className="flex items-center gap-2 text-muted-foreground">
                          <DollarSign className="w-4 h-4" />
                          Fond de vente
                        </span>
                        <span className="font-bold text-lg">{sessionActive.fond_vente.toLocaleString()} XAF</span>
                      </div>
                      <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                        <span className="flex items-center gap-2 text-muted-foreground">
                          <Smartphone className="w-4 h-4 text-orange-500" />
                          Orange Money
                        </span>
                        <span className="font-medium">{sessionActive.orange_money_initial.toLocaleString()} XAF</span>
                      </div>
                      <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                        <span className="flex items-center gap-2 text-muted-foreground">
                          <Smartphone className="w-4 h-4 text-yellow-500" />
                          MTN Money
                        </span>
                        <span className="font-medium">{sessionActive.mtn_money_initial.toLocaleString()} XAF</span>
                      </div>
                    </div>
                    <div className="mt-6 p-4 rounded-lg bg-info/10 text-info text-sm text-center">
                      ℹ️ Seul le PDG peut fermer cette session
                    </div>
                  </div>
                ) : (
                  <div className="card-premium p-6">
                    <h2 className="font-display text-xl font-semibold mb-6">
                      Ouvrir une session de vente
                    </h2>
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label className="flex items-center gap-2">
                          <DollarSign className="w-4 h-4" />
                          Fond de vente (XAF)
                        </Label>
                        <Input
                          type="number"
                          inputMode="numeric"
                          value={sessionForm.fond_vente || ''}
                          onChange={(e) => setSessionForm({ ...sessionForm, fond_vente: parseInt(e.target.value) || 0 })}
                          className="input-golden"
                          placeholder="0"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="flex items-center gap-2">
                          <Smartphone className="w-4 h-4 text-orange-500" />
                          Orange Money initial (XAF)
                        </Label>
                        <Input
                          type="number"
                          inputMode="numeric"
                          value={sessionForm.orange_money_initial || ''}
                          onChange={(e) => setSessionForm({ ...sessionForm, orange_money_initial: parseInt(e.target.value) || 0 })}
                          className="input-golden"
                          placeholder="0"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="flex items-center gap-2">
                          <Smartphone className="w-4 h-4 text-yellow-500" />
                          MTN Money initial (XAF)
                        </Label>
                        <Input
                          type="number"
                          inputMode="numeric"
                          value={sessionForm.mtn_money_initial || ''}
                          onChange={(e) => setSessionForm({ ...sessionForm, mtn_money_initial: parseInt(e.target.value) || 0 })}
                          className="input-golden"
                          placeholder="0"
                        />
                      </div>
                      <Button
                        onClick={handleOpenSession}
                        disabled={isSubmitting}
                        className="btn-golden w-full mt-4"
                      >
                        {isSubmitting ? (
                          <>
                            <Loader2 className="w-5 h-5 animate-spin" />
                            <span>Ouverture...</span>
                          </>
                        ) : (
                          <>
                            <CreditCard className="w-5 h-5" />
                            <span>Ouvrir la session</span>
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'retours' && (
              <div className="space-y-4 animate-fade-in">
                <div className="flex items-center justify-between">
                  <h2 className="font-display text-xl font-semibold">
                    Retours me concernant
                  </h2>
                  <span className="px-3 py-1 rounded-full bg-primary/10 text-primary font-medium">
                    {totalRetours} unités
                  </span>
                </div>
                {retours.length === 0 ? (
                  <EmptyState
                    icon="inbox"
                    title="Aucun retour"
                    description="Les retours de produits vous concernant apparaîtront ici"
                  />
                ) : (
                  <div className="space-y-3">
                    {retours.map((ret) => {
                      const produit = produits.find(p => p.id === ret.produit_id);
                      return (
                        <div key={ret.id || ret.local_id} className="card-premium p-4">
                          <div className="flex items-center justify-between">
                            <div className="flex-1">
                              <p className="font-medium">{produit?.nom || `Produit #${ret.produit_id}`}</p>
                              <div className="flex items-center gap-3 text-sm mt-1">
                                <span className="flex items-center gap-1 text-muted-foreground">
                                  <Clock className="w-3 h-3" />
                                  {format(new Date(ret.date_retour), 'HH:mm', { locale: fr })}
                                </span>
                                {produit && (
                                  <span className="text-primary font-medium">
                                    {produit.prix.toLocaleString()} XAF
                                  </span>
                                )}
                              </div>
                            </div>
                            <span className="text-2xl font-bold text-primary">{ret.quantite}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'flux' && (
              <div className="space-y-4 animate-fade-in">
                <h2 className="font-display text-xl font-semibold">
                  Mon Flux de Produits
                </h2>
                <div className="card-premium overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-muted/50">
                        <tr>
                          <th className="px-4 py-3 text-left font-medium">Produit</th>
                          <th className="px-4 py-3 text-center font-medium">Prix</th>
                          <th className="px-4 py-3 text-center font-medium">Trouvé</th>
                          <th className="px-4 py-3 text-center font-medium">Reçu</th>
                          <th className="px-4 py-3 text-center font-medium">Retourné</th>
                          <th className="px-4 py-3 text-center font-medium">Restant</th>
                          <th className="px-4 py-3 text-center font-medium">Vendu</th>
                        </tr>
                      </thead>
                      <tbody>
                        {produits.map((produit) => {
                          const recu = receptions
                            .filter(r => r.produit_id === produit.id)
                            .reduce((sum, r) => sum + r.quantite, 0);
                          const retourne = retours
                            .filter(r => r.produit_id === produit.id)
                            .reduce((sum, r) => sum + r.quantite, 0);
                          const trouve = 0;
                          const vendu = 0;
                          const restant = recu + trouve - retourne - vendu;
                          return (
                            <tr key={produit.id} className="border-t">
                              <td className="px-4 py-3 font-medium">{produit.nom}</td>
                              <td className="px-4 py-3 text-center font-medium text-primary">{produit.prix.toLocaleString()} XAF</td>
                              <td className="px-4 py-3 text-center">{trouve}</td>
                              <td className="px-4 py-3 text-center text-success">{recu}</td>
                              <td className="px-4 py-3 text-center text-destructive">{retourne}</td>
                              <td className="px-4 py-3 text-center">{restant}</td>
                              <td className="px-4 py-3 text-center text-primary font-medium">{vendu}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </main>
      
      <DatabaseViewer isOpen={showDbViewer} onClose={() => setShowDbViewer(false)} />
    </div>
  );
}