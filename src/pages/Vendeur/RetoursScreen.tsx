/**
 * EasyGest BP — Sous-écran Retours (Vendeur)
 */

import React from 'react';
import { Clock } from 'lucide-react';
import { EmptyState } from '@/components/EmptyState';
import type { Produit, RetourProduit } from '@/lib/db';
import { format, isValid } from 'date-fns';
import { fr } from 'date-fns/locale';

interface RetoursScreenProps {
  retours: RetourProduit[];
  produits: Produit[];
}

const safeFormatDate = (dateString: string, formatStr = 'HH:mm'): string => {
  try {
    const date = new Date(dateString);
    if (!isValid(date)) return 'Date invalide';
    return format(date, formatStr, { locale: fr });
  } catch {
    return 'Date invalide';
  }
};

const RAISON_LABELS: Record<string, string> = {
  perime: 'Périmé',
  abime: 'Abîmé',
  mauvaise_qualite: 'Mauvaise qualité',
  autre: 'Autre',
};

export function RetoursScreen({ retours, produits }: RetoursScreenProps) {
  const totalRetours = retours.reduce((sum, r) => sum + (r?.quantite || 0), 0);

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-xl font-semibold">Retours me concernant</h2>
        <span className="px-3 py-1 rounded-full bg-destructive/10 text-destructive font-medium">
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
            if (!ret) return null;
            const produit = produits.find(p => p?.id === ret.produit_id);
            const raisonLabel = RAISON_LABELS[ret.raison] || ret.raison || 'Inconnue';

            return (
              <div key={ret.id || ret.local_id} className="card-premium p-4">
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">
                      {produit?.nom || `Produit #${ret.produit_id}`}
                    </p>
                    <div className="flex items-center gap-3 text-sm mt-1 flex-wrap">
                      <span className="flex items-center gap-1 text-muted-foreground">
                        <Clock className="w-3 h-3 flex-shrink-0" />
                        {safeFormatDate(ret.date_retour)}
                      </span>
                      {produit && (
                        <span className="text-primary font-medium whitespace-nowrap">
                          {(produit.prix || 0).toLocaleString()} XAF
                        </span>
                      )}
                      <span className="px-2 py-0.5 rounded-full bg-destructive/10 text-destructive text-xs font-medium">
                        {raisonLabel}
                      </span>
                    </div>
                    {ret.description && (
                      <p className="text-xs text-muted-foreground mt-1 italic">
                        {ret.description}
                      </p>
                    )}
                  </div>
                  <div className="text-right ml-2 flex-shrink-0">
                    <span className="text-2xl font-bold text-destructive">
                      {ret.quantite || 0}
                    </span>
                    <p className="text-xs text-muted-foreground">unités</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}