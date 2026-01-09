/**
 * EasyGest BP - Page d'inscription
 */

import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { PINInput } from '@/components/PINInput';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Wifi, WifiOff, Loader2, Croissant, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';

const ROLES = [
  { value: 'pointeur', label: 'Pointeur', description: 'Réception et retours de produits' },
  { value: 'vendeur_boulangerie', label: 'Vendeur Boulangerie', description: 'Vente des produits de boulangerie' },
  { value: 'vendeur_patisserie', label: 'Vendeur Pâtisserie', description: 'Vente des produits de pâtisserie' },
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
      setError('L\'inscription nécessite une connexion Internet');
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
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-golden-50 to-background">
      {/* Header */}
      <div className="p-4 flex items-center justify-between safe-area-top">
        <Link to="/login" className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="w-5 h-5" />
          <span>Retour</span>
        </Link>
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-card/80 backdrop-blur-sm border">
          {isOnline ? (
            <>
              <Wifi className="w-4 h-4 text-success" />
              <span className="text-xs text-success">En ligne</span>
            </>
          ) : (
            <>
              <WifiOff className="w-4 h-4 text-destructive" />
              <span className="text-xs text-destructive">Hors ligne</span>
            </>
          )}
        </div>
      </div>

      {/* Contenu principal */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-md">
          {/* Logo et titre */}
          <div className="text-center mb-8">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-primary/10 flex items-center justify-center">
              <Croissant className="w-8 h-8 text-primary" />
            </div>
            <h1 className="font-display text-2xl font-bold text-foreground mb-2">
              Créer un compte
            </h1>
            <p className="text-muted-foreground text-sm">
              Étape {step} sur 3
            </p>
            {/* Progress bar */}
            <div className="flex gap-2 mt-4 px-8">
              {[1, 2, 3].map((s) => (
                <div
                  key={s}
                  className={`flex-1 h-1.5 rounded-full transition-colors ${
                    s <= step ? 'bg-primary' : 'bg-muted'
                  }`}
                />
              ))}
            </div>
          </div>

          {/* Formulaire */}
          <form onSubmit={handleSubmit} className="card-premium p-6 space-y-6">
            {/* Étape 1: Informations de base */}
            {step === 1 && (
              <div className="space-y-4 animate-fade-in">
                <div className="space-y-2">
                  <Label htmlFor="name">Nom complet</Label>
                  <Input
                    id="name"
                    type="text"
                    placeholder="Ex: Jean Dupont"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="input-golden"
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
                    onChange={(e) => setFormData({ ...formData, numero_telephone: e.target.value.replace(/\D/g, '') })}
                    className="input-golden"
                    autoComplete="tel"
                  />
                </div>
              </div>
            )}

            {/* Étape 2: Sélection du rôle */}
            {step === 2 && (
              <div className="space-y-4 animate-fade-in">
                <Label>Sélectionnez votre rôle</Label>
                <div className="space-y-3">
                  {ROLES.map((role) => (
                    <button
                      key={role.value}
                      type="button"
                      onClick={() => setFormData({ ...formData, role: role.value })}
                      className={`w-full p-4 rounded-lg border-2 text-left transition-all ${
                        formData.role === role.value
                          ? 'border-primary bg-primary/5'
                          : 'border-border hover:border-primary/50'
                      }`}
                    >
                      <p className="font-medium">{role.label}</p>
                      <p className="text-sm text-muted-foreground">{role.description}</p>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Étape 3: Code PIN */}
            {step === 3 && (
              <div className="space-y-6 animate-fade-in">
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
              <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm text-center animate-fade-in">
                {error}
              </div>
            )}

            {/* Boutons */}
            <div className="flex gap-3">
              {step > 1 && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setStep(step - 1)}
                  className="flex-1"
                  disabled={isLoading}
                >
                  Retour
                </Button>
              )}
              
              {step < 3 ? (
                <Button
                  type="button"
                  onClick={handleNext}
                  className="btn-golden flex-1"
                >
                  Continuer
                </Button>
              ) : (
                <Button
                  type="submit"
                  className="btn-golden flex-1"
                  disabled={isLoading || formData.code_pin.length !== 6 || formData.confirm_pin.length !== 6}
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

          {/* Note mode offline */}
          {!isOnline && (
            <div className="mt-4 p-3 rounded-lg bg-destructive/10 text-destructive text-sm text-center">
              <WifiOff className="w-4 h-4 inline-block mr-2" />
              L'inscription nécessite une connexion Internet
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
