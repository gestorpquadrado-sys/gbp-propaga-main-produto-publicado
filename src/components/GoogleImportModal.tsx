import * as React from "react";
import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, MapPin, Phone, Tag, Building2, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { appEnv } from "@/lib/env";
import { saveImportedLocations } from "@/services/database-service";

interface GoogleLocation {
  // IDs internos do Supabase, quando o perfil já foi salvo/importado.
  id?: string;
  company_id?: string;
  user_id?: string;

  google_location_id: string;
  google_place_id: string;
  google_maps_uri: string;
  name: string;
  description: string;
  phone_primary: string;
  phone_additional: string;
  website: string;
  address_full: string;
  address_city: string;
  address_state: string;
  address_postal_code: string;
  address_country: string;
  address_neighborhood: string;
  category_primary: string;
  categories_additional: string[];
  hours: Record<string, { open: string; close: string }>;
}

interface GoogleImportModalProps {
  onSelect: (location: GoogleLocation) => void;
}

const GoogleIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    className="h-5 w-5"
  >
    <path
      fill="#4285F4"
      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
    />
    <path
      fill="#34A853"
      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
    />
    <path
      fill="#FBBC05"
      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
    />
    <path
      fill="#EA4335"
      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
    />
  </svg>
);

export function GoogleImportModal({ onSelect }: GoogleImportModalProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [locations, setLocations] = useState<GoogleLocation[]>([]);
  const [searchTerm, setSearchTerm] = useState("");

  const fetchLocations = async () => {
    setLoading(true);
    setError(null);
    setLocations([]);

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;

      const response = await fetch(
        appEnv.gbpImportEndpoint,
        {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
        }
      );

      if (!response.ok) {
        throw new Error(`Erro ao buscar perfis: ${response.status}`);
      }

      const data = await response.json();
      const locationsList = data.locations || [];
      const savedLocations = await saveImportedLocations(locationsList);
      setLocations(savedLocations.length > 0 ? savedLocations : locationsList);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Erro desconhecido ao buscar perfis"
      );
    } finally {
      setLoading(false);
    }
  };

  const handleOpenChange = (isOpen: boolean) => {
    setOpen(isOpen);
    if (isOpen) {
      fetchLocations();
    } else {
      setLocations([]);
      setSearchTerm("");
      setError(null);
    }
  };

  const handleSelect = (location: GoogleLocation) => {
    onSelect(location);
    setOpen(false);
  };

  const formatAddress = (location: GoogleLocation): string => {
    const parts: string[] = [];
    if (location.address_full) parts.push(location.address_full);
    if (location.address_city) parts.push(location.address_city);
    if (location.address_state) parts.push(location.address_state);
    if (location.address_postal_code) parts.push(location.address_postal_code);
    return parts.join(" - ") || "Endereço não disponível";
  };

  const normalizedSearch = searchTerm.trim().toLowerCase();
  const filteredLocations = locations.filter((location) => {
    if (!normalizedSearch) return true;

    const searchableContent = [
      location.name,
      location.address_full,
      location.address_city,
      location.address_state,
      location.address_postal_code,
      location.address_neighborhood,
      location.category_primary,
      location.phone_primary,
      location.website,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    return searchableContent.includes(normalizedSearch);
  });

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <GoogleIcon />
          Importar do Google Meu Negócio
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Importar Perfil do Google Meu Negócio</DialogTitle>
          <DialogDescription>
            Selecione um perfil para preencher automaticamente o formulário
          </DialogDescription>
        </DialogHeader>

        <div className="mt-4">
          {loading && (
            <div className="flex flex-col items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="mt-4 text-sm text-muted-foreground">
                Buscando perfis do Google Meu Negócio...
              </p>
            </div>
          )}

          {error && (
            <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4">
              <p className="text-sm text-destructive">{error}</p>
              <Button
                variant="outline"
                size="sm"
                className="mt-3"
                onClick={fetchLocations}
              >
                Tentar novamente
              </Button>
            </div>
          )}

          {!loading && !error && locations.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Building2 className="h-12 w-12 text-muted-foreground/50" />
              <p className="mt-4 text-sm text-muted-foreground">
                Nenhum perfil encontrado no Google Meu Negócio
              </p>
            </div>
          )}

          {!loading && !error && locations.length > 0 && (
            <div className="space-y-4">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="search"
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  placeholder="Pesquisar por empresa, cidade, telefone ou categoria..."
                  className="h-11 w-full rounded-md border border-input bg-background pl-10 pr-4 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/20"
                  autoComplete="off"
                />
              </div>

              <div className="text-xs text-muted-foreground">
                {filteredLocations.length === locations.length
                  ? `${locations.length} perfis encontrados`
                  : `${filteredLocations.length} de ${locations.length} perfis encontrados`}
              </div>

              {filteredLocations.length === 0 ? (
                <div className="rounded-lg border border-dashed border-border p-8 text-center">
                  <p className="text-sm font-medium text-foreground">
                    Nenhuma empresa encontrada
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Tente buscar por outro nome, cidade, telefone ou categoria.
                  </p>
                </div>
              ) : (
                <ScrollArea className="h-[400px] pr-4">
                  <div className="space-y-3">
                    {filteredLocations.map((location, index) => (
                  <Card
                    key={location.google_location_id || index}
                    className="transition-colors hover:bg-accent/50"
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 space-y-2">
                          <h4 className="font-semibold text-foreground">
                            {location.name || "Nome não disponível"}
                          </h4>

                          <div className="flex items-start gap-2 text-sm text-muted-foreground">
                            <MapPin className="mt-0.5 h-4 w-4 shrink-0" />
                            <span>{formatAddress(location)}</span>
                          </div>

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

                        <Button
                          size="sm"
                          onClick={() => handleSelect(location)}
                        >
                          Selecionar
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export type { GoogleLocation };
