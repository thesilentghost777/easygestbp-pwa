/**
 * EasyGest BP - App principal
 */

import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { SyncProvider } from "@/contexts/SyncContext";
import { useEffect } from "react";
import { initDB } from "@/lib/db";

// Pages
import LoginPage from "./pages/Login";
import RegisterPage from "./pages/Register";
import Dashboard from "./pages/Dashboard";
import PointeurDashboard from "./pages/PointeurDashboard";
import VendeurDashboard from "./pages/VendeurDashboard";
import PDGDashboard from "./pages/PDGDashboard";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

// Composant de protection des routes
function ProtectedRoute({ children, allowedRoles }: { children: React.ReactNode; allowedRoles?: string[] }) {
  const { isAuthenticated, isLoading, user } = useAuth();
  
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }
  
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  
  if (allowedRoles && user && !allowedRoles.includes(user.role)) {
    return <Navigate to="/dashboard" replace />;
  }
  
  return <>{children}</>;
}

// Composant de redirection si authentifié
function PublicRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
  
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }
  
  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }
  
  return <>{children}</>;
}

// Initialisation de la DB
function DBInitializer({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    initDB().catch(console.error);
  }, []);
  
  return <>{children}</>;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner position="top-center" richColors />
      <BrowserRouter>
        <DBInitializer>
          <AuthProvider>
            <SyncProvider>
              <Routes>
                {/* Routes publiques */}
                <Route path="/login" element={
                  <PublicRoute>
                    <LoginPage />
                  </PublicRoute>
                } />
                <Route path="/register" element={
                  <PublicRoute>
                    <RegisterPage />
                  </PublicRoute>
                } />
                
                {/* Routes protégées */}
                <Route path="/dashboard" element={
                  <ProtectedRoute>
                    <Dashboard />
                  </ProtectedRoute>
                } />
                
                <Route path="/pointeur" element={
                  <ProtectedRoute allowedRoles={['pointeur']}>
                    <PointeurDashboard />
                  </ProtectedRoute>
                } />
                
                <Route path="/vendeur" element={
                  <ProtectedRoute allowedRoles={['vendeur_boulangerie', 'vendeur_patisserie']}>
                    <VendeurDashboard />
                  </ProtectedRoute>
                } />
                
                <Route path="/pdg" element={
                  <ProtectedRoute allowedRoles={['pdg']}>
                    <PDGDashboard />
                  </ProtectedRoute>
                } />
                
                {/* Redirection par défaut */}
                <Route path="/" element={<Navigate to="/login" replace />} />
                
                {/* 404 */}
                <Route path="*" element={<NotFound />} />
              </Routes>
            </SyncProvider>
          </AuthProvider>
        </DBInitializer>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
