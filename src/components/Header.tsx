import { Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";

const Header = () => {
  return (
    <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-50">
      <div className="container mx-auto px-6 h-20 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-brand-purple to-brand-magenta rounded-lg flex items-center justify-center">
            <Building2 className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">pquadrado</h1>
            <p className="text-xs text-muted-foreground">Estratégias que Vencem</p>
          </div>
        </div>
        
        <nav className="flex items-center">
          <Button asChild variant="outline" size="sm">
            <a href="/">Empresas</a>
          </Button>
        </nav>
      </div>
    </header>
  );
};

export default Header;
