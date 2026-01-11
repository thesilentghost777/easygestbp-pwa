// LoginPage.tsx
import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { PINInput } from '@/components/PINInput';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Wifi, WifiOff, Loader2, Croissant, Settings } from 'lucide-react';
import { toast } from 'sonner';
import { setConfig } from '../lib/db'; // Import setConfig pour stocker l'API_URL

export default function LoginPage() {
  const navigate = useNavigate();
  const { login, isOnline, user, isLoading, isAuthenticated } = useAuth();
  const [phone, setPhone] = useState('');
  const [pin, setPin] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  
  // États pour la configuration API
  const [showConfig, setShowConfig] = useState(false);
  const [configPassword, setConfigPassword] = useState('');
  const [newApiUrl, setNewApiUrl] = useState('');
  const [configError, setConfigError] = useState('');

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      navigate('/dashboard');
    }
  }, [isLoading, isAuthenticated, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (phone.length < 9) {
      setError('Numéro de téléphone invalide');
      return;
    }

    if (pin.length !== 6) {
      setError('Le code PIN doit contenir 6 chiffres');
      return;
    }
    setIsSubmitting(true);

    try {
      const result = await login(phone, pin);

      if (result.success) {
        toast.success('Connexion réussie !');
        navigate('/dashboard');
      } else {
        setError(result.message);
        setPin('');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConfigSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setConfigError('');

    if (configPassword !== 'ghost') {
      setConfigError('Mot de passe incorrect');
      return;
    }

    if (!newApiUrl) {
      setConfigError('Veuillez entrer une URL valide');
      return;
    }

    try {
      await setConfig('api_url', newApiUrl);
      toast.success('URL API mise à jour avec succès !');
      setShowConfig(false);
      setConfigPassword('');
      setNewApiUrl('');
    } catch (err) {
      setConfigError('Erreur lors de la mise à jour');
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-golden-50 to-background">
      {/* Header avec indicateur réseau */}
      <div className="p-4 flex justify-between safe-area-top">
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-card/80 backdrop-blur-sm border">
          {isOnline ? (
            <>
              <div className="connection-indicator connection-online" />
              <Wifi className="w-4 h-4 text-success" />
              <span className="text-xs text-success">En ligne</span>
            </>
          ) : (
            <>
              <div className="connection-indicator connection-offline" />
              <WifiOff className="w-4 h-4 text-destructive" />
              <span className="text-xs text-destructive">Hors ligne</span>
            </>
          )}
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setShowConfig(!showConfig)}
          className="text-muted-foreground"
        >
          <Settings className="w-5 h-5" />
        </Button>
      </div>
      {/* Contenu principal */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-md">
          {/* Logo et titre */}
          <div className="text-center mb-8">
            <div className="w-20 h-20 mx-auto mb-4 rounded-2xl bg-primary/10 flex items-center justify-center shadow-golden">
              <Croissant className="w-10 h-10 text-primary" />
            </div>
            <h1 className="font-display text-3xl font-bold text-foreground mb-2">
              EasyGest BP
            </h1>
            <p className="text-muted-foreground">
              Gestion de boulangerie-pâtisserie
            </p>
          </div>
          {/* Formulaire de login */}
          <form onSubmit={handleSubmit} className="card-premium p-6 space-y-6">
            <div className="space-y-2">
              <Label htmlFor="phone">Numéro de téléphone</Label>
              <Input
                id="phone"
                type="tel"
                inputMode="numeric"
                placeholder="Ex: 612345678"
                value={phone}
                onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))}
                className="input-golden"
                disabled={isSubmitting}
                autoComplete="tel"
              />
            </div>
            <div className="space-y-2">
              <Label>Code PIN (6 chiffres)</Label>
              <PINInput
                value={pin}
                onChange={setPin}
                disabled={isSubmitting}
                error={!!error}
              />
            </div>
            {error && (
              <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm text-center animate-fade-in">
                {error}
              </div>
            )}
            <Button
              type="submit"
              className="btn-golden w-full"
              disabled={isSubmitting || pin.length !== 6}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Connexion...</span>
                </>
              ) : (
                'Se connecter'
              )}
            </Button>
            <div className="text-center">
              <Link
                to="/register"
                className="text-sm text-primary hover:underline"
              >
                Créer un compte
              </Link>
            </div>
          </form>
          {/* Formulaire de configuration API (affiché si showConfig est true) */}
          {showConfig && (
            <form onSubmit={handleConfigSubmit} className="card-premium p-6 space-y-6 mt-4">
              <div className="space-y-2">
                <Label htmlFor="config-password">Mot de passe (requis: "ghost")</Label>
                <Input
                  id="config-password"
                  type="password"
                  value={configPassword}
                  onChange={(e) => setConfigPassword(e.target.value)}
                  className="input-golden"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="new-api-url">Nouvelle URL API</Label>
                <Input
                  id="new-api-url"
                  type="url"
                  placeholder="Ex: http://192.168.1.166/api"
                  value={newApiUrl}
                  onChange={(e) => setNewApiUrl(e.target.value)}
                  className="input-golden"
                />
              </div>
              {configError && (
                <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm text-center animate-fade-in">
                  {configError}
                </div>
              )}
              <Button
                type="submit"
                className="btn-golden w-full"
                disabled={!configPassword || !newApiUrl}
              >
                Mettre à jour l'URL API
              </Button>
            </form>
          )}
          {/* Note mode offline */}
          {!isOnline && (
            <div className="mt-4 p-3 rounded-lg bg-warning/10 text-warning text-sm text-center">
              <WifiOff className="w-4 h-4 inline-block mr-2" />
              Mode hors ligne : connexion disponible uniquement si vous vous êtes déjà connecté sur cet appareil.
            </div>
          )}
        </div>
      </div>
      {/* Footer */}
      <div className="p-4 text-center text-xs text-muted-foreground safe-area-bottom">
        <p>© 2025 EasyGest BP - Tous droits réservés</p>
      </div>
    </div>
  );
}