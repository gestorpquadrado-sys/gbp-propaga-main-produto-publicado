import { useCallback, useEffect, useState } from 'react';
import { Loader2, Search, ExternalLink, Plus, AlertTriangle, Coins, HelpCircle, Ban } from 'lucide-react';
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

const campo =
  'w-full px-3 py-2 bg-background border border-border rounded-md text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring';

const FUNCAO = 'https://fljcywbqzzakwgzyguvl.supabase.co/functions/v1/directory-discovery';

const Descoberta = () => {
  const { ehAdmin, naEquipe, carregando: carregandoPapel } = usePapel();
  const [cidades, setCidades] = useState<string[]>([]);
  const [cidade, setCidade] = useState('');
  const [amostra, setAmostra] = useState(4);
  const [rodando, setRodando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [res, setRes] = useState<{
    candidatos: Candidato[];
    para_revisar: Candidato[];
    descartados?: Candidato[];
    creditos_serper: number;
    empresas_usadas?: string[];
  } | null>(null);

  useEffect(() => {
    if (!naEquipe) return;
    supabase
      .from('companies')
      .select('city')
      .not('city', 'is', null)
      .then(({ data }) => {
        const conta = new Map<string, number>();
        for (const r of (data ?? []) as { city: string }[]) {
          conta.set(r.city, (conta.get(r.city) ?? 0) + 1);
        }
        setCidades([...conta.entries()].sort((a, b) => b[1] - a[1]).map(([c, n]) => `${c} (${n})`));
      });
  }, [naEquipe]);

  const rodar = useCallback(async () => {
    setRodando(true);
    setErro(null);
    setAviso(null);
    setRes(null);
    try {
      const { data: s } = await supabase.auth.getSession();
      const cid = cidade.replace(/\s*\(\d+\)$/, '');
      const q = new URLSearchParams({ amostra: String(amostra), incluir_descartados: '1' });
      if (cid) q.set('cidade', cid);
      const r = await fetch(`${FUNCAO}?${q}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${s.session?.access_token ?? ''}` },
      });
      const d = await r.json();
      if (!d?.success) throw new Error(d?.error ?? 'A busca falhou');
      setRes(d);
      if ((d.candidatos ?? []).length === 0 && (d.para_revisar ?? []).length === 0) {
        setAviso('Nenhum domínio novo. Ou já está tudo cadastrado para essas empresas, ou vale tentar outra cidade.');
      }
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível buscar');
    } finally {
      setRodando(false);
    }
  }, [cidade, amostra]);

  const cadastrar = async (c: Candidato) => {
    const code = window.prompt(
      `Código curto para ${c.dominio} (só letras minúsculas, sem espaço):`,
      c.dominio.split('.')[0].replace(/[^a-z0-9]/g, ''),
    );
    if (!code) return;
    const nome = window.prompt('Nome do diretório como aparece no site:', c.titulos[0]?.slice(0, 40) ?? c.dominio);
    if (!nome) return;
    const formUrl = window.prompt(
      'URL do formulário de cadastro (deixe vazio se ainda não souber — entra como manual):',
      '',
    );
    setErro(null);
    const { error } = await supabase.from('directory_channels').insert({
      code: code.trim(),
      name: nome.trim(),
      website_url: `https://${c.dominio}`,
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
      search_url_template: `https://www.bing.com/search?q=site%3A${c.dominio}+{name}+{city}`,
      notes: `Achado pela descoberta em ${new Date().toLocaleDateString('pt-BR')}: ${c.porque}. URL de exemplo: ${c.caminhos[0] ?? '—'}`,
    } as never);
    if (error) setErro(`Não entrou: ${error.message}`);
    else setAviso(`${nome} cadastrado. Confira o nicho e as instruções na aba Canais.`);
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

  const bloco = (titulo: string, itens: Candidato[], Icone: typeof Search, cor: string, explica: string) => (
    itens.length > 0 && (
      <div className="mb-6">
        <h3 className={`text-sm font-semibold ${cor} flex items-center gap-2 mb-1`}>
          <Icone className="h-4 w-4" /> {titulo} ({itens.length})
        </h3>
        <p className="text-xs text-muted-foreground mb-3">{explica}</p>
        <ul className="space-y-2">
          {itens.map((c) => (
            <li key={c.dominio} className="bg-card border border-border rounded-lg px-4 py-3 flex items-start gap-3 flex-wrap">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-foreground">{c.dominio}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{c.porque}</p>
                {c.caminhos[0] && (
                  <p className="text-xs text-muted-foreground mt-1 font-mono truncate">{c.caminhos[0]}</p>
                )}
              </div>
              <div className="flex items-center gap-2">
                <a
                  href={`https://${c.dominio}${c.caminhos[0] ?? ''}`}
                  target="_blank"
                  rel="noreferrer"
                  className="px-3 py-1.5 text-xs border border-border rounded-md hover:bg-background transition-colors text-foreground flex items-center gap-1.5"
                >
                  Abrir <ExternalLink className="h-3 w-3" />
                </a>
                {ehAdmin && (
                  <button
                    type="button"
                    onClick={() => cadastrar(c)}
                    className="px-3 py-1.5 text-xs border border-border rounded-md hover:bg-background transition-colors text-foreground flex items-center gap-1.5"
                  >
                    <Plus className="h-3 w-3" /> Cadastrar
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      </div>
    )
  );

  return (
    <div>
      <h2 className="text-lg font-semibold text-foreground">Descobrir diretórios</h2>
      <p className="text-sm text-muted-foreground mt-1 mb-5">
        Busca <strong>empresas reais da sua base</strong> no Google e vê em quais sites o perfil delas aparece.
        É assim que se acha guia local: procurar por termo genérico devolve artigo de blog, não diretório.
      </p>

      <div className="bg-card border border-border rounded-xl p-5 mb-6">
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
          Custa 1 crédito do Serper por empresa pesquisada, e a chave é compartilhada com o radar do CRM. Buscar com {amostra} empresas gasta {amostra}.
        </p>
      </div>

      {erro && <p className="text-sm text-destructive bg-destructive/10 p-3 rounded-md mb-4">{erro}</p>}
      {aviso && <p className="text-sm text-accent bg-accent/10 p-3 rounded-md mb-4">{aviso}</p>}

      {res && (
        <>
          <p className="text-xs text-muted-foreground mb-5">
            {res.creditos_serper} crédito(s) gastos
            {res.empresas_usadas?.length ? ` · empresas pesquisadas: ${res.empresas_usadas.join(', ')}` : ''}
          </p>
          {bloco('Candidatos', res.candidatos ?? [], Search, 'text-emerald-500',
            'Têm prova de perfil de empresa. Mesmo assim, ABRA antes de cadastrar: já apareceu site de agência de marketing com página de cliente, que parece diretório e não é.')}
          {bloco('Para revisar', res.para_revisar ?? [], HelpCircle, 'text-amber-500',
            'Apareceram na busca e não deram prova nem contraprova. É aqui que mora o guia local cujo resultado foi a home — vale olhar um por um.')}
          {bloco('Descartados', res.descartados ?? [], Ban, 'text-muted-foreground',
            'Portal de conteúdo: blog, notícia, artigo "os melhores". Mostrados só para você auditar o filtro.')}
        </>
      )}
    </div>
  );
};

export default Descoberta;
