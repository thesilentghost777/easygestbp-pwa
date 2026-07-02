/**
 * EasyGest BP - Database Viewer (Optimized)
 * Performance-first approach: vitesse > design
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { X, RefreshCw, Trash2, Download, KeyRound } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { exportAllData, clearAllData } from '@/lib/db';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface DatabaseViewerProps {
  isOpen: boolean;
  onClose: () => void;
}

// Composant Row mémoïsé pour éviter les re-renders inutiles
const TableRow = React.memo(({ row }: { row: Record<string, unknown> }) => (
  <tr className="border-b border-border/50 hover:bg-muted/30">
    {Object.values(row).map((value, j) => (
      <td key={j} className="px-3 py-2 whitespace-nowrap max-w-[200px] truncate">
        {typeof value === 'object' ? JSON.stringify(value) : String(value ?? '-')}
       </td>
    ))}
  </tr>
));
TableRow.displayName = 'TableRow';

export function DatabaseViewer({ isOpen, onClose }: DatabaseViewerProps) {
  const [data, setData] = useState<Record<string, unknown[]>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('users');
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [password, setPassword] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  // Mémoïsation des tables pour éviter recalculs
  const tables = useMemo(() => Object.keys(data), [data]);
  const activeData = useMemo(() => data[activeTab] || [], [data, activeTab]);
  const headers = useMemo(
    () => activeData[0] ? Object.keys(activeData[0] as object) : [],
    [activeData]
  );

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const allData = await exportAllData();
      setData(allData);
    } catch (error) {
      console.error('Erreur chargement données:', error);
      toast.error('Erreur lors du chargement des données');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      loadData();
    }
  }, [isOpen, loadData]);

  const handleExport = useCallback(() => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `easygest-bp-export-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Export téléchargé');
  }, [data]);

  const handleClearClick = useCallback(() => {
    setShowPasswordModal(true);
    setPassword('');
  }, []);

  const handlePasswordSubmit = useCallback(async () => {
    if (password === 'ghost') {
      setIsDeleting(true);
      try {
        await clearAllData();
        toast.success('Base de données vidée avec succès');
        await loadData();
        setShowPasswordModal(false);
        setPassword('');
      } catch (error) {
        console.error('Erreur lors de la suppression:', error);
        toast.error('Erreur lors de la suppression des données');
      } finally {
        setIsDeleting(false);
      }
    } else {
      toast.error('Mot de passe incorrect');
      setPassword('');
    }
  }, [password, loadData]);

  const handleCloseModal = useCallback(() => {
    setShowPasswordModal(false);
    setPassword('');
  }, []);

  // Early return optimisé
  if (!isOpen) return null;

  return (
    <>
      <div 
        className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
        onClick={onClose}
      >
        <div
          className="w-full max-w-4xl max-h-[85vh] bg-card rounded-3xl shadow-divine overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header simplifié */}
          <div className="p-6 border-b border-border bg-gradient-to-r from-muted/50 to-transparent">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-display text-xl font-semibold">Base de données locale</h2>
                <p className="text-sm text-muted-foreground mt-1">IndexedDB</p>
              </div>
              
              <div className="flex items-center gap-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={loadData}
                  disabled={isLoading}
                  className="rounded-xl"
                >
                  <RefreshCw className={cn('w-4 h-4 mr-2', isLoading && 'animate-spin')} />
                  Rafraîchir
                </Button>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={handleExport}
                  className="rounded-xl"
                >
                  <Download className="w-4 h-4 mr-2" />
                  Exporter
                </Button>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={handleClearClick}
                  className="rounded-xl text-destructive hover:text-destructive"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Vider
                </Button>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  onClick={onClose}
                  className="rounded-xl"
                >
                  <X className="w-5 h-5" />
                </Button>
              </div>
            </div>
          </div>

          {/* Content optimisé */}
          <div className="flex h-[calc(85vh-100px)]">
            {/* Tabs avec virtualisation simple */}
            <div className="w-48 p-4 border-r border-border bg-muted/30 overflow-y-auto">
              <div className="space-y-1">
                {tables.map((table) => (
                  <button
                    key={table}
                    onClick={() => setActiveTab(table)}
                    className={cn(
                      'w-full px-3 py-2 text-left rounded-xl text-sm font-medium transition-colors',
                      activeTab === table
                        ? 'bg-primary text-primary-foreground'
                        : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                    )}
                  >
                    <span className="truncate">{table}</span>
                    <span className="ml-2 text-xs opacity-70">({data[table]?.length || 0})</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Table content avec rows mémoïsées */}
            <div className="flex-1 p-4 overflow-auto">
              {activeData.length > 0 ? (
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-card">
                    <tr className="border-b border-border">
                      {headers.map((key) => (
                        <th key={key} className="px-3 py-2 text-left font-semibold text-muted-foreground whitespace-nowrap">
                          {key}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {activeData.map((row, i) => (
                      <TableRow key={i} row={row as Record<string, unknown>} />
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="flex items-center justify-center h-full text-muted-foreground">
                  Aucune donnée
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Modal de mot de passe */}
      {showPasswordModal && (
        <div 
          className="fixed inset-0 z-[60] bg-black/80 backdrop-blur-md flex items-center justify-center p-4"
          onClick={handleCloseModal}
        >
          <div 
            className="w-full max-w-md bg-card rounded-2xl shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center">
                  <KeyRound className="w-6 h-6 text-amber-600" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold">Confirmation requise</h3>
                  <p className="text-sm text-muted-foreground">
                    Cette action supprimera TOUTES les données
                  </p>
                </div>
              </div>
              
              <p className="text-sm text-destructive mb-4 p-3 bg-destructive/10 rounded-lg border border-destructive/20">
                ⚠️ Attention : Cette action est irréversible. Toutes les données locales seront définitivement supprimées.
              </p>
              
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium mb-2 block">
                    Mot de passe
                  </label>
                  <Input
                    type="password"
                    placeholder="Entrez le mot de passe"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handlePasswordSubmit()}
                    autoFocus
                    className="rounded-xl"
                  />
                </div>
                
                <div className="flex gap-3">
                  <Button
                    variant="outline"
                    onClick={handleCloseModal}
                    className="flex-1 rounded-xl"
                  >
                    Annuler
                  </Button>
                  <Button
                    onClick={handlePasswordSubmit}
                    disabled={isDeleting || !password}
                    className="flex-1 bg-destructive hover:bg-destructive/90 rounded-xl"
                  >
                    {isDeleting ? (
                      <>
                        <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                        Suppression...
                      </>
                    ) : (
                      <>
                        <Trash2 className="w-4 h-4 mr-2" />
                        Confirmer
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}