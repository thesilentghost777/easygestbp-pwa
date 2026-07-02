/**
 * EasyGest BP - Dashboard PDG
 */

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useSync } from '@/contexts/SyncContext';
import { Header } from '@/components/Header';
import { CategoryBadge } from '@/components/CategoryBadge';
import { SyncBadge } from '@/components/SyncBadge';
import { EmptyState } from '@/components/EmptyState';
import { DatabaseViewer } from '@/components/DatabaseViewer';
import { SearchableSelect } from '@/components/SearchableSelect';
import { NumericInput } from '@/components/NumericInput';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Users,
  Package,
  TrendingUp,
  CreditCard,
  ClipboardList,
  Loader2,
  Clock,
  DollarSign,
  Smartphone,
  Check,
  X,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Eye
} from 'lucide-react';
import { getDB, type Produit, type User as DBUser, type SessionVente, type ReceptionPointeur } from '@/lib/db';
import { autoSyncOnDashboard } from '@/lib/sync';
import { sessionsApi, fluxApi, produitsApi } from '@/lib/api';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

type TabType = 'sessions' | 'flux' | 'vendeurs' | 'produits';

interface FluxProduit {
  produit: { id: number; nom: string; prix: number };
  quantite_trouvee: number;
  quantite_recue: number;
  quantite_retour: number;
  quantite_restante: number;
  quantite_vendue: number;
  valeur_vente: number;
}

export default function PDGDashboard() {
  const { user, isOnline } = useAuth();
  const { sync, status } = useSync();
  
  const [activeTab, setActiveTab] = useState<TabType>('sessions');
  const [showDbViewer, setShowDbViewer] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  
  // Données
  const [sessions, setSessions] = useState<SessionVente[]>([]);
  const [produits, setProduits] = useState<Produit[]>([]);
  const [vendeurs, setVendeurs] = useState<DBUser[]>([]);
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [fluxData, setFluxData] = useState<FluxProduit[]>([]);
  
  // Fermeture de session
  const [closingSessionId, setClosingSessionId] = useState<number | null>(null);
  const [closeForm, setCloseForm] = useState({
    montant_verse: 0,
    orange_money_final: 0,
    mtn_money_final: 0,
    ventes_totales: 0,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [expandedSession, setExpandedSession] = useState<number | null>(null);

  // Charger les données
  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      try {
        await autoSyncOnDashboard();
        
        const db = await getDB();
        
        // Charger toutes les sessions
        const allSessions = await db.getAll('sessions_vente');
        setSessions(allSessions.sort((a, b) => 
          new Date(b.date_ouverture).getTime() - new Date(a.date_ouverture).getTime()
        ));
        
        // Charger produits
        const allProduits = await db.getAll('produits');
        setProduits(allProduits);
        
        // Charger vendeurs
        const allUsers = await db.getAll('users');
        setVendeurs(allUsers.filter(u => 
          ['vendeur_boulangerie', 'vendeur_patisserie'].includes(u.role) && u.actif
        ));
        
      } catch (error) {
        console.error('Erreur chargement:', error);
        toast.error('Erreur lors du chargement');
      } finally {
        setIsLoading(false);
      }
    };
    
    loadData();
  }, []);

  // Charger flux pour une date
  const loadFlux = async (date: string) => {
    if (!isOnline) {
      toast.error('Connexion requise pour voir le flux');
      return;
    }
    
    try {
      const response = await fluxApi.getMonFlux(date);
      if (response.success && response.data) {
        setFluxData(response.data);
      }
    } catch (error) {
      console.error('Erreur flux:', error);
    }
  };

  useEffect(() => {
    if (activeTab === 'flux' && isOnline) {
      loadFlux(selectedDate);
    }
  }, [activeTab, selectedDate, isOnline]);

  // Fermer une session
  const handleCloseSession = async (sessionId: number) => {
    if (!isOnline) {
      toast.error('Connexion requise pour fermer une session');
      return;
    }
    
    setIsSubmitting(true);
    try {
      const response = await sessionsApi.fermer?.(sessionId, closeForm);
      
      if (response?.success) {
        // Mettre à jour localement
        const db = await getDB();
        const session = await db.get('sessions_vente', sessionId);
        if (session) {
          session.statut = 'fermee';
          session.montant_verse = closeForm.montant_verse;
          session.orange_money_final = closeForm.orange_money_final;
          session.mtn_money_final = closeForm.mtn_money_final;
          session.valeur_vente = closeForm.ventes_totales;
          session.manquant = closeForm.ventes_totales - (closeForm.montant_verse + closeForm.orange_money_final + closeForm.mtn_money_final);
          session.date_fermeture = new Date().toISOString();
          session.fermee_par = user?.id;
          session.updated_at = new Date().toISOString();
          await db.put('sessions_vente', session);
          
          setSessions(prev => prev.map(s => s.id === sessionId ? session : s));
        }
        
        toast.success('Session fermée avec succès');
        setClosingSessionId(null);
        setCloseForm({ montant_verse: 0, orange_money_final: 0, mtn_money_final: 0, ventes_totales: 0 });
      } else {
        toast.error(response?.message || 'Erreur lors de la fermeture');
      }
    } catch (error) {
      console.error('Erreur fermeture:', error);
      toast.error('Erreur lors de la fermeture de session');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getVendeurName = (vendeurId: number) => {
    return vendeurs.find(v => v.id === vendeurId)?.name || `Vendeur #${vendeurId}`;
  };

  const openSessions = sessions.filter(s => s.statut === 'ouverte');
  const closedSessions = sessions.filter(s => s.statut === 'fermee');

  return (
    <div className="min-h-screen bg-background">
      <Header 
        title="Tableau de bord PDG" 
        onViewDatabase={() => setShowDbViewer(true)}
      />
      
      {/* Stats rapides */}
      <div className="px-4 py-4 bg-gradient-to-r from-primary/10 to-golden-100/50 border-b">
        <div className="max-w-4xl mx-auto grid grid-cols-3 gap-4">
          <div className="text-center">
            <p className="text-2xl font-bold text-primary">{openSessions.length}</p>
            <p className="text-xs text-muted-foreground">Sessions ouvertes</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-success">{closedSessions.length}</p>
            <p className="text-xs text-muted-foreground">Sessions fermées</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-foreground">{vendeurs.length}</p>
            <p className="text-xs text-muted-foreground">Vendeurs actifs</p>
          </div>
        </div>
      </div>
      
      {/* Navigation tabs */}
      <div className="px-4 py-3 border-b bg-card/50 sticky top-[73px] z-40 overflow-x-auto">
        <div className="flex gap-2 min-w-max">
          {[
            { id: 'sessions' as const, icon: CreditCard, label: 'Sessions' },
            { id: 'flux' as const, icon: TrendingUp, label: 'Flux Produits' },
            { id: 'vendeurs' as const, icon: Users, label: 'Vendeurs' },
            { id: 'produits' as const, icon: Package, label: 'Produits' },
          ].map((tab) => (
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
            {/* Tab Sessions */}
            {activeTab === 'sessions' && (
              <div className="space-y-6 animate-fade-in">
                {/* Sessions ouvertes */}
                <div>
                  <h2 className="font-display text-lg font-semibold mb-3 flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-success animate-pulse" />
                    Sessions ouvertes ({openSessions.length})
                  </h2>
                  
                  {openSessions.length === 0 ? (
                    <div className="card-premium p-6 text-center text-muted-foreground">
                      Aucune session ouverte
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {openSessions.map((session) => (
                        <div key={session.id || session.local_id} className="card-premium overflow-hidden">
                          <div 
                            className="p-4 cursor-pointer"
                            onClick={() => setExpandedSession(expandedSession === session.id ? null : session.id!)}
                          >
                            <div className="flex items-start justify-between">
                              <div>
                                <div className="flex items-center gap-2 mb-1">
                                  <span className="font-medium">{getVendeurName(session.vendeur_id)}</span>
                                  <CategoryBadge category={session.categorie} />
                                </div>
                                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                  <Clock className="w-3 h-3" />
                                  Ouverte le {format(new Date(session.date_ouverture), 'dd/MM à HH:mm', { locale: fr })}
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <SyncBadge status={session.sync_status} />
                                {expandedSession === session.id ? (
                                  <ChevronUp className="w-5 h-5 text-muted-foreground" />
                                ) : (
                                  <ChevronDown className="w-5 h-5 text-muted-foreground" />
                                )}
                              </div>
                            </div>
                          </div>
                          
                          {expandedSession === session.id && (
                            <div className="border-t p-4 bg-muted/30 animate-fade-in">
                              <div className="grid grid-cols-3 gap-3 mb-4 text-sm">
                                <div className="p-2 rounded bg-background">
                                  <p className="text-muted-foreground text-xs">Fond</p>
                                  <p className="font-medium">{session.fond_vente.toLocaleString()} XAF</p>
                                </div>
                                <div className="p-2 rounded bg-background">
                                  <p className="text-muted-foreground text-xs">Orange</p>
                                  <p className="font-medium">{session.orange_money_initial.toLocaleString()} XAF</p>
                                </div>
                                <div className="p-2 rounded bg-background">
                                  <p className="text-muted-foreground text-xs">MTN</p>
                                  <p className="font-medium">{session.mtn_money_initial.toLocaleString()} XAF</p>
                                </div>
                              </div>
                              
                              {closingSessionId === session.id ? (
                                <div className="space-y-4">
                                  <h4 className="font-medium">Fermer cette session</h4>
                                  
                                  <div className="grid grid-cols-2 gap-3">
                                    <div>
                                      <Label className="text-xs">Ventes totales (XAF)</Label>
                                      <Input
                                        type="number"
                                        value={closeForm.ventes_totales || ''}
                                        onChange={(e) => setCloseForm({...closeForm, ventes_totales: parseInt(e.target.value) || 0})}
                                        className="input-golden"
                                      />
                                    </div>
                                    <div>
                                      <Label className="text-xs">Montant versé (XAF)</Label>
                                      <Input
                                        type="number"
                                        value={closeForm.montant_verse || ''}
                                        onChange={(e) => setCloseForm({...closeForm, montant_verse: parseInt(e.target.value) || 0})}
                                        className="input-golden"
                                      />
                                    </div>
                                    <div>
                                      <Label className="text-xs">Orange Money final</Label>
                                      <Input
                                        type="number"
                                        value={closeForm.orange_money_final || ''}
                                        onChange={(e) => setCloseForm({...closeForm, orange_money_final: parseInt(e.target.value) || 0})}
                                        className="input-golden"
                                      />
                                    </div>
                                    <div>
                                      <Label className="text-xs">MTN Money final</Label>
                                      <Input
                                        type="number"
                                        value={closeForm.mtn_money_final || ''}
                                        onChange={(e) => setCloseForm({...closeForm, mtn_money_final: parseInt(e.target.value) || 0})}
                                        className="input-golden"
                                      />
                                    </div>
                                  </div>
                                  
                                  {/* Calcul manquant */}
                                  <div className={`p-3 rounded-lg ${
                                    closeForm.ventes_totales - (closeForm.montant_verse + closeForm.orange_money_final + closeForm.mtn_money_final) > 0
                                      ? 'bg-destructive/10 text-destructive'
                                      : 'bg-success/10 text-success'
                                  }`}>
                                    <p className="text-sm font-medium">
                                      Manquant: {(closeForm.ventes_totales - (closeForm.montant_verse + closeForm.orange_money_final + closeForm.mtn_money_final)).toLocaleString()} XAF
                                    </p>
                                  </div>
                                  
                                  <div className="flex gap-2">
                                    <Button
                                      variant="outline"
                                      onClick={() => setClosingSessionId(null)}
                                      disabled={isSubmitting}
                                      className="flex-1"
                                    >
                                      Annuler
                                    </Button>
                                    <Button
                                      onClick={() => handleCloseSession(session.id!)}
                                      disabled={isSubmitting || !isOnline}
                                      className="btn-golden flex-1"
                                    >
                                      {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Confirmer'}
                                    </Button>
                                  </div>
                                </div>
                              ) : (
                                <Button
                                  onClick={() => setClosingSessionId(session.id!)}
                                  disabled={!isOnline}
                                  className="w-full"
                                  variant="destructive"
                                >
                                  <X className="w-4 h-4 mr-2" />
                                  Fermer cette session
                                </Button>
                              )}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                
                {/* Sessions fermées */}
                <div>
                  <h2 className="font-display text-lg font-semibold mb-3 flex items-center gap-2">
                    <Check className="w-4 h-4 text-muted-foreground" />
                    Sessions fermées récentes
                  </h2>
                  
                  {closedSessions.length === 0 ? (
                    <div className="card-premium p-6 text-center text-muted-foreground">
                      Aucune session fermée
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {closedSessions.slice(0, 10).map((session) => (
                        <div key={session.id || session.local_id} className="card-premium p-4">
                          <div className="flex items-start justify-between">
                            <div>
                              <div className="flex items-center gap-2 mb-1">
                                <span className="font-medium">{getVendeurName(session.vendeur_id)}</span>
                                <CategoryBadge category={session.categorie} />
                              </div>
                              <div className="text-sm text-muted-foreground">
                                {format(new Date(session.date_ouverture), 'dd/MM/yyyy', { locale: fr })}
                                {session.date_fermeture && (
                                  <span> - Fermée à {format(new Date(session.date_fermeture), 'HH:mm')}</span>
                                )}
                              </div>
                            </div>
                            <div className="text-right">
                              {session.valeur_vente !== undefined && (
                                <p className="font-bold text-primary">{session.valeur_vente.toLocaleString()} XAF</p>
                              )}
                              {session.manquant !== undefined && session.manquant > 0 && (
                                <p className="text-xs text-destructive flex items-center gap-1">
                                  <AlertTriangle className="w-3 h-3" />
                                  Manquant: {session.manquant.toLocaleString()}
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Tab Flux */}
            {activeTab === 'flux' && (
              <div className="space-y-4 animate-fade-in">
                <div className="flex items-center gap-3">
                  <Label>Date:</Label>
                  <Input
                    type="date"
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    className="input-golden w-auto"
                  />
                  <Button onClick={() => loadFlux(selectedDate)} disabled={!isOnline} size="sm">
                    <Eye className="w-4 h-4 mr-1" />
                    Voir
                  </Button>
                </div>
                
                {!isOnline ? (
                  <div className="card-premium p-6 text-center text-muted-foreground">
                    Connexion requise pour voir le flux
                  </div>
                ) : fluxData.length === 0 ? (
                  <EmptyState
                    icon="chart"
                    title="Aucun flux"
                    description="Sélectionnez une date et cliquez sur Voir"
                  />
                ) : (
                  <div className="space-y-3">
                    {fluxData.map((item, idx) => (
                      <div key={idx} className="card-premium p-4">
                        <div className="flex items-start justify-between mb-3">
                          <div>
                            <p className="font-medium">{item.produit.nom}</p>
                            <p className="text-sm text-muted-foreground">{item.produit.prix} XAF/unité</p>
                          </div>
                          <span className="text-lg font-bold text-primary">
                            {item.valeur_vente.toLocaleString()} XAF
                          </span>
                        </div>
                        <div className="grid grid-cols-4 gap-2 text-center text-xs">
                          <div className="p-2 rounded bg-muted/50">
                            <p className="text-muted-foreground">Reçus</p>
                            <p className="font-semibold">{item.quantite_recue}</p>
                          </div>
                          <div className="p-2 rounded bg-muted/50">
                            <p className="text-muted-foreground">Retours</p>
                            <p className="font-semibold text-warning">{item.quantite_retour}</p>
                          </div>
                          <div className="p-2 rounded bg-muted/50">
                            <p className="text-muted-foreground">Vendus</p>
                            <p className="font-semibold text-success">{item.quantite_vendue}</p>
                          </div>
                          <div className="p-2 rounded bg-muted/50">
                            <p className="text-muted-foreground">Restants</p>
                            <p className="font-semibold">{item.quantite_restante}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Tab Vendeurs */}
            {activeTab === 'vendeurs' && (
              <div className="space-y-4 animate-fade-in">
                <h2 className="font-display text-xl font-semibold">
                  Vendeurs actifs ({vendeurs.length})
                </h2>
                
                {vendeurs.length === 0 ? (
                  <EmptyState
                    icon="users"
                    title="Aucun vendeur"
                    description="Les vendeurs inscrits apparaîtront ici"
                  />
                ) : (
                  <div className="space-y-3">
                    {vendeurs.map((vendeur) => {
                      const vendeurSession = sessions.find(s => s.vendeur_id === vendeur.id && s.statut === 'ouverte');
                      return (
                        <div key={vendeur.id} className="card-premium p-4">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                                <Users className="w-5 h-5 text-primary" />
                              </div>
                              <div>
                                <p className="font-medium">{vendeur.name}</p>
                                <p className="text-sm text-muted-foreground">{vendeur.numero_telephone}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <CategoryBadge category={vendeur.role === 'vendeur_boulangerie' ? 'boulangerie' : 'patisserie'} />
                              {vendeurSession && (
                                <span className="flex items-center gap-1 text-xs text-success">
                                  <span className="w-2 h-2 rounded-full bg-success animate-pulse" />
                                  En session
                                </span>
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

            {/* Tab Produits */}
            {activeTab === 'produits' && (
              <div className="space-y-4 animate-fade-in">
                <div className="flex items-center justify-between">
                  <h2 className="font-display text-xl font-semibold">
                    Produits ({produits.length})
                  </h2>
                </div>
                
                <Tabs defaultValue="all" className="w-full">
                  <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="all">Tous</TabsTrigger>
                    <TabsTrigger value="boulangerie">Boulangerie</TabsTrigger>
                    <TabsTrigger value="patisserie">Pâtisserie</TabsTrigger>
                  </TabsList>
                  
                  {['all', 'boulangerie', 'patisserie'].map((cat) => (
                    <TabsContent key={cat} value={cat} className="space-y-3 mt-4">
                      {produits
                        .filter(p => cat === 'all' || p.categorie === cat)
                        .map((produit) => (
                          <div key={produit.id} className="card-premium p-4">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <CategoryBadge category={produit.categorie} />
                                <div>
                                  <p className="font-medium">{produit.nom}</p>
                                  <p className="text-lg font-bold text-primary">{produit.prix.toLocaleString()} XAF</p>
                                </div>
                              </div>
                              <span className={`text-xs px-2 py-1 rounded-full ${
                                produit.actif ? 'bg-success/10 text-success' : 'bg-muted text-muted-foreground'
                              }`}>
                                {produit.actif ? 'Actif' : 'Inactif'}
                              </span>
                            </div>
                          </div>
                        ))}
                    </TabsContent>
                  ))}
                </Tabs>
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