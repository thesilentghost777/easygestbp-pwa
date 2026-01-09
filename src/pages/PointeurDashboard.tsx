/**
 * EasyGest BP - Dashboard Pointeur
 */

import React, { useState, useEffect } from 'react';
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
  Package, 
  Undo2, 
  Check, 
  ChevronRight,
  Clock,
  User,
  Loader2,
  AlertTriangle
} from 'lucide-react';
import { getDB, generateLocalId, type Produit, type User as DBUser, type ReceptionPointeur } from '@/lib/db';
import { autoSyncOnDashboard } from '@/lib/sync';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

type TabType = 'reception' | 'retour' | 'mes-receptions' | 'mes-retours';

export default function PointeurDashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { sync, status } = useSync();
  
  const [activeTab, setActiveTab] = useState<TabType>('reception');
  const [showDbViewer, setShowDbViewer] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  
  // Données
  const [produits, setProduits] = useState<Produit[]>([]);
  const [producteurs, setProducteurs] = useState<DBUser[]>([]);
  const [vendeurActif, setVendeurActif] = useState<{ boulangerie?: DBUser; patisserie?: DBUser }>({});
  const [receptions, setReceptions] = useState<ReceptionPointeur[]>([]);
  
  // Formulaire réception
  const [receptionForm, setReceptionForm] = useState({
    producteur_id: 1, // Par défaut producteur ID 1
    produit_id: null as number | null,
    quantite: 0,
    notes: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Charger les données au montage
  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      try {
        // Sync auto
        await autoSyncOnDashboard();
        
        const db = await getDB();
        
        // Charger produits actifs
        const allProduits = await db.getAll('produits');
        setProduits(allProduits.filter(p => p.actif));
        
        // Charger producteurs
        const allUsers = await db.getAll('users');
        setProducteurs(allUsers.filter(u => u.role === 'producteur' && u.actif));
        
        // Charger vendeurs actifs
        const vendeursActifs = await db.getAll('vendeurs_actifs');
        const vendeurBoulangerie = vendeursActifs.find(v => v.categorie === 'boulangerie');
        const vendeurPatisserie = vendeursActifs.find(v => v.categorie === 'patisserie');
        
        if (vendeurBoulangerie?.vendeur_id) {
          const vb = allUsers.find(u => u.id === vendeurBoulangerie.vendeur_id);
          if (vb) setVendeurActif(prev => ({ ...prev, boulangerie: vb }));
        }
        if (vendeurPatisserie?.vendeur_id) {
          const vp = allUsers.find(u => u.id === vendeurPatisserie.vendeur_id);
          if (vp) setVendeurActif(prev => ({ ...prev, patisserie: vp }));
        }
        
        // Charger mes réceptions
        if (user) {
          const allReceptions = await db.getAllFromIndex('receptions_pointeur', 'by-pointeur', user.id);
          setReceptions(allReceptions.sort((a, b) => 
            new Date(b.date_reception).getTime() - new Date(a.date_reception).getTime()
          ));
        }
        
      } catch (error) {
        console.error('Erreur chargement données:', error);
        toast.error('Erreur lors du chargement des données');
      } finally {
        setIsLoading(false);
      }
    };
    
    loadData();
  }, [user]);

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

  const selectedProduit = produits.find(p => p.id === receptionForm.produit_id);
  const vendeurAssigne = getVendeurAssigne(receptionForm.produit_id);

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
                  {vendeurAssigne && selectedProduit && (
                    <div className="p-4 rounded-lg bg-success/10 border border-success/30 mb-6 animate-scale-in">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-success/20 flex items-center justify-center">
                          <User className="w-5 h-5 text-success" />
                        </div>
                        <div>
                          <p className="text-sm text-success font-medium">Vendeur assigné automatiquement</p>
                          <p className="font-semibold">{vendeurAssigne.name}</p>
                        </div>
                        <CategoryBadge category={selectedProduit.categorie} size="md" />
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
                  <p className="text-muted-foreground text-center py-8">
                    Fonctionnalité retour à venir...
                  </p>
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
                        <div key={rec.id || rec.local_id} className="card-premium p-4">
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
                              {rec.verrou && (
                                <span className="text-xs text-muted-foreground">🔒 Verrouillé</span>
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
                <h2 className="font-display text-xl font-semibold">
                  Mes Retours
                </h2>
                <EmptyState
                  icon="inbox"
                  title="Aucun retour"
                  description="Vos retours apparaîtront ici"
                />
              </div>
            )}
          </>
        )}
      </main>

      {/* Database Viewer Modal */}
      <DatabaseViewer isOpen={showDbViewer} onClose={() => setShowDbViewer(false)} />
    </div>
  );
}
