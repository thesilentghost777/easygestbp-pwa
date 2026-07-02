import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { getConfig, setConfig, initDB, getDB } from '@/lib/db';
import { authApi, checkConnection } from '@/lib/api';
import { toast } from 'sonner';
import { fullSync } from '@/lib/sync';

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
  lastSyncTime: Date | null;
  login: (phone: string, pin: string) => Promise<{ success: boolean; message: string }>;
  register: (data: {
    name: string;
    numero_telephone: string;
    role: string;
    code_pin: string;
  }) => Promise<{ success: boolean; message: string }>;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
  triggerSync: () => Promise<void>;
  /**
   * VERROU D'INVENTAIRE
   * Quand activé :
   *  - Le ping vers le serveur est suspendu
   *  - La reconnexion automatique est suspendue
   *  - La synchro périodique est suspendue
   * Le front ne se rechargera donc pas pendant une saisie d'inventaire.
   */
  lockInventory: () => void;
  unlockInventory: () => void;
  isInventoryLocked: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// ─── Normaliser l'utilisateur depuis la réponse API ───────────────────────────
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

// ─── Stocker le PIN localement pour usage offline ─────────────────────────────
async function storeOfflinePin(phone: string, pin: string): Promise<void> {
  console.log('💾 [storeOfflinePin] Stockage du PIN pour:', phone);
  const storedPins = await getConfig<Record<string, string>>('offline_pins') || {};
  storedPins[phone] = pin;
  await setConfig('offline_pins', storedPins);
  console.log('✅ [storeOfflinePin] PIN stocké avec succès');
}

// ─── Vérifier le PIN avec les données locales ─────────────────────────────────
async function verifyOfflinePin(pin: string, phone: string): Promise<User | null> {
  try {
    console.log('🔍 [verifyOfflinePin] Vérification pour:', phone);
    const db = await getDB();
    const allUsers = await db.getAll('users');
    const user = allUsers.find(u => u.numero_telephone === phone);

    if (!user) {
      console.log('❌ [verifyOfflinePin] Utilisateur non trouvé');
      return null;
    }
    const storedPins = await getConfig<Record<string, string>>('offline_pins') || {};
    const storedPin = storedPins[phone];
    if (storedPin && storedPin === pin) {
      console.log('✅ [verifyOfflinePin] PIN correct!');
      return normalizeUser(user);
    }
    console.log('❌ [verifyOfflinePin] PIN incorrect ou absent');
    return null;
  } catch (error) {
    console.error('❌ [verifyOfflinePin] Erreur:', error);
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);

  // ── VERROU D'INVENTAIRE ──────────────────────────────────────────────────
  // On utilise à la fois un ref (pour être lisible dans les callbacks sans
  // déclencher de re-render) ET un state (pour exposer la valeur aux composants).
  const inventoryLockRef = useRef(false);
  const [isInventoryLocked, setIsInventoryLocked] = useState(false);

  const lockInventory = useCallback(() => {
    console.log('🔒 [InventoryLock] Verrou activé — ping et synchro suspendus');
    inventoryLockRef.current = true;
    setIsInventoryLocked(true);
  }, []);

  const unlockInventory = useCallback(() => {
    console.log('🔓 [InventoryLock] Verrou désactivé — ping et synchro repris');
    inventoryLockRef.current = false;
    setIsInventoryLocked(false);
  }, []);
  // ────────────────────────────────────────────────────────────────────────

  const isReconnecting = useRef(false);
  const lastOnlineState = useRef(navigator.onLine);
  const isSyncing = useRef(false);

  // ── Synchronisation globale ───────────────────────────────────────────────
  const triggerSync = useCallback(async () => {
    // Si l'inventaire est en cours, on ne synchro pas
    if (inventoryLockRef.current) {
      console.log('🔒 [Sync] Verrou inventaire actif — synchro ignorée');
      return;
    }
    if (isSyncing.current) {
      console.log('⏳ [Sync] Synchronisation déjà en cours, ignoré');
      return;
    }
    try {
      isSyncing.current = true;
      console.log('🔄 [Sync] Début de la synchronisation globale...');
      window.dispatchEvent(new CustomEvent('global-sync-start'));
      const result = await fullSync();
      if (result.success) {
        setLastSyncTime(new Date());
        console.log('✅ [Sync] Synchronisation globale terminée');
        window.dispatchEvent(new CustomEvent('global-sync-complete'));
        toast.success('Données synchronisées', {
          description: 'Toutes vos données sont à jour',
          duration: 2000,
        });
      } else {
        throw new Error(result.message);
      }
    } catch (error) {
      console.error('❌ [Sync] Erreur de synchronisation:', error);
      window.dispatchEvent(new CustomEvent('global-sync-error'));
      toast.error('Erreur de synchronisation', {
        description: 'Impossible de synchroniser les données',
      });
    } finally {
      isSyncing.current = false;
    }
  }, []);

  // ── Reconnexion automatique ───────────────────────────────────────────────
  const attemptAutoReconnect = useCallback(async () => {
    // Si le verrou est actif, on ne fait rien
    if (inventoryLockRef.current) {
      console.log('🔒 [AutoReconnect] Verrou inventaire actif — reconnexion ignorée');
      return;
    }
    if (isReconnecting.current) return;

    try {
      isReconnecting.current = true;
      console.log('🔄 [AutoReconnect] Tentative de reconnexion automatique...');

      const storedUser = await getConfig<User>('current_user');
      if (!storedUser) {
        console.log('❌ [AutoReconnect] Aucun utilisateur stocké');
        return;
      }
      const token = await getConfig<string>('auth_token');

      if (token) {
        console.log('🔑 [AutoReconnect] Token trouvé, vérification avec /me...');
        const response = await authApi.me();
        if (response.success && response.data?.user) {
          const normalizedUser = normalizeUser(response.data.user);
          if (normalizedUser) {
            await setConfig('current_user', normalizedUser);
            setUser(normalizedUser);
            console.log('✅ [AutoReconnect] Vérification avec token réussie!');
            await triggerSync();
            toast.success('Reconnecté automatiquement', {
              description: 'Vous êtes de nouveau en ligne',
            });
            return;
          }
        } else {
          console.log('❌ [AutoReconnect] Token invalide ou expiré, fallback sur login avec PIN');
        }
      } else {
        console.log('⚠️ [AutoReconnect] Pas de token, fallback sur PIN');
      }

      const storedPins = await getConfig<Record<string, string>>('offline_pins') || {};
      const pin = storedPins[storedUser.numero_telephone];

      if (!pin) {
        console.log('❌ [AutoReconnect] Aucun PIN stocké pour cet utilisateur');
        return;
      }
      console.log('🔑 [AutoReconnect] PIN trouvé, tentative de login...');

      const response = await authApi.connexion({
        numero_telephone: storedUser.numero_telephone,
        code_pin: pin,
      });
      const apiUser = response.data?.user || (response as any).user;
      const newToken = response.data?.token || (response as any).token;

      if (response.success && apiUser) {
        const normalizedUser = normalizeUser(apiUser);
        if (normalizedUser) {
          await setConfig('current_user', normalizedUser);
          if (newToken) await setConfig('auth_token', newToken);
          setUser(normalizedUser);
          console.log('✅ [AutoReconnect] Reconnexion avec PIN réussie!');
          await triggerSync();
          toast.success('Reconnecté automatiquement', {
            description: 'Vous êtes de nouveau en ligne',
          });
        }
      } else {
        console.log('❌ [AutoReconnect] Échec de la reconnexion avec PIN');
      }
    } catch (error) {
      console.error('❌ [AutoReconnect] Erreur:', error);
    } finally {
      isReconnecting.current = false;
    }
  }, [triggerSync]);

  // ── Surveillance réseau ───────────────────────────────────────────────────
  useEffect(() => {
    const handleOnlineStatusChange = async (online: boolean) => {
      // Si le verrou est actif, on ignore tout changement réseau
      if (inventoryLockRef.current) {
        console.log('🔒 [Network] Verrou inventaire actif — changement réseau ignoré');
        return;
      }

      console.log(`🌐 État de connexion changé: ${online ? 'EN LIGNE' : 'HORS LIGNE'}`);
      setIsOnline(online);

      if (online && !lastOnlineState.current && user) {
        console.log('🔄 Passage en ligne détecté avec utilisateur connecté');
        setTimeout(() => {
          attemptAutoReconnect();
        }, 1000);
      }

      lastOnlineState.current = online;
    };

    const handleOnline = () => handleOnlineStatusChange(true);
    const handleOffline = () => handleOnlineStatusChange(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Vérification initiale
    checkConnection().then(setIsOnline);

    // ── Ping toutes les 5 secondes ──────────────────────────────────────────
    const connectivityInterval = setInterval(async () => {
      // VERROU : si un inventaire est en cours, on ne ping pas
      if (inventoryLockRef.current) {
        console.log('🔒 [Ping] Verrou inventaire actif — ping ignoré');
        return;
      }

      const online = await checkConnection();
      if (online !== isOnline) {
        handleOnlineStatusChange(online);
      }
    }, 5000);

    // ── Synchro auto toutes les 3 heures ───────────────────────────────────
    const syncInterval = setInterval(async () => {
      // VERROU : si un inventaire est en cours, on ne synchro pas
      if (inventoryLockRef.current) {
        console.log('🔒 [AutoSync] Verrou inventaire actif — synchro ignorée');
        return;
      }

      const online = await checkConnection();
      if (online && user) {
        console.log('🔄 [AutoSync] Synchronisation automatique (3h)...');
        await triggerSync();
      }
    }, 10800000);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(connectivityInterval);
      clearInterval(syncInterval);
    };
  }, [isOnline, user, attemptAutoReconnect, triggerSync]);

  // ── Vérification de l'authentification au démarrage ──────────────────────
  const checkAuth = useCallback(async () => {
    setIsLoading(true);
    try {
      await initDB();
      const storedUser = await getConfig<User>('current_user');
      const token = await getConfig<string>('auth_token');

      if (storedUser) {
        setUser(storedUser);
        if (isOnline) {
          try {
            const response = await authApi.me();
            if (response.success && response.data?.user) {
              const normalizedUser = normalizeUser(response.data.user);
              if (normalizedUser) {
                setUser(normalizedUser);
                await setConfig('current_user', normalizedUser);
              }
            } else if (!token) {
              console.log('📴 Utilisateur en mode offline, session maintenue');
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

  // ── Login ─────────────────────────────────────────────────────────────────
  const login = async (phone: string, pin: string): Promise<{ success: boolean; message: string }> => {
    console.log('🔐 [login] Tentative de connexion pour:', phone);
    console.log('🔐 [login] Mode:', isOnline ? 'EN LIGNE' : 'HORS LIGNE');

    if (!isOnline) {
      try {
        console.log('📴 [login] Mode offline - vérification locale...');
        const offlineUser = await verifyOfflinePin(pin, phone);
        if (offlineUser) {
          console.log('✅ [login] Connexion offline réussie pour:', offlineUser.name);
          setUser(offlineUser);
          await setConfig('current_user', offlineUser);
          return { success: true, message: 'Connexion en mode hors ligne' };
        }
        console.log('❌ [login] Échec de connexion offline');
        return {
          success: false,
          message: 'Code PIN incorrect ou aucune connexion préalable enregistrée',
        };
      } catch (error) {
        console.error('❌ [login] Erreur login offline:', error);
        return { success: false, message: 'Erreur lors de la connexion hors ligne' };
      }
    }

    try {
      console.log('🌐 [login] Mode online - appel API...');
      const response = await authApi.connexion({
        numero_telephone: phone,
        code_pin: pin,
      });
      const apiUser = response.data?.user || (response as any).user;
      const token = response.data?.token || (response as any).token;

      if (response.success && apiUser) {
        const normalizedUser = normalizeUser(apiUser);
        if (normalizedUser) {
          await setConfig('current_user', normalizedUser);
          await storeOfflinePin(phone, pin);
          if (token) await setConfig('auth_token', token);
          setUser(normalizedUser);
          await triggerSync();
          console.log('✅ [login] Connexion online réussie');
          return { success: true, message: 'Connexion réussie' };
        }
      }
      console.log('❌ [login] Échec connexion online:', response.message);
      return { success: false, message: response.message || 'Identifiants incorrects' };
    } catch (error: any) {
      console.error('❌ [login] Erreur:', error);
      return { success: false, message: error.message || 'Erreur de connexion' };
    }
  };

  // ── Register ──────────────────────────────────────────────────────────────
  const register = async (data: {
    name: string;
    numero_telephone: string;
    role: string;
    code_pin: string;
  }): Promise<{ success: boolean; message: string }> => {
    if (!isOnline) {
      return { success: false, message: "L'inscription nécessite une connexion Internet" };
    }
    try {
      const response = await authApi.inscription({
        name: data.name,
        numero_telephone: data.numero_telephone,
        role: data.role,
        code_pin: data.code_pin,
      });
      const apiUser = response.data?.user || (response as any).user;
      const token = response.data?.token || (response as any).token;

      if (response.success && apiUser) {
        const normalizedUser = normalizeUser(apiUser);
        if (normalizedUser) {
          await setConfig('current_user', normalizedUser);
          await storeOfflinePin(data.numero_telephone, data.code_pin);
          if (token) await setConfig('auth_token', token);
          setUser(normalizedUser);
          await triggerSync();
          return { success: true, message: 'Inscription réussie' };
        }
      }
      return { success: false, message: response.message || "Erreur lors de l'inscription" };
    } catch (error: any) {
      console.error('Register error:', error);
      return { success: false, message: error.message || 'Erreur de connexion' };
    }
  };

  // ── Logout ────────────────────────────────────────────────────────────────
  const logout = async () => {
    // S'assurer qu'on déverrouille si jamais on logout pendant un inventaire
    inventoryLockRef.current = false;
    setIsInventoryLocked(false);

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
    setLastSyncTime(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        isOnline,
        lastSyncTime,
        login,
        register,
        logout,
        checkAuth,
        triggerSync,
        lockInventory,
        unlockInventory,
        isInventoryLocked,
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