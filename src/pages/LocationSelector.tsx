import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Building2, MapPin, Phone, Tag, Plus, Loader2, LogOut, Search, X } from 'lucide-react';
import { GoogleImportModal } from '@/components/GoogleImportModal';
import type { GoogleLocation } from '@/components/GoogleImportModal';
import { useAuth } from '@/contexts/AuthContext';
import { listUserLocations, saveImportedLocations } from '@/services/database-service';
import { supabase } from '@/integrations/supabase/client';
import { appEnv } from '@/lib/env';

const LocationSelector = () => {
  const navigate = useNavigate();
  const { signOut } = useAuth();
  const [locations, setLocations] = useState<GoogleLocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    fetchLocations();
  }, []);

  const fetchLocations = async () => {
    setLoading(true);
    try {
      const storedLocations = await listUserLocations();
      if (storedLocations.length > 0) {
        setLocations(storedLocations);
        return;
      }

      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      const response = await fetch(appEnv.gbpImportEndpoint, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });

      if (response.ok) {
        const data = await response.json();
        const imported = data.locations || [];
        if (imported.length > 0) await saveImportedLocations(imported);
        setLocations(imported);
      }
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

  return (
    <div className="min-h-screen bg-background">
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
          <button
            onClick={signOut}
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <LogOut className="h-4 w-4" />
            Sair
          </button>
        </div>
      </header>

      <main className="container mx-auto px-6 py-12">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h2 className="text-3xl font-bold text-foreground">Empresas</h2>
              <p className="text-muted-foreground mt-1">Selecione uma empresa para sincronizar ou ver o painel</p>
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
          ) : filteredLocations.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center gap-4">
              <Search className="h-16 w-16 text-muted-foreground/40" />
              <p className="text-muted-foreground text-lg">Nenhuma empresa encontrada para sua busca</p>
              <p className="text-muted-foreground text-sm">Tente pesquisar por outro nome, cidade, telefone ou categoria.</p>
            </div>
          ) : (
            <div className="grid gap-4">
              {filteredLocations.map((location, index) => (
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
