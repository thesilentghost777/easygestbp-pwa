/**
 * RetourScreen.tsx
 *
 * Corrections UI/UX :
 * 1. Select produit → modal overlay centré en haut (même logique que ReceptionScreen)
 * 2. Bouton FAB → top-[4.5rem] right-4, toujours visible, animation attention quand valide
 */

import React, { useState, useEffect, useRef } from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { NumericInput } from '@/components/NumericInput';
import { CategoryBadge } from '@/components/CategoryBadge';
import {
  Undo2,
  User,
  Loader2,
  AlertTriangle,
  CalendarDays,
  Clock,
  ArrowLeftRight,
  ChevronRight,
  Search,
  Check,
  X,
} from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import {
  getDB,
  generateLocalId,
  getRaisonsRetour,
  type Produit,
  type User as DBUser,
  type RetourProduit,
  type RaisonRetour,
} from '@/lib/db';
import { todayLocalISO, RaisonSelect } from './PointeurModals';

interface RetourScreenProps {
  user: { id: number; name: string; role: string };
  produits: Produit[];
  vendeurs: DBUser[];
  vendeurActif: { boulangerie?: DBUser; patisserie?: DBUser };
  onVendeurChange: (category: 'boulangerie' | 'patisserie') => void;
  onRecorded: () => void;
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
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-muted/50 border border-border focus-within:border-red-400 focus-within:ring-1 focus-within:ring-red-400/30 transition-all">
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
                        ? 'bg-red-50 dark:bg-red-950/20 border-l-2 border-red-500'
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
                    <span className="text-base font-bold text-red-600 dark:text-red-400 tabular-nums flex-shrink-0">
                      {p.prix.toLocaleString('fr-FR')}
                      <span className="text-xs font-normal ml-0.5">XAF</span>
                    </span>
                    {value === p.id && (
                      <Check className="w-4 h-4 text-red-500 flex-shrink-0" />
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

// ─── RetourScreen ──────────────────────────────────────────────────────────────

export default function RetourScreen({
  user,
  produits,
  vendeurs,
  vendeurActif,
  onVendeurChange,
  onRecorded,
}: RetourScreenProps) {
  const [raisons, setRaisons] = useState<RaisonRetour[]>([]);

  useEffect(() => {
    getRaisonsRetour().then(r => {
      setRaisons(r);
      if (r.length > 0) setForm(prev => ({ ...prev, raison: r[0].code }));
    });
  }, []);

  const [form, setForm] = useState({
    produit_id: null as number | null,
    quantite: null as number | null,
    raison: 'perime',
    description: '',
    date_retour: todayLocalISO(),
    heure_retour: format(new Date(), 'HH:mm'),
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
  const raisonLibelle =
    raisons.find(r => r.code === form.raison)?.libelle ?? form.raison;

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
      const dateRetour = new Date(
        `${form.date_retour}T${form.heure_retour}:00`
      ).toISOString();

      const retour: RetourProduit = {
        local_id: generateLocalId(),
        pointeur_id: user.id,
        vendeur_id: vendeurAssigne.id,
        produit_id: form.produit_id,
        quantite: qty,
        raison: form.raison,
        description: form.description || undefined,
        verrou: false,
        date_retour: dateRetour,
        sync_status: 'pending',
        created_at: now,
        updated_at: now,
      };

      await db.add('retours_produits', retour);

      toast.success(`↩️ ${qty} × ${selectedProduit?.nom} retourné(s)`, {
        description: selectedProduit
          ? `Prix : ${selectedProduit.prix.toLocaleString('fr-FR')} XAF — Raison : ${raisonLibelle} — Vendeur : ${vendeurAssigne.name}`
          : `Vendeur : ${vendeurAssigne.name}`,
        duration: 4000,
      });

      setForm({
        produit_id: null,
        quantite: null,
        raison: raisons[0]?.code ?? 'perime',
        description: '',
        date_retour: todayLocalISO(),
        heure_retour: format(new Date(), 'HH:mm'),
      });

      onRecorded();
    } catch (error) {
      console.error('Erreur retour:', error);
      toast.error("Erreur lors de l'enregistrement");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-5 animate-fade-in pb-28">

      {/* Keyframes animation FAB */}
      <style>{`
        @keyframes fab-pulse-red {
          0%, 100% { box-shadow: 0 4px 18px rgba(220,38,38,0.30); transform: translateY(0px); }
          35%       { box-shadow: 0 8px 28px rgba(220,38,38,0.55); transform: translateY(-3px); }
          65%       { box-shadow: 0 5px 20px rgba(220,38,38,0.38); transform: translateY(-1px); }
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
          aria-label="Enregistrer le retour"
          style={
            isFormValid
              ? { animation: 'fab-pulse-red 2.8s ease-in-out infinite' }
              : {}
          }
          className={`
            flex items-center gap-2 px-5 py-3
            text-white font-bold text-sm
            rounded-2xl shadow-xl
            transition-colors duration-300
            ${isFormValid
              ? 'bg-red-600 hover:bg-red-700 active:bg-red-800 active:scale-95 cursor-pointer'
              : 'bg-red-300 dark:bg-red-900/40 opacity-55 cursor-not-allowed'
            }
          `}
        >
          {isSubmitting ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Undo2 className="w-4 h-4" />
          )}
          <span>Enregistrer retour</span>
        </button>
      </div>

      {/* ────────────────────────────────────────────────
          HEADER
      ──────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-1 pt-1">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-red-50 border border-red-100 dark:bg-red-950/30 dark:border-red-900">
            <ArrowLeftRight className="w-5 h-5 text-red-600 dark:text-red-400" />
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
              Mode actif
            </p>
            <p className="text-lg font-display font-bold leading-tight text-foreground">
              Enregistrement de retour
            </p>
          </div>
        </div>

        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-600 text-white text-xs font-bold uppercase tracking-wider shadow-sm">
          <span className="w-1.5 h-1.5 rounded-full bg-white/70 animate-pulse" />
          RETOUR
        </span>
      </div>

      {/* ────────────────────────────────────────────────
          CARTE PRINCIPALE
      ──────────────────────────────────────────────── */}
      <div className="relative rounded-2xl bg-white dark:bg-card border border-border shadow-sm overflow-hidden">
        <div className="absolute left-0 top-0 bottom-0 w-1 bg-red-600 rounded-l-2xl" />

        <div className="pl-6 pr-5 pt-5 pb-6 space-y-5">

          {/* Titre section */}
          <div className="flex items-center gap-2">
            <Undo2 className="w-4 h-4 text-red-600 dark:text-red-400 flex-shrink-0" />
            <h2 className="font-display text-base font-semibold text-foreground">
              Nouveau retour
            </h2>
            <div className="flex-1 h-px bg-red-100 dark:bg-red-900/40 ml-1" />
          </div>

          {/* ── Vendeur actif du jour ── */}
          <div>
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">
              Vendeur actif du jour
            </p>
            <div className="flex flex-wrap gap-2">
              {vendeurActif.patisserie ? (
                <button
                  onClick={() => onVendeurChange('patisserie')}
                  className="group flex items-center gap-2 px-3.5 py-2 rounded-lg bg-muted/50 border border-border hover:border-red-300 hover:bg-red-50/50 dark:hover:bg-red-950/20 transition-all cursor-pointer"
                  title="Cliquez pour changer le vendeur pâtisserie"
                >
                  <User className="w-3.5 h-3.5 text-muted-foreground group-hover:text-red-500 transition-colors" />
                  <span className="text-xs text-muted-foreground">Pâtisserie ·</span>
                  <span className="text-sm font-semibold text-foreground">
                    {vendeurActif.patisserie.name}
                  </span>
                  <span className="text-[10px] font-medium text-red-500 opacity-0 group-hover:opacity-100 transition-opacity">
                    Modifier
                  </span>
                  <ChevronRight className="w-3 h-3 text-muted-foreground/50 group-hover:text-red-500 transition-colors" />
                </button>
              ) : (
                <button
                  onClick={() => onVendeurChange('patisserie')}
                  className="flex items-center gap-2 px-3.5 py-2 rounded-lg bg-red-50 border border-red-200 hover:border-red-400 hover:bg-red-100/70 transition-all cursor-pointer dark:bg-red-950/20 dark:border-red-800"
                >
                  <AlertTriangle className="w-4 h-4 text-red-500" />
                  <span className="text-sm font-medium text-red-700 dark:text-red-300">
                    Pâtisserie : non défini
                  </span>
                  <span className="text-xs text-red-500 font-semibold underline underline-offset-2">
                    Choisir
                  </span>
                </button>
              )}
            </div>
          </div>

          <div className="h-px bg-border" />

          {/* ── Produit — bouton déclenchant le modal centré ── */}
          <div className="space-y-1.5">
            <Label className="text-sm font-semibold text-foreground flex items-center gap-1.5">
              Produit
              <span
                className="w-1.5 h-1.5 rounded-full bg-red-600 flex-shrink-0"
                title="Obligatoire"
              />
            </Label>

            <button
              type="button"
              onClick={() => setProduitModalOpen(true)}
              className={`
                w-full flex items-center justify-between gap-3
                px-4 py-3 rounded-xl border text-left
                transition-all duration-150
                ${selectedProduit
                  ? 'border-red-300 bg-red-50/50 dark:bg-red-950/10 dark:border-red-800'
                  : 'border-border bg-background hover:border-red-300 hover:bg-red-50/30'
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

            {/* Résumé produit sélectionné */}
            {selectedProduit && (
              <div className="flex items-center gap-3 mt-2 p-3.5 rounded-xl border border-border bg-muted/30 dark:bg-muted/10">
                <CategoryBadge category={selectedProduit.categorie} size="md" />
                <span className="font-medium text-sm flex-1 text-foreground">
                  {selectedProduit.nom}
                </span>
                <div className="flex items-center gap-1">
                  <span className="text-xs text-muted-foreground">Prix :</span>
                  <span className="text-base font-bold text-red-600 dark:text-red-400 tabular-nums">
                    {selectedProduit.prix.toLocaleString('fr-FR')}
                    <span className="text-xs font-medium ml-0.5">XAF</span>
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* ── Quantité ── */}
          <div className="space-y-1.5">
            <Label className="text-sm font-semibold text-foreground flex items-center gap-1.5">
              Quantité
              <span
                className="w-1.5 h-1.5 rounded-full bg-red-600 flex-shrink-0"
                title="Obligatoire"
              />
            </Label>
            <NumericInput
              value={form.quantite}
              onChange={v => setForm({ ...form, quantite: v })}
              min={0}
              max={9999}
              size="lg"
            />
          </div>

          {/* ── Raison ── */}
          <div className="space-y-1.5">
            <Label className="text-sm font-semibold text-foreground flex items-center gap-1.5">
              Raison du retour
              <span
                className="w-1.5 h-1.5 rounded-full bg-red-600 flex-shrink-0"
                title="Obligatoire"
              />
            </Label>
            <RaisonSelect
              value={form.raison}
              onChange={r => setForm({ ...form, raison: r })}
              mode="buttons"
            />
          </div>

          {/* ── Date + Heure ── */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-sm font-medium text-foreground flex items-center gap-1.5">
                <CalendarDays className="w-3.5 h-3.5 text-red-500" />
                Date du retour
              </Label>
              <Input
                type="date"
                value={form.date_retour}
                max={todayLocalISO()}
                onChange={e => setForm({ ...form, date_retour: e.target.value })}
                className="focus-visible:ring-red-500 focus-visible:border-red-400"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm font-medium text-foreground flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-red-500" />
                Heure
              </Label>
              <Input
                type="time"
                value={form.heure_retour}
                onChange={e => setForm({ ...form, heure_retour: e.target.value })}
                className="focus-visible:ring-red-500 focus-visible:border-red-400"
              />
            </div>
          </div>

          {/* ── Description ── */}
          <div className="space-y-1.5">
            <Label className="text-sm font-medium text-foreground">
              Description{' '}
              <span className="text-muted-foreground font-normal">(optionnel)</span>
            </Label>
            <Textarea
              value={form.description}
              onChange={e => setForm({ ...form, description: e.target.value })}
              placeholder="Détails supplémentaires..."
              className="resize-none focus-visible:ring-red-500 focus-visible:border-red-400"
              rows={2}
            />
          </div>

          {/* ── Vendeur assigné automatiquement ── */}
          {vendeurAssigne && selectedProduit && (
            <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 dark:bg-emerald-950/20 dark:border-emerald-800 animate-scale-in">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center flex-shrink-0">
                  <User className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                    Vendeur assigné automatiquement
                  </p>
                  <p className="font-semibold text-sm text-foreground truncate">
                    {vendeurAssigne.name}
                  </p>
                </div>
                <CategoryBadge category={selectedProduit.categorie} size="md" />
                <Button
                  variant="outline"
                  size="sm"
                  className="border-emerald-300 text-emerald-700 hover:bg-emerald-50 text-xs"
                  onClick={() =>
                    selectedProduit && onVendeurChange(selectedProduit.categorie)
                  }
                >
                  Changer
                </Button>
              </div>
            </div>
          )}

          {/* Alerte aucun vendeur */}
          {!vendeurAssigne && form.produit_id && (
            <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 dark:bg-red-950/20 dark:border-red-800">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0" />
                <p className="text-sm text-red-700 dark:text-red-400">
                  Aucun vendeur actif pour cette catégorie.
                </p>
              </div>
            </div>
          )}

          {/* ── Bouton submit inline ── */}
          <Button
            onClick={handleSubmit}
            disabled={!isFormValid}
            className="w-full h-11 text-sm font-semibold bg-red-600 hover:bg-red-700 active:bg-red-800 text-white border-0 shadow-sm transition-all"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
                Enregistrement...
              </>
            ) : (
              <>
                <Undo2 className="w-4 h-4 mr-2" />
                Enregistrer le retour
              </>
            )}
          </Button>
        </div>
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