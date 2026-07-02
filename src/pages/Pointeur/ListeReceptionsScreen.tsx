/**
 * ListeReceptionsScreen.tsx
 * Liste des réceptions du jour + tous les pointeurs (avec filtres).
 * - Prix toujours visible à côté du nom du produit
 * - Actions modifier/supprimer avec PIN requis
 * - Filtre par pointeur, recherche produit, filtre par date
 */

import React, { useState, useMemo } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { SyncBadge } from '@/components/SyncBadge';
import { CategoryBadge } from '@/components/CategoryBadge';
import { EmptyState } from '@/components/EmptyState';
import {
  Check,
  Search,
  X,
  User,
  Clock,
  Edit2,
  Trash2,
  Filter,
  Tag,
  CalendarDays,
} from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { toast } from 'sonner';
import { getDB } from '@/lib/db';
import type { Produit, User as DBUser, ReceptionPointeur } from '@/lib/db';
import { parseDate, PrixBadge, EditModal, DeleteModal, type EditModalState, type DeleteModalState, type EditFormState, todayLocalISO, raisonLabels } from './PointeurModals';
import { getConfig } from '@/lib/db';

interface ListeReceptionsScreenProps {
  currentUser: { id: number; name: string; role: string };
  receptions: ReceptionPointeur[];
  produits: Produit[];
  vendeurs: DBUser[];
  pointeurs: DBUser[];
  onRefresh: () => void;
}

function safeFormatTime(dateStr: string | null | undefined): string {
  const d = parseDate(dateStr);
  if (!d) return '--:--';
  try { return format(d, 'HH:mm', { locale: fr }); } catch { return '--:--'; }
}

function safeFormatDate(dateStr: string | null | undefined): string {
  const d = parseDate(dateStr);
  if (!d) return '--';
  try { return format(d, 'dd/MM HH:mm', { locale: fr }); } catch { return '--'; }
}

async function verifyPin(pin: string): Promise<boolean> {
  // Vérification locale du PIN (comparaison avec PIN stocké pour l'utilisateur courant)
  try {
    const storedPins = await getConfig<Record<string, string>>('offline_pins') || {};
    const currentUser = await getConfig<any>('current_user');
    if (!currentUser) return false;
    const storedPin = storedPins[currentUser.numero_telephone];
    return storedPin === pin;
  } catch {
    return false;
  }
}

export default function ListeReceptionsScreen({
  currentUser,
  receptions,
  produits,
  vendeurs,
  pointeurs,
  onRefresh,
}: ListeReceptionsScreenProps) {
  const [search, setSearch] = useState('');
  const [filterPointeur, setFilterPointeur] = useState<number | 'all'>('all');
  const [showMyOnly, setShowMyOnly] = useState(false);
  const [filterDate, setFilterDate] = useState(todayLocalISO());

  const [editModal, setEditModal] = useState<EditModalState>({
    isOpen: false, type: null, item: null,
  });
  const [editForm, setEditForm] = useState<EditFormState>({
    quantite: null, notes: '', raison: 'perime', description: '',
    date: todayLocalISO(), heure: format(new Date(), 'HH:mm'), vendeur_id: null,
  });
  const [deleteModal, setDeleteModal] = useState<DeleteModalState>({
    isOpen: false, type: null, item: null,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Filtrage
  const filtered = useMemo(() => {
    let items = [...receptions];
    
    // Filtre par date
    if (filterDate) {
      items = items.filter(r => r.date_reception?.slice(0, 10) === filterDate);
    }
    
    if (showMyOnly) {
      items = items.filter(r => r.pointeur_id === currentUser.id);
    } else if (filterPointeur !== 'all') {
      items = items.filter(r => r.pointeur_id === filterPointeur);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      items = items.filter(r => {
        const p = produits.find(pr => pr.id === r.produit_id);
        return p?.nom?.toLowerCase().includes(q) ?? false;
      });
    }
    return items.sort((a, b) => {
      const da = parseDate(a.date_reception)?.getTime() ?? 0;
      const db2 = parseDate(b.date_reception)?.getTime() ?? 0;
      return db2 - da;
    });
  }, [receptions, search, filterPointeur, showMyOnly, currentUser.id, produits, filterDate]);

  const openEdit = (item: ReceptionPointeur) => {
    if (item.verrou) { toast.error('Cet enregistrement est verrouillé par le PDG'); return; }
    setEditModal({ isOpen: true, type: 'reception', item });
    const d = parseDate(item.date_reception);
    setEditForm({
      quantite: item.quantite,
      notes: item.notes ?? '',
      raison: 'perime',
      description: '',
      date: d ? format(d, 'yyyy-MM-dd') : todayLocalISO(),
      heure: d ? format(d, 'HH:mm') : format(new Date(), 'HH:mm'),
      vendeur_id: item.vendeur_assigne_id ?? null,
    });
  };

  const openDelete = (item: ReceptionPointeur) => {
    if (item.verrou) { toast.error('Cet enregistrement est verrouillé par le PDG'); return; }
    setDeleteModal({ isOpen: true, type: 'reception', item });
  };

  const handleSaveEdit = async (pin: string) => {
    if (!editModal.item) return;
    const valid = await verifyPin(pin);
    if (!valid) { toast.error('Code PIN incorrect'); return; }
    setIsSubmitting(true);
    try {
      const db = await getDB();
      const now = new Date().toISOString();
      const newDatetime = new Date(`${editForm.date}T${editForm.heure}:00`).toISOString();
      const rec = editModal.item as ReceptionPointeur;
      const updated: ReceptionPointeur = {
        ...rec,
        quantite: editForm.quantite ?? rec.quantite,
        notes: editForm.notes || undefined,
        date_reception: newDatetime,
        vendeur_assigne_id: editForm.vendeur_id ?? rec.vendeur_assigne_id,
        sync_status: 'pending',
        updated_at: now,
      };
      await db.put('receptions_pointeur', updated);
      setEditModal({ isOpen: false, type: null, item: null });
      toast.success('Réception modifiée avec succès');
      onRefresh();
    } catch { toast.error('Erreur lors de la modification'); }
    finally { setIsSubmitting(false); }
  };

  const handleDelete = async (pin: string) => {
    if (!deleteModal.item) return;
    const valid = await verifyPin(pin);
    if (!valid) { toast.error('Code PIN incorrect'); return; }
    setIsSubmitting(true);
    try {
      const db = await getDB();
      const rec = deleteModal.item as ReceptionPointeur;
      const key = rec.id ?? rec.local_id;
      await db.delete('receptions_pointeur', key as any);
      setDeleteModal({ isOpen: false, type: null, item: null });
      toast.success('Réception supprimée');
      onRefresh();
    } catch { toast.error('Erreur lors de la suppression'); }
    finally { setIsSubmitting(false); }
  };

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-xl font-semibold flex items-center gap-2">
          <Check className="w-5 h-5 text-primary" />
          Réceptions
        </h2>
        <span className="text-sm text-muted-foreground">{filtered.length} résultat(s)</span>
      </div>

      {/* ── Filtres ── */}
      <div className="space-y-3">
        {/* Recherche */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
          <Input
            className="pl-9"
            placeholder="Rechercher par produit..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && (
            <button
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              onClick={() => setSearch('')}
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Filtre date (comme pour les retours) */}
        <div className="flex items-center gap-2">
          <CalendarDays className="w-4 h-4 text-muted-foreground flex-shrink-0" />
          <Input
            type="date"
            value={filterDate}
            onChange={(e) => setFilterDate(e.target.value)}
            className="w-auto"
          />
          {filterDate !== todayLocalISO() && (
            <button
              onClick={() => setFilterDate(todayLocalISO())}
              className="text-xs text-primary underline"
            >
              Aujourd'hui
            </button>
          )}
        </div>

        {/* Filtre pointeur */}
        <div className="flex flex-wrap gap-2 items-center">
          <Filter className="w-4 h-4 text-muted-foreground flex-shrink-0" />
          <button
            onClick={() => { setShowMyOnly(true); setFilterPointeur('all'); }}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
              showMyOnly
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:bg-muted/70'
            }`}
          >
            Mes réceptions
          </button>
          <button
            onClick={() => { setShowMyOnly(false); setFilterPointeur('all'); }}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
              !showMyOnly && filterPointeur === 'all'
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:bg-muted/70'
            }`}
          >
            Tous les pointeurs
          </button>
          {pointeurs.map(p => (
            <button
              key={p.id}
              onClick={() => { setShowMyOnly(false); setFilterPointeur(p.id); }}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                !showMyOnly && filterPointeur === p.id
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:bg-muted/70'
              }`}
            >
              {p.name}
            </button>
          ))}
        </div>
      </div>

      {/* ── Liste ── */}
      {filtered.length === 0 ? (
        <EmptyState
          icon="inbox"
          title="Aucune réception"
          description={search ? 'Aucun résultat pour cette recherche' : 'Les réceptions apparaîtront ici'}
        />
      ) : (
        <div className="space-y-3">
          {filtered.map((rec, index) => {
            const produit = produits.find(p => p.id === rec.produit_id);
            const vendeur = vendeurs.find(v => v.id === rec.vendeur_assigne_id);
            const pointeur = pointeurs.find(p => p.id === rec.pointeur_id);
            const isMine = rec.pointeur_id === currentUser.id;
            const itemKey = rec.id != null ? `rec-${rec.id}` : `rec-${rec.local_id ?? index}`;

            return (
              <div
                key={itemKey}
                className={`card-premium p-4 transition-all ${isMine ? 'ring-1 ring-primary/20' : ''}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <span className="flex-shrink-0 w-6 h-6 rounded-full bg-muted flex items-center justify-center text-xs font-bold text-muted-foreground mt-0.5">
                      {index + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      {/* Nom produit + PRIX MIS EN AVANT */}
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className="font-semibold">
                          {produit?.nom ?? `Produit #${rec.produit_id}`}
                        </span>
                        {produit && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md font-bold text-xs bg-amber-500 text-white">
                            <Tag className="w-3 h-3" />
                            {produit.prix.toLocaleString('fr-FR')} XAF
                          </span>
                        )}
                        {produit && <CategoryBadge category={produit.categorie} />}
                      </div>

                      <div className="flex items-center gap-3 text-sm text-muted-foreground flex-wrap">
                        <span className="font-semibold text-foreground">{rec.quantite} unités</span>
                        {vendeur && (
                          <span className="flex items-center gap-1">
                            <User className="w-3 h-3" />
                            {vendeur.name}
                          </span>
                        )}
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {safeFormatDate(rec.date_reception)}
                        </span>
                        {!isMine && pointeur && (
                          <span className="flex items-center gap-1 text-primary/70 text-xs bg-primary/5 px-2 py-0.5 rounded-full">
                            <User className="w-3 h-3" />
                            par {pointeur.name}
                          </span>
                        )}
                        {isMine && (
                          <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium">
                            Moi
                          </span>
                        )}
                      </div>
                      {rec.notes && (
                        <p className="text-sm text-muted-foreground mt-1 truncate">{rec.notes}</p>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-1 flex-shrink-0">
                    <SyncBadge status={rec.sync_status} />
                    {rec.verrou ? (
                      <span className="text-xs text-muted-foreground">🔒</span>
                    ) : isMine ? (
                      <div className="flex items-center gap-2 mt-1">
                        <button
                          onClick={() => openDelete(rec)}
                          className="text-destructive hover:text-destructive/80 transition-colors"
                          title="Supprimer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => openEdit(rec)}
                          className="text-muted-foreground hover:text-foreground transition-colors"
                          title="Modifier"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Modals ── */}
      <EditModal
        state={editModal}
        form={editForm}
        vendeurs={vendeurs}
        produits={produits}
        isSubmitting={isSubmitting}
        onFormChange={setEditForm}
        onSave={handleSaveEdit}
        onClose={() => setEditModal({ isOpen: false, type: null, item: null })}
      />
      <DeleteModal
        state={deleteModal}
        produits={produits}
        vendeurs={vendeurs}
        isSubmitting={isSubmitting}
        onConfirm={handleDelete}
        onClose={() => setDeleteModal({ isOpen: false, type: null, item: null })}
      />
    </div>
  );
}