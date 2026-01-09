/**
 * EasyGest BP - Modal de visualisation de la base locale
 */

import React, { useState, useEffect } from 'react';
import { X, RefreshCw, Trash2, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { exportAllData, clearAllData } from '@/lib/db';
import { toast } from 'sonner';

interface DatabaseViewerProps {
  isOpen: boolean;
  onClose: () => void;
}

export function DatabaseViewer({ isOpen, onClose }: DatabaseViewerProps) {
  const [data, setData] = useState<Record<string, any[]>>({});
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
    <div className="modal-overlay" onClick={onClose}>
      <div 
        className="bg-card w-full max-w-4xl max-h-[90vh] rounded-xl shadow-strong overflow-hidden animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="font-display text-xl font-semibold">Base de données locale</h2>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={loadData} disabled={isLoading}>
              <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
              Rafraîchir
            </Button>
            <Button variant="outline" size="sm" onClick={handleExport}>
              <Download className="w-4 h-4 mr-2" />
              Exporter
            </Button>
            <Button variant="destructive" size="sm" onClick={handleClear}>
              <Trash2 className="w-4 h-4 mr-2" />
              Vider
            </Button>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="w-5 h-5" />
            </Button>
          </div>
        </div>

        {/* Content */}
        <div className="p-4 overflow-auto max-h-[calc(90vh-80px)]">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="flex flex-wrap gap-1 mb-4">
              {tables.map((table) => (
                <TabsTrigger key={table} value={table} className="text-xs">
                  {table}
                  <span className="ml-1 text-muted-foreground">({data[table]?.length || 0})</span>
                </TabsTrigger>
              ))}
            </TabsList>

            {tables.map((table) => (
              <TabsContent key={table} value={table}>
                <div className="rounded-lg border overflow-x-auto">
                  {data[table]?.length > 0 ? (
                    <table className="w-full text-sm">
                      <thead className="bg-muted/50">
                        <tr>
                          {Object.keys(data[table][0]).map((key) => (
                            <th key={key} className="px-3 py-2 text-left font-medium text-muted-foreground whitespace-nowrap">
                              {key}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {data[table].map((row, i) => (
                          <tr key={i} className="border-t hover:bg-muted/30">
                            {Object.values(row).map((value: any, j) => (
                              <td key={j} className="px-3 py-2 whitespace-nowrap max-w-xs truncate">
                                {typeof value === 'object' ? JSON.stringify(value) : String(value ?? '-')}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <div className="p-8 text-center text-muted-foreground">
                      Aucune donnée dans cette table
                    </div>
                  )}
                </div>
              </TabsContent>
            ))}
          </Tabs>
        </div>
      </div>
    </div>
  );
}
