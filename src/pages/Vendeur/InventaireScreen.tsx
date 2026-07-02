/**
 * EasyGest BP — Sous-écran Inventaire (Vendeur)
 *
 * VERROU AUTOMATIQUE :
 * - Dès que le vendeur entrant est sélectionné OU qu'une quantité > 0 est saisie,
 *   le verrou d'inventaire est automatiquement activé via lockInventory().
 * - Le verrou est libéré après la validation complète (ou en cas d'erreur).
 * - Pendant le verrou, le ping et la synchro auto sont suspendus → plus de
 *   rechargement intempestif du formulaire.
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Package,
  Check,
  ChevronLeft,
  ChevronRight,
  ListChecks,
  Pencil,
  X,
  Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { NumericInput } from '@/components/NumericInput';
import { SearchableSelect } from '@/components/SearchableSelect';
import { PINInput } from '@/components/PINInput';
import { useAuth } from '@/contexts/AuthContext';
import { getDB, generateLocalId } from '@/lib/db';
import type {
  Produit,
  User as DBUser,
  Inventaire,
  InventaireDetail,
  VendeurActif,
} from '@/lib/db';
import { toast } from 'sonner';
import bcrypt from 'bcryptjs';

// ─── Modale d'édition rapide de quantité ─────────────────────────────────────
function EditQuantityModal({
  produit,
  currentValue,
  onConfirm,
  onClose,
}: {
  produit: Produit;
  currentValue: number;
  onConfirm: (val: number) => void;
  onClose: () => void;
}) {
  const [val, setVal] = useState(currentValue);

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-4 animate-fade-in"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm bg-card rounded-3xl shadow-divine p-6 space-y-5 animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-display text-lg font-bold">{produit.nom}</h3>
            <p className="text-sm text-muted-foreground">{produit.prix.toLocaleString()} XAF</p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} className="rounded-xl">
            <X className="w-5 h-5" />
          </Button>
        </div>

        <div className="space-y-2">
          <Label className="text-center block">Quantité restante</Label>
          <div className="flex justify-center">
            <NumericInput value={val} onChange={setVal} size="lg" />
          </div>
        </div>

        <div className="flex gap-3">
          <Button variant="outline" onClick={onClose} className="flex-1">
            Annuler
          </Button>
          <Button
            onClick={() => {
              onConfirm(val);
              onClose();
            }}
            className="btn-golden flex-1"
          >
            <Check className="w-4 h-4 mr-1" />
            Valider
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Splash bienvenue (vendeur entrant) ───────────────────────────────────────
function WelcomeSplash({ vendeurName }: { vendeurName: string }) {
  const [phase, setPhase] = useState<'enter' | 'show' | 'dots'>('enter');

  useEffect(() => {
    const t1 = setTimeout(() => setPhase('show'), 400);
    const t2 = setTimeout(() => setPhase('dots'), 1400);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, []);

  const firstName = vendeurName.split(' ')[0];

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center overflow-hidden"
      style={{
        background: 'linear-gradient(135deg, #0f0c29 0%, #302b63 50%, #24243e 100%)',
      }}
    >
      {/* Particules dorées */}
      {Array.from({ length: 18 }).map((_, i) => (
        <span
          key={i}
          className="absolute rounded-full opacity-0"
          style={{
            width: `${4 + (i % 5) * 3}px`,
            height: `${4 + (i % 5) * 3}px`,
            background: `hsl(${43 + (i % 3) * 8}, 90%, ${55 + (i % 4) * 5}%)`,
            left: `${5 + (i * 37) % 90}%`,
            top: `${10 + (i * 53) % 80}%`,
            animation: `floatParticle ${2.5 + (i % 4) * 0.6}s ease-out ${i * 0.12}s forwards`,
          }}
        />
      ))}

      {/* Cercles lumineux */}
      <div className="absolute inset-0 pointer-events-none">
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full"
          style={{
            background:
              'radial-gradient(circle, rgba(212,175,55,0.08) 0%, transparent 70%)',
            animation: 'pulse 2s ease-in-out infinite',
          }}
        />
      </div>

      {/* Avatar */}
      <div
        className="relative mb-8 transition-all duration-700"
        style={{
          opacity: phase === 'enter' ? 0 : 1,
          transform: phase === 'enter' ? 'scale(0.5) translateY(30px)' : 'scale(1) translateY(0)',
        }}
      >
        <div
          className="absolute inset-0 rounded-full"
          style={{
            background:
              'conic-gradient(from 0deg, transparent 60%, rgba(212,175,55,0.6) 80%, rgba(212,175,55,0.9) 90%, transparent 100%)',
            width: '120px',
            height: '120px',
            margin: '-12px',
            animation: 'spin 2s linear infinite',
          }}
        />
        <div
          className="relative w-24 h-24 rounded-full flex items-center justify-center"
          style={{
            background: 'linear-gradient(135deg, #d4af37 0%, #f5d064 50%, #c8960c 100%)',
            boxShadow: '0 0 40px rgba(212,175,55,0.5), 0 0 80px rgba(212,175,55,0.2)',
          }}
        >
          <svg
            className="w-12 h-12 text-white"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
            />
          </svg>
        </div>
      </div>

      {/* Texte */}
      <div
        className="text-center px-8 transition-all duration-700 delay-200"
        style={{
          opacity: phase === 'enter' ? 0 : 1,
          transform: phase === 'enter' ? 'translateY(20px)' : 'translateY(0)',
        }}
      >
        <p className="text-white/60 text-sm font-medium tracking-[0.3em] uppercase mb-2">
          Bienvenue
        </p>
        <h2
          className="text-4xl font-bold mb-2"
          style={{
            background: 'linear-gradient(90deg, #d4af37, #f5d064, #d4af37)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundSize: '200%',
            animation: 'shimmer 2s linear infinite',
          }}
        >
          {firstName} 👋
        </h2>
        <p className="text-white/70 text-base leading-relaxed mt-3 max-w-xs mx-auto">
          J'espère que ta journée se passe bien
        </p>
      </div>

      <div
        className="mt-10 transition-all duration-500 delay-500"
        style={{ opacity: phase === 'dots' ? 1 : 0 }}
      >
        <div className="flex flex-col items-center gap-3">
          <div
            className="flex items-center gap-2 px-5 py-2.5 rounded-full"
            style={{
              background: 'rgba(212,175,55,0.12)',
              border: '1px solid rgba(212,175,55,0.25)',
            }}
          >
            <div className="flex gap-1.5">
              {[0, 1, 2].map((i) => (
                <span
                  key={i}
                  className="w-1.5 h-1.5 rounded-full"
                  style={{
                    background: '#d4af37',
                    animation: `bounce 1s ease-in-out ${i * 0.2}s infinite`,
                  }}
                />
              ))}
            </div>
            <span className="text-sm font-medium" style={{ color: '#d4af37' }}>
              Nous configurons l'interface pour toi
            </span>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes floatParticle {
          0%   { opacity: 0; transform: translate(0,0) scale(0); }
          20%  { opacity: 0.8; }
          100% { opacity: 0; transform: translate(40px, -80px) scale(1.5); }
        }
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes shimmer {
          0%,100% { background-position: 0% 50%; }
          50%      { background-position: 100% 50%; }
        }
        @keyframes bounce {
          0%,100% { transform: translateY(0); }
          50%      { transform: translateY(-6px); }
        }
        @keyframes pulse {
          0%,100% { transform: translate(-50%,-50%) scale(1); opacity: 1; }
          50%      { transform: translate(-50%,-50%) scale(1.08); opacity: 0.7; }
        }
      `}</style>
    </div>
  );
}

// ─── Props ────────────────────────────────────────────────────────────────────
interface InventaireScreenProps {
  produits: Produit[];
  vendeurs: DBUser[];
  categorie: 'boulangerie' | 'patisserie';
}

// ─── Composant principal ──────────────────────────────────────────────────────
export function InventaireScreen({ produits, vendeurs, categorie }: InventaireScreenProps) {
  const { user, logout, lockInventory, unlockInventory } = useAuth();
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const [splashVendeurName, setSplashVendeurName] = useState<string | null>(null);
  const [editingProduit, setEditingProduit] = useState<Produit | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [form, setForm] = useState({
    vendeur_entrant_id: null as number | null,
    produits: {} as Record<number, number>,
    pin_sortant: '',
    pin_entrant: '',
    step: 1,
    currentProductIndex: 0,
  });

  // ── Verrou automatique ────────────────────────────────────────────────────
  // Dès que le vendeur entrant est sélectionné ou une quantité saisie, on verrouille.
  const hasStartedInventory =
    form.vendeur_entrant_id !== null ||
    Object.values(form.produits).some((v) => v > 0);

  useEffect(() => {
    if (hasStartedInventory) {
      lockInventory();
    } else {
      unlockInventory();
    }
  }, [hasStartedInventory, lockInventory, unlockInventory]);

  // S'assurer de déverrouiller quand le composant est démonté
  useEffect(() => {
    return () => {
      unlockInventory();
    };
  }, [unlockInventory]);
  // ─────────────────────────────────────────────────────────────────────────

  const setFormField = useCallback(
    <K extends keyof typeof form>(key: K, value: (typeof form)[K]) => {
      setForm((prev) => ({ ...prev, [key]: value }));
    },
    []
  );

  const currentProduct = produits[form.currentProductIndex];
  const currentQuantity = currentProduct ? form.produits[currentProduct.id] || 0 : 0;
  const isLastProduct = form.currentProductIndex === produits.length - 1;
  const isFirstProduct = form.currentProductIndex === 0;

  const produitsRemplisList = produits.filter((p) => (form.produits[p.id] || 0) > 0);
  const totalInventaire = Object.values(form.produits).reduce((a, b) => a + b, 0);
  const produitsRemplis = Object.values(form.produits).filter((v) => v > 0).length;

  // ── Validation finale ─────────────────────────────────────────────────────
  const handleValidate = async () => {
    if (!user || !form.vendeur_entrant_id) return;
    setIsSubmitting(true);

    try {
      const db = await getDB();
      const now = new Date().toISOString();

      // Vérification des PINs
      const sortantUser = await db.get('users', user.id);
      if (!sortantUser) throw new Error('Utilisateur sortant non trouvé');
      if (!bcrypt.compareSync(form.pin_sortant, sortantUser.code_pin))
        throw new Error('PIN sortant incorrect');

      const entrantUser = await db.get('users', form.vendeur_entrant_id);
      if (!entrantUser) throw new Error('Utilisateur entrant non trouvé');
      if (!bcrypt.compareSync(form.pin_entrant, entrantUser.code_pin))
        throw new Error('PIN entrant incorrect');

      // Création de l'inventaire
      const local_id = generateLocalId();
      const inventaire: Inventaire = {
        local_id,
        vendeur_sortant_id: user.id,
        vendeur_entrant_id: form.vendeur_entrant_id,
        categorie,
        valide_sortant: true,
        valide_entrant: true,
        date_inventaire: now,
        sync_status: 'pending',
        created_at: now,
        updated_at: now,
      };
      await db.add('inventaires', inventaire);

      // Ajout des détails
      for (const [produit_id_str, quantite_restante] of Object.entries(form.produits)) {
        const produit_id = parseInt(produit_id_str);
        if (!isNaN(produit_id) && typeof quantite_restante === 'number') {
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
      }

      // Mise à jour du vendeur actif
      const ancienActif = await db.getFromIndex('vendeurs_actifs', 'by-categorie', categorie);
      if (ancienActif) {
        await db.delete('vendeurs_actifs', ancienActif.id);
      }
      const nouvelActif: VendeurActif = {
        id: Date.now(),
        categorie,
        vendeur_id: form.vendeur_entrant_id,
        connecte_a: now,
        sync_status: 'pending',
        created_at: now,
        updated_at: now,
      };
      await db.add('vendeurs_actifs', nouvelActif);

      toast.success('Inventaire créé avec succès !');

      // Auto-login du vendeur entrant après logout
      sessionStorage.setItem('autoLoginPhone', entrantUser.numero_telephone);
      sessionStorage.setItem('autoLoginPin', form.pin_entrant);

      // Splash
      setSplashVendeurName(entrantUser.name);

      // Attendre 3s puis logout → /login
      await new Promise((resolve) => setTimeout(resolve, 3000));
      if (!mountedRef.current) return;

      // Le unlock sera fait par le logout dans AuthContext,
      // mais on le fait explicitement ici aussi pour être propre.
      unlockInventory();

      await logout();
      await new Promise((resolve) => setTimeout(resolve, 300));
      if (!mountedRef.current) return;

      window.location.href = '/login';
    } catch (error: any) {
      console.error('Erreur inventaire:', error);
      toast.error(error.message || "Erreur lors de la validation");
      setSplashVendeurName(null);
      // On garde le verrou actif car l'inventaire n'est pas terminé
    } finally {
      if (mountedRef.current) setIsSubmitting(false);
    }
  };

  // ── Splash ────────────────────────────────────────────────────────────────
  if (splashVendeurName !== null) {
    return <WelcomeSplash vendeurName={splashVendeurName} />;
  }

  // ── Rendu ─────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6 animate-fade-in">
      <div className="card-premium p-6">
        <div className="flex items-center justify-between mb-1">
          <h2 className="font-display text-xl font-semibold">Créer un inventaire</h2>
          {hasStartedInventory && (
            <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-warning/10 text-warning text-xs font-semibold">
              🔒 Synchro pausée
            </span>
          )}
        </div>
        <p className="text-sm text-muted-foreground mb-6">
          Passation de service avec le vendeur suivant
        </p>

        {/* ══ ÉTAPE 1 ══ */}
        {form.step === 1 && (
          <div className="space-y-6">
            {/* Sélection vendeur entrant */}
            <div className="space-y-2">
              <Label>Vendeur entrant</Label>
              <SearchableSelect
                options={vendeurs.map((v) => ({
                  value: v.id,
                  label: v.name,
                  description: v.numero_telephone,
                }))}
                value={form.vendeur_entrant_id}
                onChange={(v) => setFormField('vendeur_entrant_id', v as number)}
                placeholder="Sélectionner le vendeur entrant"
              />
            </div>

            {/* Barre de progression */}
            <div className="p-4 rounded-lg bg-primary/5 border border-primary/20">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">Progression</span>
                <span className="text-sm text-muted-foreground">
                  {form.currentProductIndex + 1} / {produits.length}
                </span>
              </div>
              <div className="w-full bg-muted rounded-full h-2">
                <div
                  className="bg-primary h-2 rounded-full transition-all duration-300"
                  style={{
                    width: `${((form.currentProductIndex + 1) / produits.length) * 100}%`,
                  }}
                />
              </div>
              <div className="flex items-center justify-between mt-3 text-sm">
                <span className="text-muted-foreground">Produits remplis</span>
                <span className="font-bold text-primary">
                  {produitsRemplis}/{produits.length}
                </span>
              </div>
            </div>

            {/* Carrousel produit */}
            {currentProduct && (
              <div className="relative">
                <div className="card-premium p-8 space-y-6 border-2 border-primary/20">
                  <div className="text-center space-y-3">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10">
                      <Package className="w-8 h-8 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-display text-2xl font-bold">{currentProduct.nom}</h3>
                      <p className="text-lg text-primary font-semibold mt-1">
                        {currentProduct.prix.toLocaleString()} XAF
                      </p>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <Label className="text-center block text-lg">Quantité restante</Label>
                    <div className="flex justify-center">
                      <NumericInput
                        value={currentQuantity}
                        onChange={(v) =>
                          setForm((prev) => ({
                            ...prev,
                            produits: { ...prev.produits, [currentProduct.id]: v },
                          }))
                        }
                        size="lg"
                      />
                    </div>
                    {currentQuantity > 0 && (
                      <div className="text-center">
                        <span className="inline-flex items-center gap-1 text-sm text-success">
                          <Check className="w-4 h-4" />
                          Quantité enregistrée
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-between gap-3 pt-4">
                    <Button
                      onClick={() =>
                        setForm((prev) => ({
                          ...prev,
                          currentProductIndex: prev.currentProductIndex - 1,
                        }))
                      }
                      disabled={isFirstProduct}
                      variant="outline"
                      size="lg"
                      className="flex-1"
                    >
                      <ChevronLeft className="w-5 h-5 mr-1" />
                      Précédent
                    </Button>

                    {!isLastProduct ? (
                      <Button
                        onClick={() =>
                          setForm((prev) => ({
                            ...prev,
                            currentProductIndex: prev.currentProductIndex + 1,
                          }))
                        }
                        size="lg"
                        className="flex-1 btn-golden"
                      >
                        Suivant<ChevronRight className="w-5 h-5 ml-1" />
                      </Button>
                    ) : (
                      <Button
                        onClick={() => setFormField('step', 2)}
                        disabled={!form.vendeur_entrant_id}
                        size="lg"
                        className="flex-1 btn-golden"
                      >
                        <Check className="w-5 h-5 mr-1" />
                        Terminer
                      </Button>
                    )}
                  </div>
                </div>

                {/* Points de navigation */}
                <div className="flex items-center justify-center gap-1 mt-4 flex-wrap">
                  {produits.map((_, index) => (
                    <button
                      key={index}
                      onClick={() => setFormField('currentProductIndex', index)}
                      className={`h-2 rounded-full transition-all ${
                        index === form.currentProductIndex
                          ? 'bg-primary w-8'
                          : form.produits[produits[index]?.id] > 0
                          ? 'bg-success w-2'
                          : 'bg-muted w-2'
                      }`}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Récapitulatif étape 1 */}
            {produitsRemplisList.length > 0 && (
              <div className="mt-2 space-y-3">
                <div className="flex items-center gap-2">
                  <ListChecks className="w-5 h-5 text-success" />
                  <h3 className="font-semibold text-base">
                    Récapitulatif
                    <span className="ml-2 text-sm font-normal text-muted-foreground">
                      ({produitsRemplisList.length} produit
                      {produitsRemplisList.length > 1 ? 's' : ''} saisi
                      {produitsRemplisList.length > 1 ? 's' : ''})
                    </span>
                  </h3>
                </div>

                <div className="rounded-xl border border-success/20 bg-success/5 overflow-hidden">
                  <div className="grid grid-cols-[1fr_auto_auto_auto] px-4 py-2 bg-success/10 text-xs font-semibold text-muted-foreground uppercase tracking-wide gap-3">
                    <span>Produit</span>
                    <span className="text-center">Prix unit.</span>
                    <span className="text-right">Qté</span>
                    <span />
                  </div>

                  <div className="divide-y divide-success/10">
                    {produitsRemplisList.map((p, idx) => {
                      const qty = form.produits[p.id] || 0;
                      const isCurrentlyEditing = p.id === currentProduct?.id;
                      return (
                        <div
                          key={p.id}
                          className={`grid grid-cols-[1fr_auto_auto_auto] px-4 py-3 text-sm gap-3 items-center transition-colors ${
                            isCurrentlyEditing
                              ? 'bg-primary/10'
                              : idx % 2 === 0
                              ? 'bg-transparent'
                              : 'bg-muted/20'
                          }`}
                        >
                          <button
                            onClick={() => {
                              const index = produits.findIndex((pr) => pr.id === p.id);
                              if (index !== -1) setFormField('currentProductIndex', index);
                            }}
                            className="font-medium truncate text-left flex items-center gap-1.5"
                          >
                            {isCurrentlyEditing && (
                              <span className="w-1.5 h-1.5 rounded-full bg-primary flex-shrink-0" />
                            )}
                            {p.nom}
                          </button>
                          <span className="text-center text-muted-foreground whitespace-nowrap">
                            {p.prix.toLocaleString()} XAF
                          </span>
                          <span className="text-right font-bold text-success text-base">
                            {qty}
                          </span>
                          <button
                            onClick={() => setEditingProduit(p)}
                            className="p-1.5 rounded-lg hover:bg-primary/10 text-muted-foreground hover:text-primary transition-colors"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      );
                    })}
                  </div>

                  <div className="grid grid-cols-[1fr_auto_auto_auto] px-4 py-3 bg-success/10 border-t border-success/20 text-sm font-semibold gap-3">
                    <span className="text-muted-foreground">Total</span>
                    <span />
                    <span />
                    <span className="text-right text-success text-base">
                      {totalInventaire} unités
                    </span>
                  </div>
                </div>

                <p className="text-xs text-muted-foreground text-center">
                  Appuyez sur ✏️ pour modifier • Appuyez sur le nom pour naviguer
                </p>
              </div>
            )}
          </div>
        )}

        {/* ══ ÉTAPE 2 ══ */}
        {form.step === 2 && (
          <div className="space-y-6">
            <div className="p-4 rounded-lg bg-muted/50 space-y-2">
              <h3 className="font-medium">Résumé de l'inventaire</h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Produits remplis</span>
                  <p className="font-medium text-lg">
                    {produitsRemplis}/{produits.length}
                  </p>
                </div>
                <div>
                  <span className="text-muted-foreground">Total unités</span>
                  <p className="font-medium text-lg text-primary">{totalInventaire}</p>
                </div>
              </div>

              {produitsRemplisList.length > 0 && (
                <div className="mt-4 rounded-xl border border-border overflow-hidden">
                  <div className="grid grid-cols-[1fr_auto_auto_auto] px-3 py-2 bg-muted/50 text-xs font-semibold text-muted-foreground uppercase tracking-wide gap-3">
                    <span>Produit</span>
                    <span className="text-center">Prix unit.</span>
                    <span className="text-right">Qté</span>
                    <span />
                  </div>
                  <div className="divide-y divide-border">
                    {produitsRemplisList.map((p) => {
                      const qty = form.produits[p.id] || 0;
                      return (
                        <div
                          key={p.id}
                          className="grid grid-cols-[1fr_auto_auto_auto] px-3 py-2.5 text-sm items-center gap-3"
                        >
                          <span className="font-medium truncate">{p.nom}</span>
                          <span className="text-center text-muted-foreground">
                            {p.prix.toLocaleString()} XAF
                          </span>
                          <span className="text-right font-bold text-primary">{qty}</span>
                          <button
                            onClick={() => setEditingProduit(p)}
                            className="p-1.5 rounded-lg hover:bg-primary/10 text-muted-foreground hover:text-primary transition-colors"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-3">
              <Label className="text-center block">Votre code PIN (sortant)</Label>
              <PINInput
                value={form.pin_sortant}
                onChange={(v) => setFormField('pin_sortant', v)}
              />
            </div>

            <div className="space-y-3">
              <Label className="text-center block">Code PIN du vendeur entrant</Label>
              <PINInput
                value={form.pin_entrant}
                onChange={(v) => setFormField('pin_entrant', v)}
              />
            </div>

            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={() => setFormField('step', 1)}
                className="flex-1"
              >
                Retour
              </Button>
              <Button
                onClick={handleValidate}
                disabled={
                  isSubmitting ||
                  form.pin_sortant.length !== 6 ||
                  form.pin_entrant.length !== 6
                }
                className="btn-golden flex-1"
              >
                {isSubmitting ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  "Valider l'inventaire"
                )}
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Modale édition quantité */}
      {editingProduit && (
        <EditQuantityModal
          produit={editingProduit}
          currentValue={form.produits[editingProduit.id] || 0}
          onConfirm={(val) =>
            setForm((prev) => ({
              ...prev,
              produits: { ...prev.produits, [editingProduit.id]: val },
            }))
          }
          onClose={() => setEditingProduit(null)}
        />
      )}
    </div>
  );
}