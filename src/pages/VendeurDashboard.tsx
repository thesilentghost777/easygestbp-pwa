/**
 * EasyGest BP - Dashboard Vendeur
 */

import React, { useState, useEffect } from 'react';
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
  ArrowRightLeft
} from 'lucide-react';
import { getDB, generateLocalId, type Produit, type User as DBUser, type SessionVente, type ReceptionPointeur } from '@/lib/db';
import { autoSyncOnDashboard } from '@/lib/sync';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

type TabType = 'receptions' | 'inventaire' | 'session' | 'retours' | 'flux';

export default function VendeurDashboard() {
  const { user } = useAuth();
  const { sync, status } = useSync();
  
  const [activeTab, setActiveTab] = useState<TabType>('receptions');
  const [showDbViewer, setShowDbViewer] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  
  // Données
  const [produits, setProduits] = useState<Produit[]>([]);
  const [vendeurs, setVendeurs] = useState<DBUser[]>([]);
  const [receptions, setReceptions] = useState<ReceptionPointeur[]>([]);
  const [sessionActive, setSessionActive] = useState<SessionVente | null>(null);
  
  // Formulaire session
  const [sessionForm, setSessionForm] = useState({
    fond_vente: 0,
    orange_money_initial: 0,
    mtn_money_initial: 0,
  });
  
  // Formulaire inventaire
  const [inventaireForm, setInventaireForm] = useState({
    vendeur_entrant_id: null as number | null,
    produits: {} as Record<number, number>,
    pin_sortant: '',
    pin_entrant: '',
    step: 1,
  });
  
  const [isSubmitting, setIsSubmitting] = useState(false);

  const categorie = user?.role === 'vendeur_boulangerie' ? 'boulangerie' : 'patisserie';

  // Charger les données
  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      try {
        await autoSyncOnDashboard();
        
        const db = await getDB();
        
        // Charger produits de ma catégorie
        const allProduits = await db.getAll('produits');
        setProduits(allProduits.filter(p => p.actif && p.categorie === categorie));
        
        // Charger vendeurs de ma catégorie
        const allUsers = await db.getAll('users');
        const vendeurRole = `vendeur_${categorie}`;
        setVendeurs(allUsers.filter(u => u.role === vendeurRole && u.actif && u.id !== user?.id));
        
        // Charger mes réceptions du jour
        if (user) {
          const allReceptions = await db.getAllFromIndex('receptions_pointeur', 'by-vendeur', user.id);
          const today = new Date().toISOString().split('T')[0];
          setReceptions(allReceptions.filter(r => r.date_reception.startsWith(today)));
        }
        
        // Charger session active
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
  }, [user, categorie]);

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

  const tabs = [
    { id: 'receptions' as const, icon: Package, label: 'Réceptions' },
    { id: 'inventaire' as const, icon: ClipboardList, label: 'Inventaire' },
    { id: 'session' as const, icon: CreditCard, label: 'Session' },
    { id: 'retours' as const, icon: Undo2, label: 'Retours' },
    { id: 'flux' as const, icon: TrendingUp, label: 'Mon Flux' },
  ];

  // Calcul des totaux
  const totalReceptions = receptions.reduce((sum, r) => sum + r.quantite, 0);

  return (
    <div className="min-h-screen bg-background">
      <Header 
        title={`Vendeur ${categorie === 'boulangerie' ? 'Boulangerie' : 'Pâtisserie'}`}
        onViewDatabase={() => setShowDbViewer(true)}
      />
      
      {/* Info catégorie */}
      <div className="px-4 py-2 bg-muted/30 border-b flex items-center justify-between">
        <CategoryBadge category={categorie} size="md" />
        {sessionActive && (
          <span className="flex items-center gap-1.5 text-sm text-success">
            <span className="w-2 h-2 rounded-full bg-success animate-pulse" />
            Session active
          </span>
        )}
      </div>
      
      {/* Navigation tabs */}
      <div className="px-4 py-3 border-b bg-card/50 sticky top-[73px] z-40 overflow-x-auto">
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

      {/* Contenu */}
      <main className="p-4 pb-24 max-w-4xl mx-auto">
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : (
          <>
            {/* Tab Réceptions */}
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
                            <div>
                              <p className="font-medium">{produit?.nom || `Produit #${rec.produit_id}`}</p>
                              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                <Clock className="w-3 h-3" />
                                {format(new Date(rec.date_reception), 'HH:mm', { locale: fr })}
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

            {/* Tab Inventaire */}
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
                    <div className="space-y-4">
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
                      
                      <div className="border-t pt-4 mt-4">
                        <Label className="mb-4 block">Quantités restantes par produit</Label>
                        <div className="space-y-3 max-h-80 overflow-y-auto">
                          {produits.map((produit) => (
                            <div key={produit.id} className="flex items-center justify-between gap-4 p-3 rounded-lg bg-muted/30">
                              <span className="flex-1 font-medium truncate">{produit.nom}</span>
                              <NumericInput
                                value={inventaireForm.produits[produit.id] || 0}
                                onChange={(v) => setInventaireForm({
                                  ...inventaireForm,
                                  produits: { ...inventaireForm.produits, [produit.id]: v }
                                })}
                                size="sm"
                              />
                            </div>
                          ))}
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
                      <div className="p-4 rounded-lg bg-muted/50">
                        <h3 className="font-medium mb-2">Résumé de l'inventaire</h3>
                        <p className="text-sm text-muted-foreground">
                          {Object.values(inventaireForm.produits).reduce((a, b) => a + b, 0)} produits restants au total
                        </p>
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
                          disabled={inventaireForm.pin_sortant.length !== 6 || inventaireForm.pin_entrant.length !== 6}
                          className="btn-golden flex-1"
                        >
                          Valider l'inventaire
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Tab Session */}
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

            {/* Tab Retours */}
            {activeTab === 'retours' && (
              <div className="space-y-4 animate-fade-in">
                <h2 className="font-display text-xl font-semibold">
                  Retours me concernant
                </h2>
                <EmptyState
                  icon="inbox"
                  title="Aucun retour"
                  description="Les retours de produits vous concernant apparaîtront ici"
                />
              </div>
            )}

            {/* Tab Flux */}
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
                          <th className="px-4 py-3 text-center font-medium">Trouvé</th>
                          <th className="px-4 py-3 text-center font-medium">Reçu</th>
                          <th className="px-4 py-3 text-center font-medium">Retourné</th>
                          <th className="px-4 py-3 text-center font-medium">Restant</th>
                          <th className="px-4 py-3 text-center font-medium">Vendu</th>
                        </tr>
                      </thead>
                      <tbody>
                        {produits.slice(0, 10).map((produit) => {
                          const recu = receptions
                            .filter(r => r.produit_id === produit.id)
                            .reduce((sum, r) => sum + r.quantite, 0);
                          return (
                            <tr key={produit.id} className="border-t">
                              <td className="px-4 py-3 font-medium">{produit.nom}</td>
                              <td className="px-4 py-3 text-center">0</td>
                              <td className="px-4 py-3 text-center text-success">{recu}</td>
                              <td className="px-4 py-3 text-center text-destructive">0</td>
                              <td className="px-4 py-3 text-center">{recu}</td>
                              <td className="px-4 py-3 text-center text-primary font-medium">0</td>
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
