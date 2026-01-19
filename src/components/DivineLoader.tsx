/**
 * EasyGest BP - Divine Loading Screen
 * Beautiful animated loading screen with logo
 */

import React from 'react';
import { Croissant } from 'lucide-react';

interface DivineLoaderProps {
  message?: string;
  showLogo?: boolean;
}

export function DivineLoader({ message = 'Chargement...', showLogo = true }: DivineLoaderProps) {
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-gradient-to-br from-background via-secondary/20 to-background">
      {/* Background decorations */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-primary/5 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-primary/3 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 flex flex-col items-center">
        {showLogo && (
          <div className="relative mb-8">
            {/* Outer glow ring */}
            <div className="absolute inset-0 scale-150">
              <div className="w-full h-full rounded-full bg-primary/10 animate-ping" style={{ animationDuration: '2s' }} />
            </div>
            
            {/* Rotating rings */}
            <div className="relative w-24 h-24">
              {/* Outer ring */}
              <div className="absolute inset-0 rounded-full border-2 border-primary/20" />
              <div 
                className="absolute inset-0 rounded-full border-2 border-transparent border-t-primary"
                style={{ animation: 'spin 1.5s linear infinite' }}
              />
              
              {/* Inner ring */}
              <div className="absolute inset-3 rounded-full border-2 border-primary/10" />
              <div 
                className="absolute inset-3 rounded-full border-2 border-transparent border-t-primary/60"
                style={{ animation: 'spin 1s linear infinite reverse' }}
              />
              
              {/* Logo center */}
              <div className="absolute inset-6 rounded-full bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center shadow-golden">
                <Croissant className="w-6 h-6 text-primary-foreground" />
              </div>
            </div>
          </div>
        )}

        {/* App name */}
        <h1 className="font-display text-2xl font-bold text-foreground mb-2 animate-fade-in">
          EasyGest BP
        </h1>
        
        {/* Loading message */}
        <p className="text-muted-foreground text-sm animate-fade-in" style={{ animationDelay: '200ms' }}>
          {message}
        </p>

        {/* Loading dots */}
        <div className="flex gap-1.5 mt-6">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="w-2 h-2 rounded-full bg-primary"
              style={{
                animation: 'bounce 1s ease-in-out infinite',
                animationDelay: `${i * 0.15}s`,
              }}
            />
          ))}
        </div>
      </div>

      {/* Footer */}
      <div className="absolute bottom-8 text-center animate-fade-in" style={{ animationDelay: '500ms' }}>
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

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes bounce {
          0%, 100% { transform: translateY(0); opacity: 1; }
          50% { transform: translateY(-8px); opacity: 0.5; }
        }
      `}</style>
    </div>
  );
}

/**
 * Inline loader for components
 */
export function InlineLoader({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const sizes = {
    sm: 'w-5 h-5',
    md: 'w-8 h-8',
    lg: 'w-12 h-12',
  };

  return (
    <div className="flex items-center justify-center py-8">
      <div className={`${sizes[size]} relative`}>
        <div className="absolute inset-0 rounded-full border-2 border-primary/20" />
        <div 
          className="absolute inset-0 rounded-full border-2 border-transparent border-t-primary"
          style={{ animation: 'spin 1s linear infinite' }}
        />
      </div>
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

/**
 * Splash screen for vendor change
 */
export function VendeurSplash({ vendeurName }: { vendeurName: string }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gradient-to-br from-primary/10 via-background to-primary/5">
      <div className="text-center space-y-6 animate-fade-in-up p-8">
        {/* Icon */}
        <div className="relative w-24 h-24 mx-auto">
          <div className="absolute inset-0 bg-primary/20 rounded-full animate-ping" style={{ animationDuration: '1.5s' }} />
          <div className="relative w-24 h-24 rounded-full bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center shadow-golden">
            <svg className="w-12 h-12 text-primary-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          </div>
        </div>

        {/* Text */}
        <div className="space-y-2">
          <h2 className="font-display text-2xl font-bold text-foreground">
            Changement de vendeur
          </h2>
          <p className="text-lg text-muted-foreground">
            Le vendeur actif sera désormais
          </p>
          <p className="text-2xl font-bold text-primary">
            {vendeurName}
          </p>
        </div>

        {/* Loading indicator */}
        <div className="flex gap-2 justify-center mt-8">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="w-3 h-3 rounded-full bg-primary"
              style={{
                animation: 'bounce 1s ease-in-out infinite',
                animationDelay: `${i * 0.15}s`,
              }}
            />
          ))}
        </div>
      </div>

      <style>{`
        @keyframes bounce {
          0%, 100% { transform: translateY(0); opacity: 1; }
          50% { transform: translateY(-10px); opacity: 0.5; }
        }
      `}</style>
    </div>
  );
}
