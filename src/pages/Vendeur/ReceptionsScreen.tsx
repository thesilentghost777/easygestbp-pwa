/**
 * EasyGest BP — Sous-écran Réceptions (Vendeur)
 */

import React from 'react';
import { Package, Clock } from 'lucide-react';
import { EmptyState } from '@/components/EmptyState';
import type { Produit, ReceptionPointeur } from '@/lib/db';
import { format, isValid } from 'date-fns';
import { fr } from 'date-fns/locale';

interface ReceptionsScreenProps {
  receptions: ReceptionPointeur[];
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

export function ReceptionsScreen({ receptions, produits }: ReceptionsScreenProps) {
  const totalReceptions = receptions.reduce((sum, r) => sum + (r?.quantite || 0), 0);

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-xl font-semibold">Produits reçus aujourd'hui</h2>
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
            if (!rec) return null;
            const produit = produits.find(p => p?.id === rec.produit_id);
            return (
              <div key={rec.id || rec.local_id} className="card-premium p-4">
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <Package className="w-4 h-4 text-primary" />
                      </div>
                      <p className="font-medium truncate">
                        {produit?.nom || `Produit #${rec.produit_id}`}
                      </p>
                    </div>
                    <div className="flex items-center gap-3 text-sm flex-wrap pl-10">
                      <span className="flex items-center gap-1 text-muted-foreground">
                        <Clock className="w-3 h-3 flex-shrink-0" />
                        {safeFormatDate(rec.date_reception)}
                      </span>
                      {produit && (
                        <span className="text-primary font-medium whitespace-nowrap">
                          {produit.prix.toLocaleString()} XAF
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="text-right ml-2 flex-shrink-0">
                    <span className="text-2xl font-bold text-primary">{rec.quantite || 0}</span>
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