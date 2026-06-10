import { Button } from "@/components/ui/button";
import { ArrowDown } from "lucide-react";

interface HeroProps {
  onScrollToForm: () => void;
}

const Hero = ({ onScrollToForm }: HeroProps) => {
  return (
    <section className="relative overflow-hidden bg-gradient-hero py-20 md:py-32">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,_hsla(268,37%,36%,0.15)_0%,_transparent_50%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_80%,_hsla(152,100%,33%,0.1)_0%,_transparent_50%)]" />
      
      <div className="container mx-auto px-6 relative z-10">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-4xl md:text-6xl font-bold text-foreground mb-6 tracking-tight">
            Sincronize seus <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-green to-brand-purple">Perfis Locais</span>
          </h1>
          
          <p className="text-lg md:text-xl text-muted-foreground mb-10 max-w-2xl mx-auto">
            Propague dados de negócio para Google, Facebook, GBP e Apple em um único clique
          </p>
          
          <Button 
            onClick={onScrollToForm}
            size="lg"
            className="bg-accent hover:bg-accent/90 text-accent-foreground font-semibold shadow-glow group"
          >
            Começar Agora
            <ArrowDown className="ml-2 h-4 w-4 group-hover:translate-y-1 transition-transform" />
          </Button>
        </div>
      </div>
    </section>
  );
};

export default Hero;
