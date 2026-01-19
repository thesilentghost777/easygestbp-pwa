/**
 * EasyGest BP - Database Viewer Component
 * Modal for viewing and managing local IndexedDB data
 */

import React, { useState, useEffect } from 'react';
import { X, RefreshCw, Trash2, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { exportAllData, clearAllData } from '@/lib/db';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface DatabaseViewerProps {
  isOpen: boolean;
  onClose: () => void;
}

export function DatabaseViewer({ isOpen, onClose }: DatabaseViewerProps) {
  const [data, setData] = useState<Record<string, unknown[]>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('users');

  const loadData = async () => {
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
  };

  useEffect(() => {
    if (isOpen) {
      loadData();
    }
  }, [isOpen]);

  const handleExport = () => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `easygest-bp-export-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Export téléchargé');
  };

  const handleClear = async () => {
    if (confirm('⚠️ Êtes-vous sûr de vouloir supprimer TOUTES les données locales ? Cette action est irréversible.')) {
      await clearAllData();
      toast.success('Base de données locale vidée');
      loadData();
    }
  };

  if (!isOpen) return null;

  const tables = Object.keys(data);

  return (
    <div 
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in"
      onClick={onClose}
    >
      <div
        className="w-full max-w-4xl max-h-[85vh] bg-card rounded-3xl shadow-divine overflow-hidden animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-6 border-b border-border bg-gradient-to-r from-muted/50 to-transparent">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-display text-xl font-semibold">Base de données locale</h2>
              <p className="text-sm text-muted-foreground mt-1">Visualiser et gérer les données IndexedDB</p>
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
                onClick={handleClear}
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

        {/* Content */}
        <div className="flex h-[calc(85vh-100px)]">
          {/* Tabs */}
          <div className="w-48 p-4 border-r border-border bg-muted/30 overflow-y-auto">
            <div className="space-y-1">
              {tables.map((table) => (
                <button
                  key={table}
                  onClick={() => setActiveTab(table)}
                  className={cn(
                    'w-full px-3 py-2 text-left rounded-xl text-sm font-medium transition-all',
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

          {/* Table content */}
          <div className="flex-1 p-4 overflow-auto">
            {data[activeTab]?.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      {Object.keys(data[activeTab][0] as object).map((key) => (
                        <th key={key} className="px-3 py-2 text-left font-semibold text-muted-foreground whitespace-nowrap">
                          {key}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {data[activeTab].map((row, i) => (
                      <tr key={i} className="border-b border-border/50 hover:bg-muted/30">
                        {Object.values(row as object).map((value: unknown, j) => (
                          <td key={j} className="px-3 py-2 whitespace-nowrap max-w-[200px] truncate">
                            {typeof value === 'object' ? JSON.stringify(value) : String(value ?? '-')}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="flex items-center justify-center h-full text-muted-foreground">
                Aucune donnée dans cette table
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
