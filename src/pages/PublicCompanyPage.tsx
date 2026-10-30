import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Building2, Clock, Globe, MapPin, Phone, Tag, BadgeCheck, ExternalLink } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import type { CompanyRow, GoogleLocationRow } from '@/types/database';

interface PublicData {
  company: CompanyRow;
  location: GoogleLocationRow | null;
  perfis: Perfil[];
}

/** Onde esta empresa está publicada, confirmado pela verificação automática. */
type Perfil = {
  channel_code: string;
  profile_url: string;
  nome: string;
  verificado_em: string | null;
};

function formatHours(hours: unknown): string[] {
  if (!hours || typeof hours !== 'object') return [];
  return Object.entries(hours as Record<string, { open?: string; close?: string }>).map(([day, value]) => (
    `${day}: ${value.open || '--:--'} às ${value.close || '--:--'}`
  ));
}

const PublicCompanyPage = () => {
  const { slug } = useParams<{ slug: string }>();
  const [data, setData] = useState<PublicData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!slug) return;

    async function load() {
      setLoading(true);
      const { data: page } = await supabase
        .from('directory_pages')
        .select('company_id, location_id, status')
        .eq('slug', slug)
        .eq('status', 'published')
        .maybeSingle();

      if (!page) {
        setLoading(false);
        return;
      }

      const [{ data: company }, { data: location }, { data: subs }, { data: canais }] = await Promise.all([
        supabase.from('companies').select('*').eq('id', page.company_id).maybeSingle(),
        page.location_id
          ? supabase.from('google_locations').select('*').eq('id', page.location_id).maybeSingle()
          : Promise.resolve({ data: null }),
        // Só as confirmadas: a política de RLS para visitante anônimo já devolve apenas
        // found_online com profile_url, mas o filtro fica explícito — a página do cliente
        // não promete o que está pendente.
        supabase
          .from('directory_submissions')
          .select('channel_code, profile_url, verified_at')
          .eq('company_id', page.company_id)
          .eq('verification_status', 'found_online')
          .not('profile_url', 'is', null),
        supabase.from('directory_channels').select('code, name'),
      ]);

      const nomes = new Map<string, string>(
        ((canais ?? []) as { code: string; name: string }[]).map((c) => [c.code, c.name]),
      );
      // Um diretório pode ter mais de uma submissão (sincronizações diferentes); mostra
      // uma linha por diretório, com o perfil mais recentemente confirmado.
      const porCanal = new Map<string, Perfil>();
      for (const r of (subs ?? []) as { channel_code: string; profile_url: string; verified_at: string | null }[]) {
        const atual = porCanal.get(r.channel_code);
        if (!atual || (r.verified_at ?? '') > (atual.verificado_em ?? '')) {
          porCanal.set(r.channel_code, {
            channel_code: r.channel_code,
            profile_url: r.profile_url,
            nome: nomes.get(r.channel_code) ?? r.channel_code,
            verificado_em: r.verified_at,
          });
        }
      }

      if (company) setData({
        company: company as CompanyRow,
        location: location as GoogleLocationRow | null,
        perfis: [...porCanal.values()].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')),
      });
      setLoading(false);
    }

    load();
  }, [slug]);

  if (loading) {
    return <div className="min-h-screen bg-background flex items-center justify-center text-muted-foreground">Carregando página...</div>;
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6 text-center">
        <div>
          <Building2 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h1 className="text-2xl font-bold text-foreground">Página não encontrada</h1>
          <p className="text-muted-foreground mt-2">Esta empresa ainda não publicou uma página pública.</p>
          <Link to="/auth" className="text-primary underline mt-4 inline-block">Entrar na plataforma</Link>
        </div>
      </div>
    );
  }

  const { company, location, perfis } = data;
  const phone = location?.phone_primary || company.phone;
  const website = location?.website || company.website;
  const mapUri = location?.google_maps_uri;
  const hours = formatHours(location?.hours);

  return (
    <main className="min-h-screen bg-background">
      <section className="border-b border-border bg-card/60">
        <div className="container mx-auto px-6 py-14 max-w-5xl">
          <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-sm text-primary mb-5">
            <Tag className="h-4 w-4" />
            {location?.category_primary || company.category || 'Empresa local'}
          </div>
          <h1 className="text-4xl md:text-5xl font-bold text-foreground">{company.name}</h1>
          {(location?.description || company.description) && (
            <p className="text-lg text-muted-foreground mt-4 max-w-3xl">{location?.description || company.description}</p>
          )}
        </div>
      </section>

      <section className="container mx-auto px-6 py-10 max-w-5xl grid md:grid-cols-3 gap-6">
        <div className="md:col-span-2 bg-card border border-border rounded-xl p-6 shadow-purple space-y-5">
          <h2 className="text-xl font-semibold text-foreground">Informações da empresa</h2>
          <div className="space-y-4 text-muted-foreground">
            <p className="flex gap-3"><MapPin className="h-5 w-5 text-primary shrink-0" />{location?.address_full || company.address}, {company.neighborhood} — {company.city}/{company.state}</p>
            {phone && <p className="flex gap-3"><Phone className="h-5 w-5 text-primary shrink-0" />{phone}</p>}
            {website && <p className="flex gap-3"><Globe className="h-5 w-5 text-primary shrink-0" /><a href={website} className="underline" target="_blank" rel="noreferrer">{website}</a></p>}
          </div>

          {hours.length > 0 && (
            <div className="pt-4 border-t border-border">
              <h3 className="font-semibold text-foreground flex items-center gap-2"><Clock className="h-5 w-5" />Horários</h3>
              <div className="grid sm:grid-cols-2 gap-2 mt-3 text-sm text-muted-foreground">
                {hours.map((item) => <span key={item}>{item}</span>)}
              </div>
            </div>
          )}
        </div>

        <aside className="bg-card border border-border rounded-xl p-6 shadow-purple h-fit space-y-3">
          <h2 className="text-lg font-semibold text-foreground">Contato rápido</h2>
          {phone && <a href={`tel:${phone}`} className="block w-full text-center rounded-md bg-accent text-accent-foreground font-semibold py-3">Ligar agora</a>}
          {mapUri && <a href={mapUri} target="_blank" rel="noreferrer" className="block w-full text-center rounded-md border border-border py-3 text-foreground hover:bg-muted">Abrir no Google Maps</a>}
          {website && <a href={website} target="_blank" rel="noreferrer" className="block w-full text-center rounded-md border border-border py-3 text-foreground hover:bg-muted">Visitar site</a>}
        </aside>
      </section>

      {perfis.length > 0 && (
        <section className="container mx-auto px-6 pb-14 max-w-5xl">
          <div className="bg-card border border-border rounded-xl p-6 shadow-purple">
            <h2 className="text-xl font-semibold text-foreground flex items-center gap-2">
              <BadgeCheck className="h-5 w-5 text-emerald-500" />
              Onde encontrar {company.name}
            </h2>
            <p className="text-sm text-muted-foreground mt-1 mb-5">
              {perfis.length === 1
                ? 'Perfil confirmado em 1 diretório, verificado automaticamente.'
                : `Perfis confirmados em ${perfis.length} diretórios, verificados automaticamente.`}
            </p>
            <ul className="grid sm:grid-cols-2 gap-3">
              {perfis.map((p) => (
                <li key={p.channel_code}>
                  <a
                    href={p.profile_url}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center justify-between gap-3 rounded-lg border border-border px-4 py-3 hover:bg-background transition-colors group"
                  >
                    <span className="min-w-0">
                      <span className="block text-sm font-medium text-foreground truncate">{p.nome}</span>
                      {p.verificado_em && (
                        <span className="block text-xs text-muted-foreground">
                          confirmado em {new Date(p.verificado_em).toLocaleDateString('pt-BR')}
                        </span>
                      )}
                    </span>
                    <ExternalLink className="h-4 w-4 text-muted-foreground group-hover:text-foreground shrink-0" />
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}
    </main>
  );
};

export default PublicCompanyPage;
