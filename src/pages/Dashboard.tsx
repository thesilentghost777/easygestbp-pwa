/**
 * EasyGest BP - Dashboard principal avec redirection selon le rôle
 */

import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2 } from 'lucide-react';

export default function Dashboard() {
  const navigate = useNavigate();
  const { user, isLoading, isAuthenticated } = useAuth();

  useEffect(() => {
    if (!isLoading) {
      if (!isAuthenticated) {
        navigate('/login');
        return;
      }

      // Rediriger selon le rôle
      switch (user?.role) {
        case 'pointeur':
          navigate('/pointeur');
          break;
        case 'vendeur_boulangerie':
        case 'vendeur_patisserie':
          navigate('/vendeur');
          break;
        case 'pdg':
          navigate('/pdg');
          break;
        default:
          // Pour le moment, on reste sur dashboard
          break;
      }
    }
  }, [user, isLoading, isAuthenticated, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center">
        <Loader2 className="w-12 h-12 animate-spin text-primary mx-auto mb-4" />
        <p className="text-muted-foreground">Chargement...</p>
      </div>
    </div>
  );
}
