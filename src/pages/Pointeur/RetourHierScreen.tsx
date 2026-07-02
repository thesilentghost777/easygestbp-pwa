/**
 * RetourHierScreen.tsx
 * Enregistrement des retours d'hier (jusqu'à 7 lignes produit+quantité).
 * - Raisons dynamiques depuis IDB
 * - Vendeur sélectionné isolément (ne modifie pas le vendeur actif global)
 * - Prix bien visible à côté de chaque produit
 */

import React, { useState, useEffect } from 'react';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { NumericInput } from '@/components/NumericInput';
import { SearchableSelect } from '@/components/SearchableSelect';
import { RotateCcw, User, Loader2, CalendarDays, Tag } from 'lucide-react';
import { format, subDays } from 'date-fns';
import { fr } from 'date-fns/locale';
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
import { resolveLibelle } from './PointeurModals';

interface RetourHierLigne {
  produit_id: number | null;
  quantite: number | null;
  raison: string; // code dynamique
}

function yesterdayLocalISO(): string {
  const d = subDays(new Date(), 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate()
  ).padStart(2, '0')}`;
}

function formatDateFr(iso: string): string {
  try {
    return format(new Date(iso + 'T12:00:00'), 'EEEE d MMMM yyyy', { locale: fr });
  } catch {
    return iso;
  }
}

interface RetourHierScreenProps {
  user: { id: number; name: string; role: string };
  produits: Produit[];
  vendeurs: DBUser[];
  defaultVendeurId?: number | null;
  onRecorded: () => void;
}

export default function RetourHierScreen({
  user,
  produits,
  vendeurs,
  defaultVendeurId,
  onRecorded,
}: RetourHierScreenProps) {
  const [raisons, setRaisons] = useState<RaisonRetour[]>([]);
  const [defaultRaison, setDefaultRaison] = useState<string>('perime');

  useEffect(() => {
    getRaisonsRetour().then(r => {
      setRaisons(r);
      if (r.length > 0) setDefaultRaison(r[0].code);
    });
  }, []);

  const emptyLigne = (): RetourHierLigne => ({
    produit_id: null,
    quantite: null,
    raison: defaultRaison,
  });

  const [retourHierVendeurId, setRetourHierVendeurId] = useState<number | null>(
    defaultVendeurId ?? null
  );
  const [lignes, setLignes] = useState<RetourHierLigne[]>(
    Array.from({ length: 7 }, emptyLigne)
  );
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Quand les raisons sont chargées, mettre à jour les lignes vierges
  useEffect(() => {
    if (raisons.length > 0) {
      setLignes(prev =>
        prev.map(l =>
          l.raison === 'perime' || l.raison === defaultRaison
            ? { ...l, raison: raisons[0].code }
            : l
        )
      );
      setDefaultRaison(raisons[0].code);
    }
  }, [raisons]);

  const hier = yesterdayLocalISO();
  const lignesValides = lignes.filter(
    l => l.produit_id !== null && (l.quantite ?? 0) > 0
  );

  const handleSubmit = async () => {
    if (lignesValides.length === 0) {
      toast.error(
        'Veuillez remplir au moins une ligne (produit + quantité)'
      );
      return;
    }
    if (!retourHierVendeurId) {
      toast.error('Veuillez sélectionner un vendeur');
      return;
    }

    setIsSubmitting(true);
    try {
      const db = await getDB();
      const dateRetour = new Date(`${hier}T12:00:00`).toISOString();
      const now = new Date().toISOString();

      for (const ligne of lignesValides) {
        const retour: RetourProduit = {
          local_id: generateLocalId(),
          pointeur_id: user.id,
          vendeur_id: retourHierVendeurId,
          produit_id: ligne.produit_id!,
          quantite: ligne.quantite!,
          raison: ligne.raison,
          description: undefined,
          verrou: false,
          date_retour: dateRetour,
          sync_status: 'pending',
          created_at: now,
          updated_at: now,
        };
        await db.add('retours_produits', retour);
      }

      const vendeur = vendeurs.find(v => v.id === retourHierVendeurId);
      const lignesSummary = lignesValides
        .map(l => {
          const p = produits.find(pr => pr.id === l.produit_id);
          return p
            ? `${l.quantite}×${p.nom} (${p.prix.toLocaleString('fr-FR')} XAF)`
            : '';
        })
        .filter(Boolean)
        .join(', ');

      toast.success(
        `✅ ${lignesValides.length} retour(s) d'hier enregistré(s)`,
        {
          description: `Vendeur : ${vendeur?.name ?? '?'} — ${lignesSummary}`,
          duration: 5000,
        }
      );

      setLignes(Array.from({ length: 7 }, () => ({ produit_id: null, quantite: null, raison: raisons[0]?.code ?? 'perime' })));
      onRecorded();
    } catch (error) {
      console.error('Erreur retours hier:', error);
      toast.error("Erreur lors de l'enregistrement des retours d'hier");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="card-premium p-6">

        {/* ── En-tête ── */}
        <div className="flex items-start justify-between mb-3">
          <h2 className="font-display text-xl font-semibold flex items-center gap-2">
            <RotateCcw className="w-5 h-5 text-orange-500" />
            Retours d'hier
          </h2>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-orange-500 text-white text-xs font-bold shadow">
            <CalendarDays className="w-3.5 h-3.5" />
            {formatDateFr(hier)}
          </span>
        </div>
        <p className="text-sm text-muted-foreground mb-6">
          Ces retours seront datés d'<strong>hier</strong>. Le vendeur choisi ici{' '}
          <strong>ne modifie pas</strong> le vendeur actif d'aujourd'hui.
        </p>

        {/* ── Sélection vendeur ── */}
        <div className="p-4 rounded-xl border-2 border-orange-300 bg-orange-50 dark:bg-orange-950/20 dark:border-orange-700 mb-6">
          <Label className="flex items-center gap-2 mb-3 text-orange-700 dark:text-orange-400 font-semibold">
            <User className="w-4 h-4" />
            Vendeur assigné à ces retours d'hier
          </Label>
          <SearchableSelect
            options={vendeurs.map(v => ({
              value: v.id,
              label: v.name,
              description: `${v.role.replace('vendeur_', '')} · ${v.numero_telephone}`,
            }))}
            value={retourHierVendeurId}
            onChange={v => setRetourHierVendeurId(v as number)}
            placeholder="Sélectionner le vendeur d'hier..."
          />
          {retourHierVendeurId &&
            (() => {
              const v = vendeurs.find(u => u.id === retourHierVendeurId);
              return v ? (
                <p className="text-xs text-orange-600 dark:text-orange-400 mt-2 flex items-center gap-1">
                  <span>✓</span>
                  <span>
                    Retours attribués à <strong>{v.name}</strong> — vendeur
                    actif d'aujourd'hui non affecté
                  </span>
                </p>
              ) : null;
            })()}
        </div>

        {/* ── 7 lignes produit + quantité ── */}
        <div className="space-y-3 mb-6">
          <Label className="text-sm font-semibold">
            Produits retournés{' '}
            <span className="text-muted-foreground font-normal">
              (remplissez les lignes nécessaires)
            </span>
          </Label>

          {lignes.map((ligne, idx) => {
            const produitSelectionne = ligne.produit_id
              ? produits.find(p => p.id === ligne.produit_id)
              : null;

            return (
              <div key={idx} className="space-y-1">
                <div className="grid grid-cols-[auto_1fr_auto_auto] gap-2 items-center">
                  {/* Numéro */}
                  <span className="w-6 h-6 rounded-full bg-muted flex items-center justify-center text-xs font-bold text-muted-foreground flex-shrink-0">
                    {idx + 1}
                  </span>

                  {/* Produit */}
                  <SearchableSelect
                    options={produits.map(p => ({
                      value: p.id,
                      label: p.nom,
                      description: `💰 ${p.prix.toLocaleString('fr-FR')} XAF · ${p.categorie}`,
                    }))}
                    value={ligne.produit_id}
                    onChange={v => {
                      const copy = [...lignes];
                      copy[idx] = { ...copy[idx], produit_id: v as number };
                      setLignes(copy);
                    }}
                    placeholder="Produit..."
                  />

                  {/* Quantité */}
                  <div className="w-24 flex-shrink-0">
                    <NumericInput
                      value={ligne.quantite}
                      onChange={v => {
                        const copy = [...lignes];
                        copy[idx] = { ...copy[idx], quantite: v };
                        setLignes(copy);
                      }}
                      min={0}
                      max={9999}
                      size="sm"
                    />
                  </div>

                  {/* Raison — dynamique ── */}
                  <select
                    value={ligne.raison}
                    onChange={e => {
                      const copy = [...lignes];
                      copy[idx] = { ...copy[idx], raison: e.target.value };
                      setLignes(copy);
                    }}
                    className="h-9 rounded-md border border-input bg-background px-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring flex-shrink-0"
                  >
                    {raisons.map(r => (
                      <option key={r.code} value={r.code}>
                        {r.libelle}
                      </option>
                    ))}
                    {/* Fallback si raisons pas encore chargées */}
                    {raisons.length === 0 && (
                      <>
                        <option value="perime">Périmé</option>
                        <option value="abime">Abîmé</option>
                        <option value="autre">Autre</option>
                      </>
                    )}
                  </select>
                </div>

                {/* Prix si produit sélectionné */}
                {produitSelectionne && (
                  <div className="ml-8 flex items-center gap-2">
                    <Tag className="w-3 h-3 text-amber-500" />
                    <span className="text-xs font-bold text-amber-600 dark:text-amber-400">
                      {produitSelectionne.prix.toLocaleString('fr-FR')} XAF
                    </span>
                    <span className="text-xs text-muted-foreground">
                      · {produitSelectionne.categorie}
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Récapitulatif */}
        {lignesValides.length > 0 && (
          <div className="mb-4 p-3 rounded-lg bg-muted/50 border border-border">
            <p className="text-sm font-semibold mb-1">
              Récapitulatif ({lignesValides.length} ligne
              {lignesValides.length > 1 ? 's' : ''}) :
            </p>
            <div className="space-y-1">
              {lignesValides.map((l, i) => {
                const p = produits.find(pr => pr.id === l.produit_id);
                return (
                  <div key={i} className="flex items-center gap-2 text-sm">
                    <span className="text-muted-foreground">{i + 1}.</span>
                    <span className="font-medium">{p?.nom ?? '?'}</span>
                    <span className="text-muted-foreground">×{l.quantite}</span>
                    {p && (
                      <span className="ml-auto text-xs font-bold text-amber-600">
                        {p.prix.toLocaleString('fr-FR')} XAF
                      </span>
                    )}
                    <span className="text-xs text-muted-foreground">
                      {resolveLibelle(l.raison, raisons)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Bouton submit ── */}
        <Button
          onClick={handleSubmit}
          disabled={
            isSubmitting ||
            !retourHierVendeurId ||
            lignesValides.length === 0
          }
          className="btn-golden w-full"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin mr-2" />
              <span>Enregistrement...</span>
            </>
          ) : (
            <>
              <RotateCcw className="w-5 h-5 mr-2" />
              <span>Enregistrer les retours d'hier</span>
            </>
          )}
        </Button>
      </div>
    </div>
  );
}