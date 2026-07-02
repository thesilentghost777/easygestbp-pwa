/**
 * PointeurModals.tsx — Modals et helpers partagés du dashboard Pointeur
 *
 * AJOUT UI/UX : MorningCheckModal
 * - Affiche un message de bienvenue au pointeur dès la connexion
 * - Demande s'il a déjà pointé les retours d'hier
 * - OUI → ferme le modal
 * - NON → redemande (modal reste ouvert avec message insistant)
 *
 * Logique existante : inchangée.
 */

import React, { useState, useEffect } from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { SearchableSelect } from '@/components/SearchableSelect';
import { NumericInput } from '@/components/NumericInput';
import { PINInput } from '@/components/PINInput';
import { Tag, User, Loader2, X, Sun, AlertTriangle, RotateCcw } from 'lucide-react';
import { format } from 'date-fns';
import {
  getDB,
  getRaisonsRetour,
  type Produit,
  type User as DBUser,
  type RetourProduit,
  type ReceptionPointeur,
  type RaisonRetour,
} from '@/lib/db';

// ─── Helpers date ──────────────────────────────────────────────────────────────
export function parseDate(dateStr: string | null | undefined): Date | null {
  if (!dateStr) return null;
  try {
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? null : d;
  } catch {
    return null;
  }
}

export function todayLocalISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate()
  ).padStart(2, '0')}`;
}

// ─── raisonLabels : fallback statique ────────────────────────────────────────
export const raisonLabels: Record<string, string> = {
  perime: 'Périmé',
  abime: 'Abîmé',
  autre: 'Autre',
};

export function resolveLibelle(code: string, raisons: RaisonRetour[]): string {
  const found = raisons.find(r => r.code === code);
  return found?.libelle ?? raisonLabels[code] ?? code;
}

// ─── PrixBadge ────────────────────────────────────────────────────────────────
export function PrixBadge({ prix }: { prix: number }) {
  return (
    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg font-bold text-sm bg-amber-500 text-white shadow-sm">
      <Tag className="w-3.5 h-3.5" />
      {prix.toLocaleString('fr-FR')} XAF
    </span>
  );
}

// ─── RaisonSelect ─────────────────────────────────────────────────────────────
interface RaisonSelectProps {
  value: string;
  onChange: (code: string) => void;
  mode?: 'buttons' | 'select';
  disabled?: boolean;
}

export function RaisonSelect({
  value,
  onChange,
  mode = 'buttons',
  disabled = false,
}: RaisonSelectProps) {
  const [raisons, setRaisons] = useState<RaisonRetour[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getRaisonsRetour().then(r => {
      setRaisons(r);
      setLoading(false);
    });
  }, []);

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground text-sm">
        <Loader2 className="w-4 h-4 animate-spin" />
        <span>Chargement des raisons...</span>
      </div>
    );
  }

  if (mode === 'select') {
    return (
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        disabled={disabled}
        className="h-9 rounded-md border border-input bg-background px-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
      >
        {raisons.map(r => (
          <option key={r.code} value={r.code}>
            {r.libelle}
          </option>
        ))}
      </select>
    );
  }

  return (
    <div className="grid grid-cols-3 gap-2">
      {raisons.map(r => (
        <button
          key={r.code}
          type="button"
          disabled={disabled}
          onClick={() => onChange(r.code)}
          className={`p-3 rounded-lg border-2 text-center transition-all ${
            value === r.code
              ? 'border-primary bg-primary/5 font-semibold'
              : 'border-border hover:border-primary/50'
          } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          <span className="text-sm">{r.libelle}</span>
        </button>
      ))}
    </div>
  );
}

// ─── Hook useRaisons ──────────────────────────────────────────────────────────
export function useRaisons(): RaisonRetour[] {
  const [raisons, setRaisons] = useState<RaisonRetour[]>([]);
  useEffect(() => {
    getRaisonsRetour().then(setRaisons);
  }, []);
  return raisons;
}

// ─── Types modals ─────────────────────────────────────────────────────────────
export interface EditFormState {
  quantite: number | null;
  notes: string;
  raison: string;
  description: string;
  date: string;
  heure: string;
  vendeur_id: number | null;
}

export interface EditModalState {
  isOpen: boolean;
  type: 'reception' | 'retour' | null;
  item: ReceptionPointeur | RetourProduit | null;
}

export interface DeleteModalState {
  isOpen: boolean;
  type: 'reception' | 'retour' | null;
  item: ReceptionPointeur | RetourProduit | null;
}

export interface VendeurSelectionModalState {
  isOpen: boolean;
}

export interface ChangeSellerModalState {
  isOpen: boolean;
  category: 'boulangerie' | 'patisserie' | null;
}

// ─── MorningCheckModal ────────────────────────────────────────────────────────
/**
 * Affiché une seule fois au login du pointeur.
 * Demande s'il a déjà pointé les retours d'hier.
 * - OUI → onConfirm() → ferme
 * - NON → reste ouvert, redemande avec message insistant
 */
export interface MorningCheckModalState {
  isOpen: boolean;
}

interface MorningCheckModalProps {
  state: MorningCheckModalState;
  userName: string;
  onConfirm: () => void; // utilisateur a dit OUI
  onGoToRetours: () => void; // redirige vers retour-hier et ferme
}

export function MorningCheckModal({
  state,
  userName,
  onConfirm,
  onGoToRetours,
}: MorningCheckModalProps) {
  const [refused, setRefused] = useState(false);

  // Reset chaque fois que le modal s'ouvre
  useEffect(() => {
    if (state.isOpen) setRefused(false);
  }, [state.isOpen]);

  if (!state.isOpen) return null;

  const prenom = userName.split(' ')[0];

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div
        className={`
          bg-background rounded-3xl shadow-2xl w-full max-w-sm p-7 space-y-6
          border-2 transition-all duration-300
          ${refused ? 'border-orange-400' : 'border-primary/30'}
        `}
      >
        {/* ── Icône + Bonjour ── */}
        <div className="flex flex-col items-center text-center gap-3">
          <div
            className={`
              flex items-center justify-center w-20 h-20 rounded-full
              ${refused
                ? 'bg-orange-100 dark:bg-orange-950/40'
                : 'bg-primary/10'
              }
              transition-colors duration-300
            `}
          >
            {refused ? (
              <AlertTriangle className="w-10 h-10 text-orange-500" />
            ) : (
              <Sun className="w-10 h-10 text-yellow-500" />
            )}
          </div>

          {!refused ? (
            <>
              <h2 className="font-display text-2xl font-bold leading-snug">
                Bonjour {prenom}&nbsp;! 👋
              </h2>
              <p className="text-base text-muted-foreground leading-relaxed">
                Si vous êtes le <strong>pointeur du matin</strong>, avez-vous
                déjà pointé les{' '}
                <span className="font-semibold text-foreground">
                  retours d'hier&nbsp;?
                </span>
              </p>
            </>
          ) : (
            <>
              <h2 className="font-display text-xl font-bold text-orange-600 dark:text-orange-400 leading-snug">
                Attention&nbsp;!
              </h2>
              <p className="text-base text-muted-foreground leading-relaxed">
                Les retours d'hier <strong>doivent être pointés</strong> avant de
                commencer les nouvelles réceptions. Voulez-vous les faire
                maintenant&nbsp;?
              </p>
            </>
          )}
        </div>

        {/* ── Boutons ── */}
        {!refused ? (
          <div className="flex gap-3">
            {/* NON */}
            <button
              onClick={() => setRefused(true)}
              className="
                flex-1 py-3.5 rounded-2xl
                bg-red-50 dark:bg-red-950/30
                border-2 border-red-300 dark:border-red-700
                text-red-700 dark:text-red-400
                font-bold text-base
                hover:bg-red-100 dark:hover:bg-red-950/50
                transition-all duration-200 active:scale-95
              "
            >
              NON
            </button>
            {/* OUI */}
            <button
              onClick={onConfirm}
              className="
                flex-1 py-3.5 rounded-2xl
                bg-primary text-primary-foreground
                font-bold text-base
                hover:bg-primary/90
                shadow-md
                transition-all duration-200 active:scale-95
              "
            >
              OUI ✓
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {/* Aller pointer maintenant */}
            <button
              onClick={onGoToRetours}
              className="
                w-full py-3.5 rounded-2xl
                bg-orange-500 hover:bg-orange-600
                text-white font-bold text-base
                flex items-center justify-center gap-2
                shadow-md transition-all duration-200 active:scale-95
              "
            >
              <RotateCcw className="w-5 h-5" />
              Pointer les retours d'hier maintenant
            </button>
            {/* Quand même passer (re-demande à la prochaine navigation) */}
            <button
              onClick={() => setRefused(false)}
              className="
                w-full py-2.5 rounded-2xl
                bg-muted hover:bg-muted/80
                text-muted-foreground font-medium text-sm
                transition-all duration-200
              "
            >
              ← Retour à la question
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── EditModal ─────────────────────────────────────────────────────────────────
interface EditModalProps {
  state: EditModalState;
  form: EditFormState;
  vendeurs: DBUser[];
  produits: Produit[];
  isSubmitting: boolean;
  onFormChange: (form: EditFormState) => void;
  onSave: (pin: string) => void;
  onClose: () => void;
}

export function EditModal({
  state,
  form,
  vendeurs,
  produits,
  isSubmitting,
  onFormChange,
  onSave,
  onClose,
}: EditModalProps) {
  const [pin, setPin] = useState('');

  useEffect(() => {
    if (!state.isOpen) setPin('');
  }, [state.isOpen]);

  if (!state.isOpen || !state.item) return null;

  const produit =
    state.type === 'retour'
      ? produits.find(p => p.id === (state.item as RetourProduit).produit_id)
      : produits.find(p => p.id === (state.item as ReceptionPointeur).produit_id);

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-background rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <h3 className="font-display text-lg font-semibold">
            Modifier le {state.type === 'retour' ? 'retour' : 'réception'}
          </h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="w-5 h-5" />
          </button>
        </div>

        {produit && (
          <div className="flex items-center gap-2 p-3 rounded-xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800">
            <Tag className="w-4 h-4 text-amber-500" />
            <span className="font-semibold">{produit.nom}</span>
            <span className="ml-auto font-bold text-amber-600">
              {produit.prix.toLocaleString('fr-FR')} XAF
            </span>
          </div>
        )}

        <div className="space-y-2">
          <Label>Quantité</Label>
          <NumericInput
            value={form.quantite}
            onChange={v => onFormChange({ ...form, quantite: v })}
            min={0}
            max={9999}
          />
        </div>

        {state.type === 'retour' && (
          <div className="space-y-2">
            <Label>Raison</Label>
            <RaisonSelect
              value={form.raison}
              onChange={r => onFormChange({ ...form, raison: r })}
              mode="buttons"
            />
          </div>
        )}

        {state.type === 'retour' && (
          <div className="space-y-2">
            <Label>Description</Label>
            <Input
              value={form.description}
              onChange={e => onFormChange({ ...form, description: e.target.value })}
              placeholder="Détails..."
            />
          </div>
        )}

        {state.type === 'reception' && (
          <div className="space-y-2">
            <Label>Notes</Label>
            <Input
              value={form.notes}
              onChange={e => onFormChange({ ...form, notes: e.target.value })}
              placeholder="Notes..."
            />
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label>Date</Label>
            <Input
              type="date"
              value={form.date}
              max={todayLocalISO()}
              onChange={e => onFormChange({ ...form, date: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label>Heure</Label>
            <Input
              type="time"
              value={form.heure}
              onChange={e => onFormChange({ ...form, heure: e.target.value })}
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label>Code PIN pour confirmer</Label>
          <PINInput value={pin} onChange={setPin} length={6} autoFocus />
        </div>

        <div className="flex gap-3 pt-2">
          <Button
            variant="outline"
            className="flex-1"
            onClick={onClose}
            disabled={isSubmitting}
          >
            Annuler
          </Button>
          <Button
            className="flex-1"
            onClick={() => onSave(pin)}
            disabled={isSubmitting || pin.length < 4}
          >
            {isSubmitting ? (
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
            ) : null}
            Sauvegarder
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── DeleteModal ───────────────────────────────────────────────────────────────
interface DeleteModalProps {
  state: DeleteModalState;
  produits: Produit[];
  vendeurs: DBUser[];
  isSubmitting: boolean;
  onConfirm: (pin: string) => void;
  onClose: () => void;
}

export function DeleteModal({
  state,
  produits,
  vendeurs,
  isSubmitting,
  onConfirm,
  onClose,
}: DeleteModalProps) {
  const [pin, setPin] = useState('');

  useEffect(() => {
    if (!state.isOpen) setPin('');
  }, [state.isOpen]);

  if (!state.isOpen || !state.item) return null;

  const produit =
    state.type === 'retour'
      ? produits.find(p => p.id === (state.item as RetourProduit).produit_id)
      : produits.find(p => p.id === (state.item as ReceptionPointeur).produit_id);

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-background rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-display text-lg font-semibold text-destructive">
            Supprimer cet enregistrement ?
          </h3>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {produit && (
          <div className="p-3 rounded-xl bg-destructive/10 border border-destructive/30">
            <p className="font-semibold">{produit.nom}</p>
            <p className="text-sm text-muted-foreground">
              {state.type === 'retour'
                ? `${(state.item as RetourProduit).quantite} unité(s) — ${
                    (state.item as RetourProduit).raison
                  }`
                : `${(state.item as ReceptionPointeur).quantite} unité(s)`}
            </p>
          </div>
        )}

        <p className="text-sm text-muted-foreground">
          Cette action est irréversible. Entrez votre code PIN pour confirmer.
        </p>

        <div className="space-y-2">
          <Label>Code PIN</Label>
          <PINInput value={pin} onChange={setPin} length={6} autoFocus />
        </div>

        <div className="flex gap-3 pt-2">
          <Button
            variant="outline"
            className="flex-1"
            onClick={onClose}
            disabled={isSubmitting}
          >
            Annuler
          </Button>
          <Button
            variant="destructive"
            className="flex-1"
            onClick={() => onConfirm(pin)}
            disabled={isSubmitting || pin.length < 4}
          >
            {isSubmitting ? (
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
            ) : null}
            Supprimer
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── VendeurSelectionModal ─────────────────────────────────────────────────────
interface VendeurSelectionModalProps {
  state: VendeurSelectionModalState;
  vendeurs: DBUser[];
  currentVendeurActif: { boulangerie?: DBUser; patisserie?: DBUser };
  onConfirm: (boulangerie_id: number | null, patisserie_id: number | null) => void;
}

export function VendeurSelectionModal({
  state,
  vendeurs,
  currentVendeurActif,
  onConfirm,
}: VendeurSelectionModalProps) {
  const [boulId, setBoulId] = useState<number | null>(
    currentVendeurActif.boulangerie?.id ?? null
  );
  const [patId, setPatId] = useState<number | null>(
    currentVendeurActif.patisserie?.id ?? null
  );

  if (!state.isOpen) return null;

  const vendeursBoula = vendeurs.filter(v => v.role === 'vendeur_boulangerie');
  const vendeursPat = vendeurs.filter(v => v.role === 'vendeur_patisserie');

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-background rounded-2xl shadow-xl w-full max-w-md p-6 space-y-5">
        <h3 className="font-display text-lg font-semibold">
          Vendeurs actifs du jour
        </h3>
        <p className="text-sm text-muted-foreground">
          Sélectionnez les vendeurs en poste pour cette journée.
        </p>

        <div className="space-y-3">
          <div>
            <Label className="mb-2 flex items-center gap-1">
              <User className="w-4 h-4 text-amber-500" />
              Boulangerie
            </Label>
            <SearchableSelect
              options={vendeursBoula.map(v => ({
                value: v.id,
                label: v.name,
                description: v.numero_telephone,
              }))}
              value={boulId}
              onChange={v => setBoulId(v as number)}
              placeholder="Vendeur boulangerie..."
            />
          </div>
          <div>
            <Label className="mb-2 flex items-center gap-1">
              <User className="w-4 h-4 text-pink-500" />
              Pâtisserie
            </Label>
            <SearchableSelect
              options={vendeursPat.map(v => ({
                value: v.id,
                label: v.name,
                description: v.numero_telephone,
              }))}
              value={patId}
              onChange={v => setPatId(v as number)}
              placeholder="Vendeur pâtisserie..."
            />
          </div>
        </div>

        <Button
          className="w-full"
          onClick={() => onConfirm(boulId, patId)}
          disabled={!boulId && !patId}
        >
          Confirmer
        </Button>
      </div>
    </div>
  );
}

// ─── ChangeSellerModal ─────────────────────────────────────────────────────────
interface ChangeSellerModalProps {
  state: ChangeSellerModalState;
  vendeurs: DBUser[];
  currentVendeurActif: { boulangerie?: DBUser; patisserie?: DBUser };
  isSubmitting: boolean;
  onSave: (category: 'boulangerie' | 'patisserie', vendeurId: number) => void;
  onClose: () => void;
}

export function ChangeSellerModal({
  state,
  vendeurs,
  currentVendeurActif,
  isSubmitting,
  onSave,
  onClose,
}: ChangeSellerModalProps) {
  const [selectedId, setSelectedId] = useState<number | null>(null);

  useEffect(() => {
    if (state.isOpen && state.category) {
      setSelectedId(
        state.category === 'boulangerie'
          ? (currentVendeurActif.boulangerie?.id ?? null)
          : (currentVendeurActif.patisserie?.id ?? null)
      );
    }
  }, [state.isOpen, state.category, currentVendeurActif]);

  if (!state.isOpen || !state.category) return null;

  const filteredVendeurs = vendeurs.filter(
    v => v.role === `vendeur_${state.category}`
  );

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-background rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-display text-lg font-semibold capitalize">
            Changer le vendeur — {state.category}
          </h3>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <SearchableSelect
          options={filteredVendeurs.map(v => ({
            value: v.id,
            label: v.name,
            description: v.numero_telephone,
          }))}
          value={selectedId}
          onChange={v => setSelectedId(v as number)}
          placeholder={`Vendeur ${state.category}...`}
        />

        <div className="flex gap-3 pt-2">
          <Button
            variant="outline"
            className="flex-1"
            onClick={onClose}
            disabled={isSubmitting}
          >
            Annuler
          </Button>
          <Button
            className="flex-1"
            onClick={() => selectedId && onSave(state.category!, selectedId)}
            disabled={isSubmitting || !selectedId}
          >
            {isSubmitting ? (
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
            ) : null}
            Confirmer
          </Button>
        </div>
      </div>
    </div>
  );
}