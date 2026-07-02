/**
 * ReceptionScreen.tsx
 *
 * Corrections UI/UX :
 * 1. Bouton FAB → top-[4.5rem] right-4, toujours visible, animation attention quand valide
 * 2. Champ producteur caché (valeur par défaut conservée)
 * 3. Select produit → modal overlay centré en haut
 */

import React, { useState, useEffect, useRef } from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { NumericInput } from '@/components/NumericInput';
import { CategoryBadge } from '@/components/CategoryBadge';
import {
  Package,
  User,
  Check,
  Loader2,
  AlertTriangle,
  CalendarDays,
  Clock,
  Filter,
  PackageCheck,
  Search,
  X,
  ChevronRight,
} from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import {
  getDB,
  generateLocalId,
  type Produit,
  type User as DBUser,
  type ReceptionPointeur,
} from '@/lib/db';
import { todayLocalISO, PrixBadge } from './PointeurModals';

interface ReceptionScreenProps {
  user: { id: number; name: string; role: string };
  produits: Produit[];
  producteurs: DBUser[];
  vendeurs: DBUser[];
  vendeurActif: { boulangerie?: DBUser; patisserie?: DBUser };
  onVendeurChange: (category: 'boulangerie' | 'patisserie') => void;
  onRecorded: () => void;
  filterDate?: string;
  onFilterDateChange?: (date: string) => void;
}

// ─── Modal de sélection de produit centré ─────────────────────────────────────
interface ProduitSelectModalProps {
  isOpen: boolean;
  produits: Produit[];
  value: number | null;
  onSelect: (id: number) => void;
  onClose: () => void;
}

function ProduitSelectModal({
  isOpen,
  produits,
  value,
  onSelect,
  onClose,
}: ProduitSelectModalProps) {
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const filtered = produits.filter(
    p =>
      p.nom.toLowerCase().includes(query.toLowerCase()) ||
      p.categorie.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div
      className="fixed inset-0 z-[70] flex items-start justify-center pt-16 px-4 bg-black/50 backdrop-blur-sm"
      onClick={e => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-background rounded-2xl shadow-2xl w-full max-w-md border border-border overflow-hidden flex flex-col max-h-[75vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <h3 className="font-semibold text-base text-foreground">
            Sélectionner un produit
          </h3>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded-lg hover:bg-muted"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Search */}
        <div className="px-4 py-3 border-b border-border">
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-muted/50 border border-border focus-within:border-primary focus-within:ring-1 focus-within:ring-primary/30 transition-all">
            <Search className="w-4 h-4 text-muted-foreground flex-shrink-0" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Rechercher un produit..."
              className="flex-1 bg-transparent text-sm outline-none text-foreground placeholder:text-muted-foreground"
            />
            {query && (
              <button
                onClick={() => setQuery('')}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Liste */}
        <div className="overflow-y-auto flex-1">
          {filtered.length === 0 ? (
            <div className="py-10 text-center text-sm text-muted-foreground">
              Aucun produit trouvé
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {filtered.map(p => (
                <li key={p.id}>
                  <button
                    onClick={() => {
                      onSelect(p.id);
                      onClose();
                    }}
                    className={`
                      w-full flex items-center gap-3 px-4 py-3.5 text-left
                      hover:bg-muted/50 transition-colors
                      ${value === p.id
                        ? 'bg-primary/5 border-l-2 border-primary'
                        : ''}
                    `}
                  >
                    <CategoryBadge category={p.categorie} size="sm" />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm text-foreground truncate">
                        {p.nom}
                      </p>
                      <p className="text-xs text-muted-foreground capitalize">
                        {p.categorie}
                      </p>
                    </div>
                    <span className="text-base font-bold text-amber-600 dark:text-amber-400 tabular-nums flex-shrink-0">
                      {p.prix.toLocaleString('fr-FR')}
                      <span className="text-xs font-normal ml-0.5">XAF</span>
                    </span>
                    {value === p.id && (
                      <Check className="w-4 h-4 text-primary flex-shrink-0" />
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── ReceptionScreen ──────────────────────────────────────────────────────────

export default function ReceptionScreen({
  user,
  produits,
  producteurs,
  vendeurs,
  vendeurActif,
  onVendeurChange,
  onRecorded,
  filterDate = todayLocalISO(),
  onFilterDateChange,
}: ReceptionScreenProps) {
  const [form, setForm] = useState({
    producteur_id: 1 as number,
    produit_id: null as number | null,
    quantite: null as number | null,
    notes: '',
    date_reception: todayLocalISO(),
    heure_reception: format(new Date(), 'HH:mm'),
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [produitModalOpen, setProduitModalOpen] = useState(false);

  const selectedProduit = produits.find(p => p.id === form.produit_id);

  const getVendeurAssigne = (produitId: number | null) => {
    if (!produitId) return null;
    const produit = produits.find(p => p.id === produitId);
    if (!produit) return null;
    return produit.categorie === 'boulangerie'
      ? vendeurActif.boulangerie
      : vendeurActif.patisserie;
  };

  const vendeurAssigne = getVendeurAssigne(form.produit_id);

  const isFormValid =
    !!form.produit_id &&
    (form.quantite ?? 0) > 0 &&
    !!vendeurAssigne &&
    !isSubmitting;

  const handleSubmit = async () => {
    const qty = form.quantite ?? 0;
    if (!form.produit_id || qty <= 0) {
      toast.error('Veuillez remplir tous les champs obligatoires');
      return;
    }
    if (!vendeurAssigne) {
      toast.error('Aucun vendeur actif pour cette catégorie');
      return;
    }

    setIsSubmitting(true);
    try {
      const db = await getDB();
      const now = new Date().toISOString();
      const dateReception = new Date(
        `${form.date_reception}T${form.heure_reception}:00`
      ).toISOString();

      const reception: ReceptionPointeur = {
        local_id: generateLocalId(),
        pointeur_id: user.id,
        producteur_id: form.producteur_id,
        produit_id: form.produit_id,
        quantite: qty,
        vendeur_assigne_id: vendeurAssigne.id,
        verrou: false,
        date_reception: dateReception,
        notes: form.notes || undefined,
        sync_status: 'pending',
        created_at: now,
        updated_at: now,
      };

      await db.add('receptions_pointeur', reception);

      toast.success(`✅ ${qty} × ${selectedProduit?.nom}`, {
        description: selectedProduit
          ? `Prix unitaire : ${selectedProduit.prix.toLocaleString('fr-FR')} XAF — Vendeur : ${vendeurAssigne.name}`
          : `Vendeur : ${vendeurAssigne.name}`,
        duration: 4000,
      });

      setForm({
        producteur_id: 1,
        produit_id: null,
        quantite: null,
        notes: '',
        date_reception: todayLocalISO(),
        heure_reception: format(new Date(), 'HH:mm'),
      });

      onRecorded();
    } catch (error) {
      console.error('Erreur réception:', error);
      toast.error("Erreur lors de l'enregistrement");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in pb-28">

      {/* Keyframes animation FAB */}
      <style>{`
        @keyframes fab-pulse-primary {
          0%, 100% { box-shadow: 0 4px 18px rgba(var(--color-primary-rgb, 59,130,246),0.30); transform: translateY(0px); }
          35%       { box-shadow: 0 8px 28px rgba(var(--color-primary-rgb, 59,130,246),0.55); transform: translateY(-3px); }
          65%       { box-shadow: 0 5px 20px rgba(var(--color-primary-rgb, 59,130,246),0.38); transform: translateY(-1px); }
        }
      `}</style>

      {/* ────────────────────────────────────────────────
          BOUTON FLOTTANT — haut droite, toujours présent
          Animation quand le formulaire est valide
      ──────────────────────────────────────────────── */}
      <div className="fixed top-[4.5rem] right-4 z-50">
        <button
          onClick={handleSubmit}
          disabled={isSubmitting}
          aria-label="Enregistrer la réception"
          style={
            isFormValid
              ? { animation: 'fab-pulse-primary 2.8s ease-in-out infinite' }
              : {}
          }
          className={`
            flex items-center gap-2 px-5 py-3
            text-white font-bold text-sm
            rounded-2xl shadow-xl
            transition-colors duration-300
            ${isFormValid
              ? 'bg-primary hover:bg-primary/90 active:bg-primary/80 active:scale-95 border-2 border-primary/40 cursor-pointer'
              : 'bg-primary/40 dark:bg-primary/20 border-2 border-primary/20 opacity-55 cursor-not-allowed'
            }
          `}
        >
          {isSubmitting ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Check className="w-4 h-4" />
          )}
          <span>Enregistrer réception</span>
        </button>
      </div>

      {/* ── Bandeau RÉCEPTION ── */}
      <div className="flex items-center gap-3 px-5 py-4 rounded-2xl bg-primary text-primary-foreground shadow-lg">
        <div className="flex items-center justify-center w-11 h-11 rounded-xl bg-white/20">
          <PackageCheck className="w-6 h-6" />
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest opacity-80">
            Mode actif
          </p>
          <p className="text-xl font-display font-bold leading-tight">
            Enregistrement RÉCEPTION
          </p>
        </div>
      </div>

      <div className="card-premium p-6">
        <h2 className="font-display text-xl font-semibold mb-5 flex items-center gap-2">
          <Package className="w-5 h-5 text-primary" />
          Nouvelle réception
        </h2>

        {/* ── Vendeur actif du jour ── */}
        <div className="mb-6">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
            Vendeur actif du jour —{' '}
            <span className="text-primary">cliquez pour modifier</span>
          </p>
          <div className="flex flex-wrap gap-2">
            {vendeurActif.patisserie ? (
              <button
                onClick={() => onVendeurChange('patisserie')}
                className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-pink-500/10 border-2 border-pink-500/30 hover:bg-pink-500/20 hover:border-pink-500/50 transition-all cursor-pointer shadow-sm animate-pulse"
                title="Cliquez pour changer le vendeur pâtisserie"
              >
                <User className="w-4 h-4 text-pink-600" />
                <span className="text-xs font-semibold text-pink-700 dark:text-pink-300">
                  Pâtisserie
                </span>
                <span className="text-sm font-bold text-pink-800 dark:text-pink-200 underline decoration-dotted underline-offset-4">
                  {vendeurActif.patisserie.name}
                </span>
                <span className="ml-1 text-xs text-pink-600">(changer)</span>
              </button>
            ) : (
              <button
                onClick={() => onVendeurChange('patisserie')}
                className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-amber-100 border-2 border-amber-400 hover:bg-amber-200 transition-all cursor-pointer shadow-sm dark:bg-amber-950/30 dark:border-amber-600 animate-pulse"
                title="Définir un vendeur pâtisserie"
              >
                <AlertTriangle className="w-5 h-5 text-amber-600" />
                <span className="text-sm font-medium text-amber-800 dark:text-amber-200">
                  Pâtisserie : non défini — Cliquez pour choisir
                </span>
              </button>
            )}
          </div>
        </div>

        {/* ── Filtre par date ── */}
        {onFilterDateChange && (
          <div className="mb-6 p-4 rounded-xl bg-muted/30 border border-border">
            <Label className="flex items-center gap-2 mb-2">
              <Filter className="w-4 h-4" />
              Filtrer les réceptions par date
            </Label>
            <Input
              type="date"
              value={filterDate}
              max={todayLocalISO()}
              onChange={e => onFilterDateChange(e.target.value)}
              className="w-full md:w-64"
            />
          </div>
        )}

        {/* ── Producteur CACHÉ — valeur par défaut conservée ── */}
        <div className="hidden" aria-hidden="true">
          <input type="hidden" name="producteur_id" value={form.producteur_id} />
        </div>

        {/* ── Produit — bouton déclenchant le modal centré ── */}
        <div className="space-y-2 mb-4">
          <Label>Produit *</Label>

          <button
            type="button"
            onClick={() => setProduitModalOpen(true)}
            className={`
              w-full flex items-center justify-between gap-3
              px-4 py-3 rounded-xl border text-left
              transition-all duration-150
              ${selectedProduit
                ? 'border-primary/40 bg-primary/5 dark:bg-primary/10'
                : 'border-border bg-background hover:border-primary/40 hover:bg-muted/30'
              }
            `}
          >
            <div className="flex items-center gap-2 min-w-0">
              {selectedProduit ? (
                <>
                  <CategoryBadge category={selectedProduit.categorie} size="sm" />
                  <span className="font-medium text-sm text-foreground truncate">
                    {selectedProduit.nom}
                  </span>
                </>
              ) : (
                <>
                  <Search className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">
                    Rechercher un produit...
                  </span>
                </>
              )}
            </div>
            <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
          </button>

          {selectedProduit && (
            <div className="flex items-center gap-3 mt-2 p-4 rounded-xl border-2 border-amber-400 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-600">
              <CategoryBadge category={selectedProduit.categorie} size="md" />
              <span className="font-semibold text-lg flex-1">{selectedProduit.nom}</span>
              <span className="text-2xl font-bold text-amber-700 dark:text-amber-300 tracking-tight">
                {selectedProduit.prix.toLocaleString('fr-FR')} XAF
              </span>
            </div>
          )}
        </div>

        {/* ── Quantité ── */}
        <div className="space-y-2 mb-4">
          <Label>Quantité *</Label>
          <NumericInput
            value={form.quantite}
            onChange={v => setForm({ ...form, quantite: v })}
            min={0}
            max={9999}
            size="lg"
          />
        </div>

        {/* ── Date + Heure ── */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="space-y-2">
            <Label className="flex items-center gap-1">
              <CalendarDays className="w-4 h-4" />
              Date de réception
            </Label>
            <Input
              type="date"
              value={form.date_reception}
              max={todayLocalISO()}
              onChange={e => setForm({ ...form, date_reception: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label className="flex items-center gap-1">
              <Clock className="w-4 h-4" />
              Heure
            </Label>
            <Input
              type="time"
              value={form.heure_reception}
              onChange={e => setForm({ ...form, heure_reception: e.target.value })}
            />
          </div>
        </div>

        {/* ── Notes ── */}
        <div className="space-y-2 mb-6">
          <Label>Notes (optionnel)</Label>
          <Textarea
            value={form.notes}
            onChange={e => setForm({ ...form, notes: e.target.value })}
            placeholder="Ajouter une note..."
            className="resize-none"
            rows={2}
          />
        </div>

        {/* ── Vendeur assigné automatiquement ── */}
        {vendeurAssigne && selectedProduit && (
          <div className="p-4 rounded-xl bg-success/10 border border-success/30 mb-6 animate-scale-in">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-success/20 flex items-center justify-center">
                <User className="w-5 h-5 text-success" />
              </div>
              <div className="flex-1">
                <p className="text-sm text-success font-medium">
                  Vendeur assigné automatiquement
                </p>
                <p className="font-semibold">{vendeurAssigne.name}</p>
              </div>
              <CategoryBadge category={selectedProduit.categorie} size="md" />
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  selectedProduit && onVendeurChange(selectedProduit.categorie)
                }
              >
                Changer
              </Button>
            </div>
          </div>
        )}

        {!vendeurAssigne && form.produit_id && (
          <div className="p-4 rounded-xl bg-destructive/10 border border-destructive/30 mb-6">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-destructive" />
              <p className="text-sm text-destructive font-medium">
                Aucun vendeur actif pour cette catégorie. Définissez-en un en haut.
              </p>
            </div>
          </div>
        )}

        {/* ── Bouton submit inline ── */}
        <Button
          onClick={handleSubmit}
          disabled={!isFormValid}
          className="btn-golden w-full h-12 text-base font-semibold"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin mr-2" />
              <span>Enregistrement...</span>
            </>
          ) : (
            <>
              <Check className="w-5 h-5 mr-2" />
              <span>Enregistrer la réception</span>
            </>
          )}
        </Button>
      </div>

      {/* ── Modal de sélection produit centré ── */}
      <ProduitSelectModal
        isOpen={produitModalOpen}
        produits={produits}
        value={form.produit_id}
        onSelect={id => setForm({ ...form, produit_id: id })}
        onClose={() => setProduitModalOpen(false)}
      />
    </div>
  );
}