import { Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePapel } from "@/hooks/usePapel";
import { Logotipo } from "@/components/Marca";

const Header = () => {
  // O link da Equipe só aparece para quem está em authorized_users: para os outros
  // a página responde "sem acesso", e mostrar o caminho só geraria clique frustrado.
  const { naEquipe } = usePapel();

  return (
    <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-50">
      <div className="container mx-auto px-6 h-20 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <a href="/" className="flex items-center gap-3">
            <Logotipo className="h-8" />
            <div className="hidden sm:block border-l border-border pl-3">
              <p className="text-sm font-medium text-foreground">P² Local Listings</p>
              <p className="text-xs text-muted-foreground">Estratégias que Vencem</p>
            </div>
          </a>
        </div>
        
        <nav className="flex items-center gap-2">
          <Button asChild variant="outline" size="sm">
            <a href="/">Empresas</a>
          </Button>
          {naEquipe && (
            <Button asChild variant="outline" size="sm">
              <a href="/configuracoes" className="flex items-center gap-1.5">
                <Settings className="h-3.5 w-3.5" /> Configurações
              </a>
            </Button>
          )}
        </nav>
      </div>
    </header>
  );
};

export default Header;
