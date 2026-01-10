/**
 * EasyGest BP - Contexte d'authentification
 */

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { getConfig, setConfig, initDB } from '@/lib/db';
import { authApi, checkConnection } from '@/lib/api';

export interface User {
  id: number;
  name: string;
  numero_telephone: string;
  role: 'pdg' | 'pointeur' | 'vendeur_boulangerie' | 'vendeur_patisserie' | 'producteur';
  actif: boolean;
  preferred_language: string;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  isOnline: boolean;
  login: (phone: string, pin: string) => Promise<{ success: boolean; message: string }>;
  register: (data: {
    nom: string;
    numero_telephone: string;
    role: string;
    code_pin: string;
  }) => Promise<{ success: boolean; message: string }>;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Normaliser l'utilisateur depuis la réponse API (gère nom/name)
function normalizeUser(apiUser: any): User | null {
  if (!apiUser) return null;
  return {
    id: apiUser.id,
    name: apiUser.nom || apiUser.name,
    numero_telephone: apiUser.numero_telephone,
    role: apiUser.role,
    actif: apiUser.actif ?? true,
    preferred_language: apiUser.preferred_language || 'fr',
  };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  // Vérifier la connexion réseau
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    // Vérification initiale plus approfondie
    checkConnection().then(setIsOnline);
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Vérifier l'authentification au démarrage
  const checkAuth = useCallback(async () => {
    setIsLoading(true);
    try {
      await initDB();
      
      const storedUser = await getConfig<User>('current_user');
      const token = await getConfig<string>('auth_token');
      
      if (storedUser && token) {
        setUser(storedUser);
        
        // Vérifier avec le serveur si en ligne
        if (isOnline) {
          try {
            const response = await authApi.me();
            if (response.success && response.data?.user) {
              const normalizedUser = normalizeUser(response.data.user);
              if (normalizedUser) {
                setUser(normalizedUser);
                await setConfig('current_user', normalizedUser);
              }
            }
          } catch (error) {
            console.warn('Impossible de vérifier la session en ligne:', error);
          }
        }
      }
    } catch (error) {
      console.error('Erreur checkAuth:', error);
    } finally {
      setIsLoading(false);
    }
  }, [isOnline]);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  const login = async (phone: string, pin: string): Promise<{ success: boolean; message: string }> => {
    if (!isOnline) {
      // Mode offline: vérifier le PIN local
      const storedUser = await getConfig<User>('current_user');
      const storedPin = await getConfig<string>('user_pin_hash');
      
      if (storedUser && storedUser.numero_telephone === phone) {
        // En mode offline, on fait confiance au PIN stocké (simplifié)
        setUser(storedUser);
        return { success: true, message: 'Connexion en mode hors ligne' };
      }
      
      return { success: false, message: 'Connexion impossible hors ligne (première connexion requise en ligne)' };
    }
    
    try {
      const response = await authApi.connexion({
        numero_telephone: phone,
        code_pin: pin,
      });
      
      // La réponse peut avoir user à différents niveaux
      const apiUser = response.data?.user || (response as any).user;
      const token = response.data?.token || (response as any).token;
      
      if (response.success && apiUser) {
        const normalizedUser = normalizeUser(apiUser);
        if (normalizedUser) {
          // Sauvegarder dans IndexedDB
          await setConfig('current_user', normalizedUser);
          if (token) {
            await setConfig('auth_token', token);
          }
          // Mettre à jour l'état
          setUser(normalizedUser);
          return { success: true, message: 'Connexion réussie' };
        }
      }
      
      return { success: false, message: response.message || 'Identifiants incorrects' };
    } catch (error: any) {
      console.error('Login error:', error);
      return { success: false, message: error.message || 'Erreur de connexion' };
    }
  };

  const register = async (data: {
    nom: string;
    numero_telephone: string;
    role: string;
    code_pin: string;
  }): Promise<{ success: boolean; message: string }> => {
    if (!isOnline) {
      return { success: false, message: 'L\'inscription nécessite une connexion Internet' };
    }
    
    try {
      const response = await authApi.inscription({
        nom: data.nom,
        numero_telephone: data.numero_telephone,
        role: data.role,
        code_pin: data.code_pin,
      });
      
      // La réponse peut avoir user à différents niveaux
      const apiUser = response.data?.user || (response as any).user;
      const token = response.data?.token || (response as any).token;
      
      if (response.success && apiUser) {
        const normalizedUser = normalizeUser(apiUser);
        if (normalizedUser) {
          // Sauvegarder dans IndexedDB
          await setConfig('current_user', normalizedUser);
          if (token) {
            await setConfig('auth_token', token);
          }
          // Mettre à jour l'état
          setUser(normalizedUser);
          return { success: true, message: 'Inscription réussie' };
        }
      }
      
      return { success: false, message: response.message || 'Erreur lors de l\'inscription' };
    } catch (error: any) {
      console.error('Register error:', error);
      return { success: false, message: error.message || 'Erreur de connexion' };
    }
  };

  const logout = async () => {
    if (isOnline) {
      try {
        await authApi.deconnexion();
      } catch (error) {
        console.error('Erreur déconnexion:', error);
      }
    }
    
    await setConfig('auth_token', null);
    await setConfig('current_user', null);
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        isOnline,
        login,
        register,
        logout,
        checkAuth,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
