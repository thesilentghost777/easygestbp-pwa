/**
 * EasyGest BP — Sous-écran Session de vente (Vendeur)
 */

import React from 'react';
import { CreditCard, DollarSign, Smartphone, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { SessionVente } from '@/lib/db';
import { format, isValid } from 'date-fns';
import { fr } from 'date-fns/locale';

interface SessionScreenProps {
  sessionActive: SessionVente | null;
  sessionForm: {
    fond_vente: number;
    orange_money_initial: number;
    mtn_money_initial: number;
  };
  onFormChange: (form: { fond_vente: number; orange_money_initial: number; mtn_money_initial: number }) => void;
  onOpenSession: () => Promise<void>;
  isSubmitting: boolean;
}

const safeFormatDate = (dateString: string, formatStr = 'dd/MM/yyyy HH:mm'): string => {
  try {
    const date = new Date(dateString);
    if (!isValid(date)) return 'Date invalide';
    return format(date, formatStr, { locale: fr });
  } catch {
    return 'Date invalide';
  }
};

export function SessionScreen({
  sessionActive,
  sessionForm,
  onFormChange,
  onOpenSession,
  isSubmitting,
}: SessionScreenProps) {
  if (sessionActive) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="card-premium p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="font-display text-xl font-semibold">Session en cours</h2>
            <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-success/10 text-success text-sm font-medium">
              <span className="w-2 h-2 rounded-full bg-success animate-pulse" />
              Ouverte
            </span>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
              <span className="text-muted-foreground">Ouverture</span>
              <span className="font-medium">
                {safeFormatDate(sessionActive.date_ouverture)}
              </span>
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
              <span className="flex items-center gap-2 text-muted-foreground">
                <DollarSign className="w-4 h-4" />
                Fond de vente
              </span>
              <span className="font-bold text-lg">
                {(sessionActive.fond_vente || 0).toLocaleString()} XAF
              </span>
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
              <span className="flex items-center gap-2 text-muted-foreground">
                <Smartphone className="w-4 h-4 text-orange-500" />
                Orange Money
              </span>
              <span className="font-medium">
                {(sessionActive.orange_money_initial || 0).toLocaleString()} XAF
              </span>
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
              <span className="flex items-center gap-2 text-muted-foreground">
                <Smartphone className="w-4 h-4 text-yellow-500" />
                MTN Money
              </span>
              <span className="font-medium">
                {(sessionActive.mtn_money_initial || 0).toLocaleString()} XAF
              </span>
            </div>
          </div>

          <div className="mt-6 p-4 rounded-lg bg-info/10 text-info text-sm text-center">
            ℹ️ Seul le PDG peut fermer cette session
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="card-premium p-6">
        <h2 className="font-display text-xl font-semibold mb-2">
          Ouvrir une session de vente
        </h2>
        <p className="text-sm text-muted-foreground mb-6">
          Renseignez les fonds initiaux avant de commencer la journée
        </p>

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
              onChange={(e) =>
                onFormChange({ ...sessionForm, fond_vente: parseInt(e.target.value) || 0 })
              }
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
              onChange={(e) =>
                onFormChange({
                  ...sessionForm,
                  orange_money_initial: parseInt(e.target.value) || 0,
                })
              }
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
              onChange={(e) =>
                onFormChange({
                  ...sessionForm,
                  mtn_money_initial: parseInt(e.target.value) || 0,
                })
              }
              className="input-golden"
              placeholder="0"
            />
          </div>

          <Button
            onClick={onOpenSession}
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
    </div>
  );
}