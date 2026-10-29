import { useState } from 'react';
import { Users, ListChecks, Compass } from 'lucide-react';
import Header from '@/components/Header';
import Canais from './Canais';
import Descoberta from './Descoberta';
import EquipeConteudo from './Equipe';

const ABAS = [
  { id: 'canais', rotulo: 'Canais', icone: ListChecks },
  { id: 'descoberta', rotulo: 'Descobrir', icone: Compass },
  { id: 'equipe', rotulo: 'Equipe', icone: Users },
] as const;

type Aba = typeof ABAS[number]['id'];

const Configuracoes = () => {
  // A aba vive na URL (?aba=canais) para o link do menu e o F5 caírem no mesmo lugar.
  const inicial = (new URLSearchParams(window.location.search).get('aba') as Aba) || 'canais';
  const [aba, setAba] = useState<Aba>(ABAS.some((a) => a.id === inicial) ? inicial : 'canais');

  const trocar = (id: Aba) => {
    setAba(id);
    const u = new URL(window.location.href);
    u.searchParams.set('aba', id);
    window.history.replaceState({}, '', u);
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="container mx-auto px-6 py-10 max-w-5xl">
        <h1 className="text-2xl font-bold text-foreground mb-1">Configurações</h1>
        <p className="text-sm text-muted-foreground mb-6">
          Catálogo de diretórios, descoberta de novos e quem tem acesso ao sistema.
        </p>

        <div className="flex gap-1 border-b border-border mb-7 -mx-1 overflow-x-auto">
          {ABAS.map(({ id, rotulo, icone: Icone }) => (
            <button
              key={id}
              type="button"
              onClick={() => trocar(id)}
              className={`px-4 py-2.5 text-sm font-medium flex items-center gap-2 border-b-2 transition-colors whitespace-nowrap ${
                aba === id
                  ? 'border-primary text-foreground'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              <Icone className="h-4 w-4" /> {rotulo}
            </button>
          ))}
        </div>

        {aba === 'canais' && <Canais />}
        {aba === 'descoberta' && <Descoberta />}
        {aba === 'equipe' && <EquipeConteudo semMoldura />}
      </div>
    </div>
  );
};

export default Configuracoes;
