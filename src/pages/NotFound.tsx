import { useLocation, Link } from "react-router-dom";
import { useEffect } from "react";
import { Home, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error("404 Error:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-golden-50 to-background p-6">
      <div className="text-center max-w-md">
        <div className="w-24 h-24 mx-auto mb-6 rounded-full bg-muted/50 flex items-center justify-center">
          <span className="text-5xl">🥐</span>
        </div>
        <h1 className="font-display text-4xl font-bold text-foreground mb-3">404</h1>
        <p className="text-muted-foreground mb-8">Page introuvable</p>
        <Link to="/login">
          <Button className="btn-golden">
            <Home className="w-4 h-4 mr-2" />
            Accueil
          </Button>
        </Link>
      </div>
    </div>
  );
};

export default NotFound;
