/**
 * EasyGest BP - Register Page
 * Beautiful multi-step registration flow
 */

import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { PINInput } from '@/components/PINInput';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Wifi, WifiOff, Loader2, Croissant, ArrowLeft, Check } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const ROLES = [
  { value: 'pointeur', label: 'Pointeur', description: 'Réception et retours de produits', icon: '📦' },
  { value: 'vendeur_boulangerie', label: 'Vendeur Boulangerie', description: 'Vente des produits de boulangerie', icon: '🥖' },
  { value: 'vendeur_patisserie', label: 'Vendeur Pâtisserie', description: 'Vente des produits de pâtisserie', icon: '🧁' },
];

export default function RegisterPage() {
  const navigate = useNavigate();
  const { register, isOnline } = useAuth();

  const [formData, setFormData] = useState({
    name: '',
    numero_telephone: '',
    role: '',
    code_pin: '',
    confirm_pin: '',
  });
  const [step, setStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleNext = () => {
    if (step === 1) {
      if (!formData.name.trim()) {
        setError('Veuillez entrer votre nom');
        return;
      }
      if (formData.numero_telephone.length < 9) {
        setError('Numéro de téléphone invalide');
        return;
      }
    } else if (step === 2) {
      if (!formData.role) {
        setError('Veuillez sélectionner un rôle');
        return;
      }
    }
    setError('');
    setStep(step + 1);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (formData.code_pin.length !== 6) {
      setError('Le code PIN doit contenir 6 chiffres');
      return;
    }

    if (formData.code_pin !== formData.confirm_pin) {
      setError('Les codes PIN ne correspondent pas');
      return;
    }

    if (!isOnline) {
      setError("L'inscription nécessite une connexion Internet");
      return;
    }

    setIsLoading(true);

    try {
      const result = await register({
        name: formData.name,
        numero_telephone: formData.numero_telephone,
        role: formData.role,
        code_pin: formData.code_pin,
      });

      if (result.success) {
        toast.success('Inscription réussie !');
        navigate('/dashboard');
      } else {
        setError(result.message);
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-secondary/50 via-background to-background">
      {/* Background decorations */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 right-0 w-96 h-96 bg-primary/5 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-primary/3 rounded-full blur-3xl" />
      </div>

      {/* Header */}
      <div className="relative z-10 p-4 flex items-center justify-between safe-area-top">
        <Link
          to="/login"
          className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
          <span className="text-sm font-medium">Retour</span>
        </Link>
        <div
          className={`flex items-center gap-2 px-3 py-1.5 rounded-full backdrop-blur-sm border ${
            isOnline
              ? 'bg-emerald-50/80 border-emerald-100 text-emerald-700'
              : 'bg-red-50/80 border-red-100 text-red-700'
          }`}
        >
          {isOnline ? (
            <>
              <Wifi className="w-4 h-4" />
              <span className="text-xs font-medium">En ligne</span>
            </>
          ) : (
            <>
              <WifiOff className="w-4 h-4" />
              <span className="text-xs font-medium">Hors ligne</span>
            </>
          )}
        </div>
      </div>

      {/* Main content */}
      <div className="relative z-10 flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-md">
          {/* Logo and title */}
          <div className="text-center mb-8 animate-fade-in">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center shadow-golden">
              <Croissant className="w-8 h-8 text-primary-foreground" />
            </div>
            <h1 className="font-display text-2xl font-bold text-foreground mb-2">
              Créer un compte
            </h1>
            <p className="text-muted-foreground text-sm">
              Étape {step} sur 3
            </p>

            {/* Progress bar */}
            <div className="flex gap-2 mt-6 px-4">
              {[1, 2, 3].map((s) => (
                <div
                  key={s}
                  className={cn(
                    'flex-1 h-1.5 rounded-full transition-all duration-500',
                    s < step
                      ? 'bg-primary'
                      : s === step
                      ? 'bg-primary animate-pulse'
                      : 'bg-muted'
                  )}
                />
              ))}
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="card-divine p-8 space-y-6 animate-fade-in-up">
            {/* Step 1: Basic info */}
            {step === 1 && (
              <div className="space-y-5 animate-fade-in">
                <div className="space-y-2">
                  <Label htmlFor="name">Nom complet</Label>
                  <Input
                    id="name"
                    type="text"
                    placeholder="Ex: Jean Dupont"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="input-golden h-12"
                    autoComplete="name"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="phone">Numéro de téléphone</Label>
                  <Input
                    id="phone"
                    type="tel"
                    inputMode="numeric"
                    placeholder="Ex: 612345678"
                    value={formData.numero_telephone}
                    onChange={(e) =>
                      setFormData({ ...formData, numero_telephone: e.target.value.replace(/\D/g, '') })
                    }
                    className="input-golden h-12"
                    autoComplete="tel"
                  />
                </div>
              </div>
            )}

            {/* Step 2: Role selection */}
            {step === 2 && (
              <div className="space-y-4 animate-fade-in">
                <Label>Sélectionnez votre rôle</Label>
                <div className="space-y-3">
                  {ROLES.map((role) => (
                    <button
                      key={role.value}
                      type="button"
                      onClick={() => setFormData({ ...formData, role: role.value })}
                      className={cn(
                        'w-full p-4 rounded-2xl text-left transition-all duration-300',
                        'border-2 group',
                        formData.role === role.value
                          ? 'border-primary bg-primary/5 shadow-md'
                          : 'border-border hover:border-primary/50 hover:bg-muted/50'
                      )}
                    >
                      <div className="flex items-center gap-4">
                        <span className="text-3xl">{role.icon}</span>
                        <div className="flex-1">
                          <p className="font-semibold">{role.label}</p>
                          <p className="text-sm text-muted-foreground">{role.description}</p>
                        </div>
                        {formData.role === role.value && (
                          <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center animate-scale-in">
                            <Check className="w-4 h-4 text-primary-foreground" />
                          </div>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Step 3: PIN creation */}
            {step === 3 && (
              <div className="space-y-8 animate-fade-in">
                <div className="space-y-3">
                  <Label className="text-center block">Créez votre code PIN (6 chiffres)</Label>
                  <PINInput
                    value={formData.code_pin}
                    onChange={(value) => setFormData({ ...formData, code_pin: value })}
                    autoFocus
                  />
                </div>

                <div className="space-y-3">
                  <Label className="text-center block">Confirmez votre code PIN</Label>
                  <PINInput
                    value={formData.confirm_pin}
                    onChange={(value) => setFormData({ ...formData, confirm_pin: value })}
                    error={formData.confirm_pin.length === 6 && formData.code_pin !== formData.confirm_pin}
                  />
                </div>
              </div>
            )}

            {error && (
              <div className="p-4 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-sm text-center animate-fade-in">
                {error}
              </div>
            )}

            {/* Buttons */}
            <div className="flex gap-3 pt-2">
              {step > 1 && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setStep(step - 1)}
                  className="flex-1 h-12 rounded-xl"
                  disabled={isLoading}
                >
                  Retour
                </Button>
              )}

              {step < 3 ? (
                <Button
                  type="button"
                  onClick={handleNext}
                  className="btn-golden flex-1 h-12"
                >
                  Continuer
                </Button>
              ) : (
                <Button
                  type="submit"
                  className="btn-golden flex-1 h-12"
                  disabled={
                    isLoading || formData.code_pin.length !== 6 || formData.confirm_pin.length !== 6
                  }
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      <span>Inscription...</span>
                    </>
                  ) : (
                    'Créer mon compte'
                  )}
                </Button>
              )}
            </div>
          </form>

          {/* Offline notice */}
          {!isOnline && (
            <div className="mt-6 p-4 rounded-2xl bg-destructive/10 border border-destructive/20 text-destructive text-sm text-center animate-fade-in">
              <WifiOff className="w-5 h-5 inline-block mr-2 -mt-0.5" />
              L'inscription nécessite une connexion Internet
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="relative z-10 p-6 text-center safe-area-bottom">
        <p className="text-xs text-muted-foreground">
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
