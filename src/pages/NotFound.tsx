/**
 * EasyGest BP - Custom Not Found Handler
 * Affiche une animation puissante avec navigation
 */

import React from 'react';
import { Link } from 'react-router-dom';
import { Home, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { motion } from 'framer-motion';

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-amber-50/30 via-white to-amber-50/20 p-6">
      {/* Background decoration dorée */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-amber-400/10 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-amber-500/5 rounded-full blur-3xl animate-pulse delay-1000" />
      </div>

      <div className="relative z-10 text-center max-w-2xl">
        {/* Animation principale */}
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="mb-12"
        >
          <motion.div
            animate={{ 
              y: [0, -20, 0],
              rotate: [0, 10, -10, 0]
            }}
            transition={{ 
              duration: 2,
              repeat: Infinity,
              repeatType: "reverse"
            }}
            className="relative inline-block"
          >
            {/* Icône principale avec effet doré - Croissant */}
            <div className="w-40 h-40 mx-auto bg-gradient-to-br from-amber-400 via-amber-500 to-amber-600 rounded-3xl flex items-center justify-center shadow-2xl shadow-amber-500/30">
              <span className="text-7xl filter drop-shadow-lg">🥐</span>
            </div>
            
            {/* Cercle lumineux pulsant */}
            <motion.div
              animate={{ scale: [1, 1.2, 1], opacity: [0.5, 0.2, 0.5] }}
              transition={{ duration: 2, repeat: Infinity }}
              className="absolute inset-0 rounded-3xl bg-gradient-to-br from-amber-400/50 to-transparent -z-10"
            />
          </motion.div>
        </motion.div>

        {/* Message principal avec animation */}
        <motion.div
          initial={{ y: 30, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          <h1 className="font-display text-4xl md:text-5xl lg:text-6xl font-bold mb-6 bg-gradient-to-r from-amber-600 via-amber-500 to-amber-600 bg-clip-text text-transparent">
            EasyGest BP
          </h1>
          
          <motion.p
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.4 }}
            className="text-2xl md:text-3xl font-semibold text-gray-800 mb-4"
          >
            La Gestion Plus Facile Que Jamais
          </motion.p>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.6 }}
            className="text-amber-600 text-lg md:text-xl font-medium mt-6 mb-8"
          >
            🥐 Un croissant bien chaud pour vous réconforter ? 🥐
          </motion.p>
        </motion.div>

        {/* Actions - Boutons de navigation */}
        <motion.div
          initial={{ y: 30, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.8 }}
          className="flex flex-col sm:flex-row gap-4 justify-center"
        >
          <Button asChild variant="outline" className="rounded-xl h-12 border-amber-300 hover:bg-amber-50 hover:border-amber-400 transition-all duration-300">
            <Link to="/" className="flex items-center gap-2">
              <ArrowLeft className="w-5 h-5 text-amber-600" />
              <span className="text-amber-700">Retour</span>
            </Link>
          </Button>
          <Button asChild className="bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white shadow-lg hover:shadow-amber-500/30 transition-all duration-300 h-12 rounded-xl">
            <Link to="/dashboard" className="flex items-center gap-2">
              <Home className="w-5 h-5" />
              Accueil
            </Link>
          </Button>
        </motion.div>
      </div>

      {/* Footer */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5, delay: 1 }}
        className="absolute bottom-8 text-center"
      >
        <p className="text-xs text-muted-foreground">
          powered by{' '}
          <a
            href="https://techforgesolution237.site"
            target="_blank"
            rel="noopener noreferrer"
            className="text-amber-600 hover:text-amber-700 hover:underline font-medium transition-colors"
          >
            TFS237
          </a>
        </p>
      </motion.div>

      {/* Effet de particules dorées (décoratif) */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {[...Array(20)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute w-1 h-1 bg-amber-400/60 rounded-full"
            initial={{
              x: Math.random() * window.innerWidth,
              y: Math.random() * window.innerHeight,
              scale: 0
            }}
            animate={{
              y: [null, -100],
              opacity: [0, 1, 0],
              scale: [0, 1, 0]
            }}
            transition={{
              duration: 2 + Math.random() * 2,
              repeat: Infinity,
              delay: Math.random() * 5
            }}
          />
        ))}
      </div>
    </div>
  );
}