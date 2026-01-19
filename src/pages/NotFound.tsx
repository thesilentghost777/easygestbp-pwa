/**
 * EasyGest BP - Not Found Page
 * Beautiful 404 error page
 */

import React from 'react';
import { Link } from 'react-router-dom';
import { Home, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-secondary/50 via-background to-background p-6">
      {/* Background decorations */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-primary/5 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-primary/3 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 text-center max-w-md animate-fade-in-up">
        {/* 404 Number */}
        <div className="relative mb-8">
          <span className="font-display text-[150px] md:text-[200px] font-bold text-primary/10 leading-none select-none">
            404
          </span>
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center shadow-golden">
              <span className="text-4xl">🥐</span>
            </div>
          </div>
        </div>

        {/* Message */}
        <h1 className="font-display text-3xl font-bold text-foreground mb-4">
          Page introuvable
        </h1>
        <p className="text-muted-foreground text-lg mb-8">
          Oups ! Cette page semble avoir été emportée par le vent... comme un croissant frais !
        </p>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Button asChild variant="outline" className="rounded-xl h-12">
            <Link to="/" className="flex items-center gap-2">
              <ArrowLeft className="w-5 h-5" />
              Retour
            </Link>
          </Button>
          <Button asChild className="btn-golden h-12">
            <Link to="/dashboard" className="flex items-center gap-2">
              <Home className="w-5 h-5" />
              Accueil
            </Link>
          </Button>
        </div>
      </div>

      {/* Footer */}
      <div className="absolute bottom-8 text-center">
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
