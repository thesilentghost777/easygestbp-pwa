/**
 * EasyGest BP - API Client
 * Communication avec le backend Laravel
 */

import { getConfig, setConfig } from './db';

// Configuration API
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';

const DEFAULT_HEADERS = {
  'Content-Type': 'application/json',
  'Accept': 'application/json',
};

// Types de réponse API
export interface ApiResponse<T = any> {
  success: boolean;
  message?: string;
  data?: T;
  error?: string;
}

export interface AuthResponse {
  success: boolean;
  message: string;
  user: {
    id: number;
    name: string;
    numero_telephone: string;
    role: string;
    actif: boolean;
    preferred_language: string;
  };
  token: string;
  client_id?: string;
}

// Gestion du token
async function getAuthToken(): Promise<string | null> {
  return getConfig<string>('auth_token');
}

async function getClientId(): Promise<string | null> {
  return getConfig<string>('client_id');
}

// Client API principal
async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  const token = await getAuthToken();
  const clientId = await getClientId();
  
  const headers: Record<string, string> = {
    ...DEFAULT_HEADERS,
    ...(options.headers as Record<string, string>),
  };
  
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  
  if (clientId) {
    headers['X-Client-ID'] = clientId;
  }
  
  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers,
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      return {
        success: false,
        message: data.message || 'Une erreur est survenue',
        error: data.error,
      };
    }
    
    return data;
  } catch (error) {
    // Erreur réseau
    console.error('API Error:', error);
    return {
      success: false,
      message: 'Impossible de contacter le serveur',
      error: error instanceof Error ? error.message : 'Network error',
    };
  }
}

// Endpoints Authentification
export const authApi = {
  async inscription(data: {
    name: string;
    numero_telephone: string;
    role: string;
    code_pin: string;
    preferred_language?: string;
    has_client_id?: boolean;
    client_id?: string;
    device_info?: string;
  }): Promise<ApiResponse<AuthResponse>> {
    const response = await apiRequest<AuthResponse>('/auth/inscription', {
      method: 'POST',
      body: JSON.stringify({
        ...data,
        has_client_id: false,
        device_info: navigator.userAgent,
      }),
    });
    
    if (response.success && response.data) {
      await setConfig('auth_token', response.data.token);
      await setConfig('client_id', response.data.client_id);
      await setConfig('current_user', response.data.user);
    }
    
    return response;
  },
  
  async connexion(data: {
    numero_telephone: string;
    code_pin: string;
  }): Promise<ApiResponse<AuthResponse>> {
    const response = await apiRequest<AuthResponse>('/auth/connexion', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    
    if (response.success && response.data) {
      await setConfig('auth_token', response.data.token);
      await setConfig('current_user', response.data.user);
    }
    
    return response;
  },
  
  async deconnexion(): Promise<ApiResponse<void>> {
    const response = await apiRequest<void>('/auth/deconnexion', {
      method: 'POST',
    });
    
    await setConfig('auth_token', null);
    await setConfig('current_user', null);
    
    return response;
  },
  
  async me(): Promise<ApiResponse<{ user: AuthResponse['user'] }>> {
    return apiRequest('/auth/me');
  },
};

// Endpoints Produits
export const produitsApi = {
  async getAll(actifOnly = true): Promise<ApiResponse<any[]>> {
    return apiRequest(`/produits?actif_only=${actifOnly}`);
  },
  
  async getByCategorie(categorie: 'boulangerie' | 'patisserie'): Promise<ApiResponse<any[]>> {
    return apiRequest(`/produits/categorie/${categorie}`);
  },
};

// Endpoints Utilisateurs
export const usersApi = {
  async getAll(): Promise<ApiResponse<any[]>> {
    return apiRequest('/users');
  },
  
  async getByRole(role: string): Promise<ApiResponse<any[]>> {
    return apiRequest(`/users/role/${role}`);
  },
  
  async getProducteurs(): Promise<ApiResponse<any[]>> {
    return apiRequest('/users/producteurs');
  },
};

// Endpoints Réceptions
export const receptionsApi = {
  async create(data: {
    producteur_id: number;
    produit_id: number;
    quantite: number;
    notes?: string;
  }): Promise<ApiResponse<any>> {
    return apiRequest('/receptions', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },
  
  async update(id: number, data: {
    quantite?: number;
    notes?: string;
  }): Promise<ApiResponse<any>> {
    return apiRequest(`/receptions/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },
  
  async getMesReceptions(date?: string): Promise<ApiResponse<any[]>> {
    const params = date ? `?date=${date}` : '';
    return apiRequest(`/receptions/mes-receptions${params}`);
  },
  
  async getReceptionsVendeur(date?: string): Promise<ApiResponse<any[]>> {
    const params = date ? `?date=${date}` : '';
    return apiRequest(`/vendeur/receptions${params}`);
  },
};

// Endpoints Retours
export const retoursApi = {
  async create(data: {
    produit_id: number;
    quantite: number;
    raison: 'perime' | 'abime' | 'autre';
    description?: string;
  }): Promise<ApiResponse<any>> {
    return apiRequest('/retours', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },
  
  async update(id: number, data: {
    quantite?: number;
    raison?: string;
    description?: string;
  }): Promise<ApiResponse<any>> {
    return apiRequest(`/retours/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },
  
  async getRetoursVendeur(date?: string): Promise<ApiResponse<any[]>> {
    const params = date ? `?date=${date}` : '';
    return apiRequest(`/vendeur/retours${params}`);
  },
};

// Endpoints Inventaires
export const inventairesApi = {
  async creer(data: {
    vendeur_sortant_id: number;
    vendeur_entrant_id: number;
    code_pin_sortant: string;
    code_pin_entrant: string;
    produits: { produit_id: number; quantite_restante: number }[];
  }): Promise<ApiResponse<any>> {
    return apiRequest('/inventaires/creer', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },
  
  async getMesInventaires(): Promise<ApiResponse<any[]>> {
    return apiRequest('/inventaires/mes-inventaires');
  },
  
  async getEnCours(): Promise<ApiResponse<any>> {
    return apiRequest('/inventaires/en-cours');
  },
};

// Endpoints Sessions de vente
export const sessionsApi = {
  async ouvrir(data: {
    categorie: 'boulangerie' | 'patisserie';
    fond_vente: number;
    orange_money_initial?: number;
    mtn_money_initial?: number;
  }): Promise<ApiResponse<any>> {
    return apiRequest('/sessions-vente/ouvrir', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },
  
  async getActive(): Promise<ApiResponse<any>> {
    return apiRequest('/sessions-vente/active');
  },
  
  async getHistorique(params?: {
    statut?: string;
    date_debut?: string;
    date_fin?: string;
  }): Promise<ApiResponse<any>> {
    const searchParams = new URLSearchParams();
    if (params?.statut) searchParams.append('statut', params.statut);
    if (params?.date_debut) searchParams.append('date_debut', params.date_debut);
    if (params?.date_fin) searchParams.append('date_fin', params.date_fin);
    
    const query = searchParams.toString();
    return apiRequest(`/sessions-vente/historique${query ? `?${query}` : ''}`);
  },
};

// Endpoints Flux produits
export const fluxApi = {
  async getMonFlux(date?: string): Promise<ApiResponse<any[]>> {
    const params = date ? `?date=${date}` : '';
    return apiRequest(`/flux/mon-flux${params}`);
  },
};

// Endpoints Synchronisation
export const syncApi = {
  async pull(lastSync?: string): Promise<ApiResponse<any>> {
    const params = lastSync ? `?last_sync=${encodeURIComponent(lastSync)}` : '';
    return apiRequest(`/sync/pull${params}`);
  },
  
  async push(data: {
    receptions?: any[];
    retours?: any[];
    inventaires?: any[];
    inventaire_details?: any[];
    sessions?: any[];
    ventes?: any[];
  }): Promise<ApiResponse<any>> {
    return apiRequest('/sync/push', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },
  
  async ack(syncedData: { table: string; ids: number[] }[]): Promise<ApiResponse<void>> {
    return apiRequest('/sync/ack', {
      method: 'POST',
      body: JSON.stringify({ synced_data: syncedData }),
    });
  },
  
  async status(): Promise<ApiResponse<any>> {
    return apiRequest('/sync/status');
  },
};

// Vérification de la connexion
export async function checkConnection(): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE_URL}/health`, {
      method: 'GET',
      headers: DEFAULT_HEADERS,
    });
    return response.ok;
  } catch {
    return false;
  }
}
