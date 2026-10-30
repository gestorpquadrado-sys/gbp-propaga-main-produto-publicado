import { useCallback, useEffect, useState } from 'react';
import {
  Loader2, Search, ExternalLink, Plus, AlertTriangle, Coins, HelpCircle, Ban,
  Inbox, ThumbsDown, CalendarClock, RefreshCw,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { usePapel } from '@/hooks/usePapel';

type Candidato = {
  dominio: string;
  veredito: string;
  porque: string;
  perfis: number;
  vezes: number;
  caminhos: string[];
  titulos: string[];
};

/** Linha guardada em directory_candidates — é o que a busca semanal deixa para trás. */
type NaFila = {
  dominio: string;
  veredito: string;
  porque: string | null;
  caminho_exemplo: string | null;
  titulo: string | null;
  perfis_da_base: number;
  vezes: number;
  cidades: string[] | null;
  situacao: string;
  primeira_vez: string;
  ultima_vez: string;
};

const campo =
  'w-full px-3 py-2 bg-background border border-border rounded-md text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring';

const FUNCAO = 'https://fljcywbqzzakwgzyguvl.supabase.co/functions/v1/directory-discovery';

const quando = (v: string | null) =>
  v ? new Date(v).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' }) : '—';

const Descoberta = () => {
  const { naEquipe, carregando: carregandoPapel } = usePapel();
  const [cidades, setCidades] = useState<string[]>([]);
  const [cidade, setCidade] = useState('');
  const [amostra, setAmostra] = useState(4);
  const [rodando, setRodando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [fila, setFila] = useState<NaFila[]>([]);
  const [carregandoFila, setCarregandoFila] = useState(true);
  const [verDecididos, setVerDecididos] = useState(false);
  const [res, setRes] = useState<{
    candidatos: Candidato[];
    para_revisar: Candidato[];
    descartados?: Candidato[];
    creditos_serper: number;
    empresas_usadas?: string[];
    gravados?: number;
  } | null>(null);

  const carregarFila = useCallback(async () => {
    setCarregandoFila(true);
    const q = supabase
      .from('directory_candidates')
      .select('*')
      .order('perfis_da_base', { ascending: false })
      .order('vezes', { ascending: false });
    const { data, error } = verDecididos ? await q : await q.eq('situacao', 'novo');
    if (error) setErro(error.message);
    else setFila((data ?? []) as unknown as NaFila[]);
    setCarregandoFila(false);
  }, [verDecididos]);

  useEffect(() => {
    if (!naEquipe) return;
    carregarFila();
    supabase
      .from('companies')
      .select('city')
      .not('city', 'is', null)
      .then(({ data }) => {
        const conta = new Map<string, number>();
        for (const r of (data ?? []) as { city: string }[]) conta.set(r.city, (conta.get(r.city) ?? 0) + 1);
        setCidades([...conta.entries()].sort((a, b) => b[1] - a[1]).map(([c, n]) => `${c} (${n})`));
      });
  }, [naEquipe, carregarFila]);

  const rodar = useCallback(async () => {
    setRodando(true);
    setErro(null);
    setAviso(null);
    setRes(null);
    try {
      const { data: s } = await supabase.auth.getSession();
      const cid = cidade.replace(/\s*\(\d+\)$/, '');
      const q = new URLSearchParams({ amostra: String(amostra), incluir_descartados: '1', gravar: '1' });
      if (cid) q.set('cidade', cid);
      const r = await fetch(`${FUNCAO}?${q}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${s.session?.access_token ?? ''}` },
      });
      const d = await r.json();
      if (!d?.success) throw new Error(d?.error ?? 'A busca falhou');
      setRes(d);
      await carregarFila();
      if ((d.candidatos ?? []).length === 0 && (d.para_revisar ?? []).length === 0) {
        setAviso('Nenhum domínio novo. Ou já está tudo cadastrado para essas empresas, ou vale tentar outra cidade.');
      }
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível buscar');
    } finally {
      setRodando(false);
    }
  }, [cidade, amostra, carregarFila]);

  const decidir = async (dominio: string, situacao: 'aprovado' | 'descartado', nota?: string) => {
    const { data: u } = await supabase.auth.getUser();
    const { error } = await supabase
      .from('directory_candidates')
      .update({
        situacao,
        decidido_por: u.user?.email ?? null,
        decidido_em: new Date().toISOString(),
        nota: nota ?? null,
      } as never)
      .eq('dominio', dominio);
    if (error) setErro(error.message);
    await carregarFila();
  };

  const cadastrar = async (dominio: string, tituloSugerido: string | null, porque: string, caminho: string | null) => {
    const code = window.prompt(
      `Código curto para ${dominio} (letras minúsculas, sem espaço):`,
      dominio.split('.')[0].replace(/[^a-z0-9]/g, ''),
    );
    if (!code) return;
    const nome = window.prompt('Nome do diretório como aparece no site:', (tituloSugerido ?? dominio).slice(0, 40));
    if (!nome) return;
    const formUrl = window.prompt('URL do formulário de cadastro (vazio = entra como manual):', '');
    setErro(null);
    const { error } = await supabase.from('directory_channels').insert({
      code: code.trim(),
      name: nome.trim(),
      website_url: `https://${dominio}`,
      form_url: formUrl?.trim() || null,
      submission_type: formUrl?.trim() ? 'form' : 'manual',
      country: 'BR',
      language: 'pt-BR',
      category: 'general',
      categories: ['general'],
      is_active: true,
      priority: 40,
      requires_manual_review: true,
      assisted_submit: true,
      auto_submit_supported: false,
      api_available: false,
      verification_method: 'search_template',
      search_url_template: `https://www.bing.com/search?q=site%3A${dominio}+{name}+{city}`,
      notes: `Achado pela descoberta: ${porque}. URL de exemplo: ${caminho ?? '—'}`,
    } as never);
    if (error) { setErro(`Não entrou: ${error.message}`); return; }
    await decidir(dominio, 'aprovado', `Cadastrado como "${code.trim()}"`);
    setAviso(`${nome} cadastrado. Confira o nicho e as instruções na aba Canais.`);
  };

  if (carregandoPapel) {
    return <div className="flex items-center justify-center py-24"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }
  if (!naEquipe) {
    return (
      <div className="bg-card border border-border rounded-xl p-8 text-center">
        <AlertTriangle className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
        <p className="text-sm text-muted-foreground">Seu e-mail não está na lista da equipe.</p>
      </div>
    );
  }

  const novos = fila.filter((f) => f.situacao === 'novo');

  return (
    <div>
      <h2 className="text-lg font-semibold text-foreground">Descobrir diretórios</h2>
      <p className="text-sm text-muted-foreground mt-1 mb-5">
        Busca <strong>empresas reais da sua base</strong> no Google e vê em quais sites o perfil delas
        aparece. É assim que se acha guia local: procurar por termo genérico devolve artigo de blog.
      </p>

      <div className="bg-card border border-border rounded-xl p-4 mb-6 flex items-start gap-3">
        <CalendarClock className="h-5 w-5 text-primary mt-0.5 shrink-0" />
        <div>
          <p className="text-sm font-medium text-foreground">Roda sozinha toda quarta, às 4h30 da manhã</p>
          <p className="text-xs text-muted-foreground mt-1">
            Pesquisa 5 empresas por semana, rotacionando pela base para cobrir todas ao longo dos
            meses. O que ela achar cai na fila abaixo e fica esperando alguém decidir — nada entra no
            catálogo sozinho.
          </p>
        </div>
      </div>

      {erro && <p className="text-sm text-destructive bg-destructive/10 p-3 rounded-md mb-4">{erro}</p>}
      {aviso && <p className="text-sm text-accent bg-accent/10 p-3 rounded-md mb-4">{aviso}</p>}

      {/* FILA: o resultado acumulado, inclusive do que rodou de madrugada */}
      <div className="mb-8">
        <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Inbox className="h-4 w-4 text-primary" />
            Fila de candidatos ({novos.length} esperando decisão)
          </h3>
          <div className="flex items-center gap-3">
            <label className="text-xs text-muted-foreground flex items-center gap-1.5">
              <input type="checkbox" checked={verDecididos} onChange={(e) => setVerDecididos(e.target.checked)} />
              mostrar já decididos
            </label>
            <button
              type="button"
              onClick={carregarFila}
              className="p-1.5 border border-border rounded-md hover:bg-card transition-colors"
              title="Recarregar a fila"
            >
              <RefreshCw className={`h-3.5 w-3.5 text-muted-foreground ${carregandoFila ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {fila.length === 0 && !carregandoFila && (
          <p className="text-sm text-muted-foreground bg-card border border-border rounded-xl p-5">
            Fila vazia. A busca semanal vai preenchendo, e você também pode buscar na hora abaixo.
          </p>
        )}

        <ul className="space-y-2">
          {fila.map((f) => (
            <li key={f.dominio} className="bg-card border border-border rounded-lg px-4 py-3 flex items-start gap-3 flex-wrap">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-medium text-foreground">{f.dominio}</p>
                  {f.perfis_da_base > 0 && (
                    <span className="text-xs px-1.5 py-0.5 border border-emerald-500/40 text-emerald-500 rounded">
                      tem perfil de {f.perfis_da_base} cliente(s) nosso(s)
                    </span>
                  )}
                  {f.situacao !== 'novo' && (
                    <span className="text-xs px-1.5 py-0.5 border border-border rounded text-muted-foreground">
                      {f.situacao}
                    </span>
                  )}
                </div>
                {f.titulo && <p className="text-xs text-muted-foreground mt-0.5">“{f.titulo}”</p>}
                <p className="text-xs text-muted-foreground mt-1">{f.porque}</p>
                {f.caminho_exemplo && (
                  <p className="text-xs text-muted-foreground mt-1 font-mono truncate">{f.caminho_exemplo}</p>
                )}
                <p className="text-xs text-muted-foreground mt-1">
                  visto {f.vezes}x · 1ª vez {quando(f.primeira_vez)} · última {quando(f.ultima_vez)}
                  {f.cidades?.length ? ` · ${f.cidades.join(', ')}` : ''}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <a
                  href={`https://${f.dominio}${f.caminho_exemplo ?? ''}`}
                  target="_blank"
                  rel="noreferrer"
                  className="px-3 py-1.5 text-xs border border-border rounded-md hover:bg-background transition-colors text-foreground flex items-center gap-1.5"
                >
                  Abrir <ExternalLink className="h-3 w-3" />
                </a>
                {f.situacao === 'novo' && (
                  <>
                    <button
                      type="button"
                      onClick={() => cadastrar(f.dominio, f.titulo, f.porque ?? '', f.caminho_exemplo)}
                      className="px-3 py-1.5 text-xs border border-border rounded-md hover:bg-background transition-colors text-foreground flex items-center gap-1.5"
                    >
                      <Plus className="h-3 w-3" /> Cadastrar
                    </button>
                    <button
                      type="button"
                      onClick={() => decidir(f.dominio, 'descartado')}
                      className="px-3 py-1.5 text-xs border border-border rounded-md hover:bg-background transition-colors text-muted-foreground flex items-center gap-1.5"
                      title="Não serve: sai da fila e não volta"
                    >
                      <ThumbsDown className="h-3 w-3" /> Descartar
                    </button>
                  </>
                )}
              </div>
            </li>
          ))}
        </ul>
      </div>

      {/* BUSCA MANUAL */}
      <div className="bg-card border border-border rounded-xl p-5 mb-6">
        <h3 className="text-sm font-semibold text-foreground mb-3">Buscar agora</h3>
        <div className="grid gap-4 sm:grid-cols-[1fr_auto_auto] items-end">
          <div>
            <label className="block text-xs font-medium text-foreground mb-1">Cidade</label>
            <select className={campo} value={cidade} onChange={(e) => setCidade(e.target.value)}>
              <option value="">Qualquer cidade</option>
              {cidades.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-foreground mb-1">Quantas empresas</label>
            <select className={campo} value={amostra} onChange={(e) => setAmostra(Number(e.target.value))}>
              {[2, 3, 4, 6, 8, 10].map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>
          <button
            type="button"
            onClick={rodar}
            disabled={rodando}
            className="px-4 py-2.5 bg-accent hover:bg-accent/90 text-accent-foreground font-semibold rounded-md flex items-center gap-2 disabled:opacity-50 transition-colors"
          >
            {rodando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            Buscar
          </button>
        </div>
        <p className="text-xs text-muted-foreground mt-3 flex items-center gap-1.5">
          <Coins className="h-3.5 w-3.5" />
          Custa 1 crédito do Serper por empresa, e a chave é compartilhada com o radar do CRM.
          Buscar com {amostra} empresas gasta {amostra}. O achado já entra na fila acima.
        </p>
      </div>

      {res && (
        <div className="text-xs text-muted-foreground">
          Última busca manual: {res.creditos_serper} crédito(s), {res.gravados ?? 0} gravado(s) na fila
          {res.empresas_usadas?.length ? ` · empresas: ${res.empresas_usadas.join(', ')}` : ''}
          {(res.descartados?.length ?? 0) > 0 && (
            <span className="block mt-2">
              <Ban className="h-3 w-3 inline mr-1" />
              {res.descartados!.length} descartado(s) de saída por serem portal de conteúdo
              (blog, notícia, “os melhores”): {res.descartados!.map((d) => d.dominio).join(', ')}
            </span>
          )}
          <span className="block mt-2">
            <HelpCircle className="h-3 w-3 inline mr-1" />
            Abra o site antes de cadastrar: já apareceu site de agência de marketing com página de
            cliente, que parece diretório e não é.
          </span>
        </div>
      )}
    </div>
  );
};

export default Descoberta;
