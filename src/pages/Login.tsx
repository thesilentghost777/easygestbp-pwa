/**
 * EasyGest BP - Login Page
 * Divine authentication experience
 */

import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { PINInput } from '@/components/PINInput';
import { DivineLoader } from '@/components/DivineLoader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Wifi, WifiOff, Loader2, Croissant, Settings, X } from 'lucide-react';
import { toast } from 'sonner';
import { setConfig } from '@/lib/db';

export default function LoginPage() {
  const navigate = useNavigate();
  const { login, isOnline, isLoading: authLoading, isAuthenticated } = useAuth();
  const [phone, setPhone] = useState('');
  const [pin, setPin] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Config API states
  const [showConfig, setShowConfig] = useState(false);
  const [configPassword, setConfigPassword] = useState('');
  const [newApiUrl, setNewApiUrl] = useState('');
  const [configError, setConfigError] = useState('');

  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      navigate('/dashboard');
    }
  }, [authLoading, isAuthenticated, navigate]);

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
    } catch {
      setConfigError('Erreur lors de la mise à jour');
    }
  };

  if (authLoading) {
    return <DivineLoader message="Vérification de la session..." />;
  }

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-secondary/50 via-background to-background">
      {/* Background decorations */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-primary/5 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-primary/3 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-0 w-96 h-96 bg-primary/3 rounded-full blur-3xl" />
      </div>

      {/* Header */}
      <div className="relative z-10 p-4 flex justify-between safe-area-top">
        <div
          className={`flex items-center gap-2 px-3 py-1.5 rounded-full backdrop-blur-sm border ${
            isOnline
              ? 'bg-emerald-50/80 border-emerald-100 text-emerald-700'
              : 'bg-red-50/80 border-red-100 text-red-700'
          }`}
        >
          {isOnline ? (
            <>
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <Wifi className="w-4 h-4" />
              <span className="text-xs font-medium">En ligne</span>
            </>
          ) : (
            <>
              <div className="w-2 h-2 rounded-full bg-red-500" />
              <WifiOff className="w-4 h-4" />
              <span className="text-xs font-medium">Hors ligne</span>
            </>
          )}
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setShowConfig(!showConfig)}
          className="text-muted-foreground rounded-xl"
        >
          <Settings className="w-5 h-5" />
        </Button>
      </div>

      {/* Main content */}
      <div className="relative z-10 flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-md">
          {/* Logo and title */}
          <div className="text-center mb-10 animate-fade-in-up">
            <div className="relative inline-block mb-6">
              {/* Glow effect */}
              <div className="absolute inset-0 bg-primary/20 rounded-3xl blur-2xl scale-150" />
              <div className="relative w-24 h-24 rounded-3xl bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center shadow-golden">
                <Croissant className="w-12 h-12 text-primary-foreground" />
              </div>
            </div>
            <h1 className="font-display text-4xl font-bold text-foreground mb-2">
              EasyGest BP
            </h1>
            <p className="text-muted-foreground text-lg">
              Gestion de boulangerie-pâtisserie
            </p>
          </div>

          {/* Login form */}
          <form
            onSubmit={handleSubmit}
            className="card-divine p-8 space-y-6 animate-fade-in-up"
            style={{ animationDelay: '100ms' }}
          >
            <div className="space-y-2">
              <Label htmlFor="phone" className="text-sm font-medium">
                Numéro de téléphone
              </Label>
              <Input
                id="phone"
                type="tel"
                inputMode="numeric"
                placeholder="Ex: 612345678"
                value={phone}
                onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))}
                className="input-golden h-12"
                disabled={isSubmitting}
                autoComplete="tel"
              />
            </div>

            <div className="space-y-3">
              <Label className="text-sm font-medium">Code PIN (6 chiffres)</Label>
              <PINInput
                value={pin}
                onChange={setPin}
                disabled={isSubmitting}
                error={!!error}
              />
            </div>

            {error && (
              <div className="p-4 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-sm text-center animate-fade-in">
                {error}
              </div>
            )}

            <Button
              type="submit"
              className="btn-golden w-full h-12 text-base"
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

            <div className="text-center pt-2">
              <Link
                to="/register"
                className="text-sm text-primary hover:underline font-medium"
              >
                Créer un compte
              </Link>
            </div>
          </form>

          {/* Config modal */}
          {showConfig && (
            <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
              <div className="w-full max-w-md bg-card rounded-3xl shadow-divine p-6 animate-scale-in">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="font-display text-lg font-semibold">Configuration API</h3>
                  <Button variant="ghost" size="icon" onClick={() => setShowConfig(false)} className="rounded-xl">
                    <X className="w-5 h-5" />
                  </Button>
                </div>
                
                <form onSubmit={handleConfigSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="config-password">Mot de passe admin</Label>
                    <Input
                      id="config-password"
                      type="password"
                      value={configPassword}
                      onChange={(e) => setConfigPassword(e.target.value)}
                      className="input-golden"
                      placeholder="••••••"
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
                    <div className="p-3 rounded-xl bg-destructive/10 text-destructive text-sm text-center">
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
              </div>
            </div>
          )}

          {/* Offline notice */}
          {!isOnline && (
            <div className="mt-6 p-4 rounded-2xl bg-amber-50 border border-amber-100 text-amber-700 text-sm text-center animate-fade-in">
              <WifiOff className="w-5 h-5 inline-block mr-2 -mt-0.5" />
              Mode hors ligne : connexion disponible uniquement si vous vous êtes déjà connecté sur cet appareil.
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="relative z-10 p-6 text-center safe-area-bottom">
        <p className="text-xs text-muted-foreground">
          © 2025 EasyGest BP - Tous droits réservés
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          powered by{' '}
          <a
            href="https://techforgesolution237.site"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:underline font-medium"
          >
            TFS237
          </a>
        </p>
      </div>
    </div>
  );
}
