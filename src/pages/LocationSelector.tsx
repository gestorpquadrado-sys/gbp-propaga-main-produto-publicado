import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Building2, MapPin, Phone, Tag, Plus, Loader2, LogOut, Search, X, Settings, BadgeCheck, CheckSquare } from 'lucide-react';
import { GoogleImportModal } from '@/components/GoogleImportModal';
import type { GoogleLocation } from '@/components/GoogleImportModal';
import { useAuth } from '@/contexts/AuthContext';
import { listUserLocations, saveImportedLocations } from '@/services/database-service';
import { supabase } from '@/integrations/supabase/client';
import { appEnv } from '@/lib/env';
import { usePapel } from '@/hooks/usePapel';
import { Logotipo } from '@/components/Marca';

const LocationSelector = () => {
  const navigate = useNavigate();
  const { signOut } = useAuth();
  // Esta tela NÃO usa o componente Header: ela desenha o próprio cabeçalho. Foi por
  // isso que o link de Configurações, posto só no Header, nunca apareceu aqui.
  const { naEquipe } = usePapel();
  const [locations, setLocations] = useState<GoogleLocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  // Quantos perfis CONFIRMADOS e quantos formulários marcados como preenchidos cada
  // ficha tem. Sem isto, saber onde a empresa já está publicada exigia abrir as 55
  // uma por uma — o dado existia no banco e não aparecia em lugar nenhum da lista.
  const [resumo, setResumo] = useState<Record<string, { confirmados: number; preenchidos: number }>>({});
  const [filtroPerfil, setFiltroPerfil] = useState<'todas' | 'com' | 'sem'>('todas');

  useEffect(() => {
    fetchLocations();
    carregarResumo();
  }, []);

  const carregarResumo = async () => {
    const { data } = await supabase
      .from('directory_submissions')
      .select('location_id, verification_status, filled_at');
    const mapa: Record<string, { confirmados: number; preenchidos: number }> = {};
    for (const r of (data ?? []) as { location_id: string | null; verification_status: string | null; filled_at: string | null }[]) {
      if (!r.location_id) continue;
      const atual = mapa[r.location_id] ?? { confirmados: 0, preenchidos: 0 };
      if (r.verification_status === 'found_online') atual.confirmados += 1;
      if (r.filled_at) atual.preenchidos += 1;
      mapa[r.location_id] = atual;
    }
    setResumo(mapa);
  };

  const fetchLocations = async () => {
    setLoading(true);
    try {
              const storedLocations = await listUserLocations();
        setLocations(storedLocations);

        // NÃO importar do Google automaticamente quando a lista vem vazia.
        //
        // Era o que estava aqui, e virou um estrago em 30/10/2026: o Ícaro entrou, a
        // consulta ainda filtrava por user_id e devolveu zero empresas, então a tela
        // importou a base inteira do Google e gravou 54 empresas e 54 fichas DUPLICADAS
        // no nome dele. Importação é ato deliberado — existe o botão de importar do
        // Google para isso. Lista vazia agora é só lista vazia.
    } catch (error) {
      console.warn('Falha ao carregar empresas', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectLocation = (location: GoogleLocation) => {
    navigate('/form', { state: { importedLocation: location } });
  };

  const handleViewPanel = (location: GoogleLocation) => {
    navigate(`/panel/${encodeURIComponent(location.google_location_id)}`);
  };

  const normalizedSearch = searchQuery.trim().toLowerCase();
  const filteredLocations = normalizedSearch
    ? locations.filter((location) => {
        const searchableText = [
          location.name,
          location.address_full,
          location.address_city,
          location.address_state,
          location.address_postal_code,
          location.address_neighborhood,
          location.category_primary,
          location.phone_primary,
          location.website,
          location.description,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();

        return searchableText.includes(normalizedSearch);
      })
    : locations;

  // Filtro por situação do perfil, somado à busca por texto.
  const locaisVisiveis = filteredLocations.filter((l) => {
    if (filtroPerfil === 'todas') return true;
    const tem = (resumo[l.id]?.confirmados ?? 0) > 0;
    return filtroPerfil === 'com' ? tem : !tem;
  });

  const comPerfil = locations.filter((l) => (resumo[l.id]?.confirmados ?? 0) > 0).length;
  const totalPerfis = Object.values(resumo).reduce((a, r) => a + r.confirmados, 0);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Logotipo className="h-8" />
            <div className="hidden sm:block border-l border-border pl-3">
              <p className="text-sm font-medium text-foreground">P² Local Listings</p>
              <p className="text-xs text-muted-foreground">Estratégias que Vencem</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            {naEquipe && (
              <button
                onClick={() => navigate('/configuracoes')}
                className="flex items-center gap-2 px-3 py-1.5 text-sm border border-border rounded-md text-foreground hover:bg-card transition-colors"
              >
                <Settings className="h-4 w-4" />
                Configurações
              </button>
            )}
            <button
              onClick={signOut}
              className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <LogOut className="h-4 w-4" />
              Sair
            </button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-6 py-12">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h2 className="text-3xl font-bold text-foreground">Empresas</h2>
              <p className="text-muted-foreground mt-1">Selecione uma empresa para sincronizar ou ver o painel</p>
              {locations.length > 0 && (
                <div className="flex items-center gap-3 mt-3 flex-wrap">
                  <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
                    <BadgeCheck className="h-4 w-4 text-emerald-500" />
                    <strong className="text-foreground">{comPerfil}</strong> de {locations.length} com perfil publicado
                    {totalPerfis > 0 && <span>· {totalPerfis} perfis no total</span>}
                  </span>
                  <div className="flex gap-1">
                    {([['todas', 'Todas'], ['com', 'Com perfil'], ['sem', 'Sem perfil']] as const).map(([v, rotulo]) => (
                      <button
                        key={v}
                        type="button"
                        onClick={() => setFiltroPerfil(v)}
                        className={`px-2.5 py-1 text-xs rounded-md border transition-colors ${
                          filtroPerfil === v
                            ? 'border-primary bg-primary/10 text-foreground'
                            : 'border-border text-muted-foreground hover:text-foreground'
                        }`}
                      >
                        {rotulo}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div className="flex gap-3">
              <GoogleImportModal onSelect={handleSelectLocation} />
              <button
                onClick={() => navigate('/form')}
                className="flex items-center gap-2 px-4 py-2 bg-accent hover:bg-accent/90 text-accent-foreground font-medium rounded-md transition-colors"
              >
                <Plus className="h-4 w-4" />
                Nova Empresa
              </button>
            </div>
          </div>

          {!loading && locations.length > 0 && (
            <div className="mb-6 space-y-2">
              <div className="relative">
                <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Buscar por nome, cidade, estado, categoria, telefone ou site..."
                  className="w-full rounded-xl border border-border bg-card/80 py-3 pl-11 pr-11 text-sm text-foreground placeholder:text-muted-foreground outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    aria-label="Limpar busca"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                {filteredLocations.length} de {locations.length} empresas encontradas
              </p>
            </div>
          )}

          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : locations.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center gap-4">
              <Building2 className="h-16 w-16 text-muted-foreground/40" />
              <p className="text-muted-foreground text-lg">Nenhuma empresa encontrada</p>
              <p className="text-muted-foreground text-sm">Use o botão "Importar do Google Meu Negócio" ou "Nova Empresa"</p>
            </div>
          ) : locaisVisiveis.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center gap-4">
              <Search className="h-16 w-16 text-muted-foreground/40" />
              <p className="text-muted-foreground text-lg">Nenhuma empresa encontrada para sua busca</p>
              <p className="text-muted-foreground text-sm">Tente pesquisar por outro nome, cidade, telefone ou categoria.</p>
            </div>
          ) : (
            <div className="grid gap-4">
              {locaisVisiveis.map((location, index) => (
                <div
                  key={location.google_location_id || index}
                  className="bg-card border border-border rounded-xl p-6 flex items-start justify-between gap-4 hover:border-primary/50 transition-colors shadow-purple"
                >
                  <div className="flex-1 space-y-2">
                    <h3 className="text-lg font-semibold text-foreground">{location.name}</h3>
                    {location.address_full && (
                      <div className="flex items-start gap-2 text-sm text-muted-foreground">
                        <MapPin className="h-4 w-4 mt-0.5 shrink-0" />
                        <span>{location.address_full} — {location.address_city}/{location.address_state}</span>
                      </div>
                    )}
                    {location.phone_primary && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Phone className="h-4 w-4 shrink-0" />
                        <span>{location.phone_primary}</span>
                      </div>
                    )}
                    {location.category_primary && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Tag className="h-4 w-4 shrink-0" />
                        <span>{location.category_primary}</span>
                      </div>
                    )}
                    {(() => {
                      const r = resumo[location.id] ?? { confirmados: 0, preenchidos: 0 };
                      if (!r.confirmados && !r.preenchidos) return null;
                      return (
                        <div className="flex items-center gap-2 flex-wrap pt-1">
                          {r.confirmados > 0 && (
                            <span className="inline-flex items-center gap-1.5 text-xs px-2 py-1 rounded-md border border-emerald-500/40 bg-emerald-500/10 text-emerald-400">
                              <BadgeCheck className="h-3.5 w-3.5" />
                              {r.confirmados} {r.confirmados === 1 ? 'perfil publicado' : 'perfis publicados'}
                            </span>
                          )}
                          {r.preenchidos > 0 && (
                            <span className="inline-flex items-center gap-1.5 text-xs px-2 py-1 rounded-md border border-border text-muted-foreground">
                              <CheckSquare className="h-3.5 w-3.5" />
                              {r.preenchidos} formulário(s) preenchido(s)
                            </span>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                  <div className="flex flex-col gap-2 shrink-0">
                    <button
                      onClick={() => handleViewPanel(location)}
                      className="px-4 py-2 text-sm font-medium border border-border rounded-md text-foreground hover:bg-muted transition-colors"
                    >
                      Ver Painel
                    </button>
                    <button
                      onClick={() => handleSelectLocation(location)}
                      className="px-4 py-2 text-sm font-medium bg-accent hover:bg-accent/90 text-accent-foreground rounded-md transition-colors"
                    >
                      Sincronizar
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default LocationSelector;
