import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Loader2, Search, Save, X, CheckCircle2, XCircle, AlertTriangle,
  Mail, FileText, Hand, DollarSign, RefreshCw, Globe,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { usePapel } from '@/hooks/usePapel';

export type Canal = {
  id: string;
  code: string;
  name: string;
  country: string | null;
  language: string | null;
  submission_type: string | null;
  email_to: string | null;
  form_url: string | null;
  website_url: string | null;
  category: string | null;
  categories: string[] | null;
  instructions: string | null;
  notes: string | null;
  is_active: boolean | null;
  requires_paid_plan: boolean | null;
  requires_login: boolean | null;
  priority: number | null;
  region: string | null;
  email_status: string | null;
  email_evidence: string | null;
  email_checked_at: string | null;
  last_check_status: string | null;
  last_checked_at: string | null;
};

const campo =
  'w-full px-3 py-2 bg-background border border-border rounded-md text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring';

// O que cada estado de caixa quer dizer, em português de gente. É o que explica por que
// um canal está desligado mesmo com o site no ar.
const CAIXA: Record<string, { texto: string; tom: string; morta: boolean }> = {
  entrega_ok: { texto: 'entrega confirmada', tom: 'text-emerald-500', morta: false },
  indeterminado: { texto: 'caixa não comprovada', tom: 'text-amber-500', morta: false },
  bounce: { texto: 'e-mail voltou (bounce)', tom: 'text-destructive', morta: true },
  sem_mx: { texto: 'domínio sem MX', tom: 'text-destructive', morta: true },
  null_mx: { texto: 'domínio recusa e-mail', tom: 'text-destructive', morta: true },
  nao_existe: { texto: 'conta não existe', tom: 'text-destructive', morta: true },
};

const TIPOS = [
  { v: 'form', rotulo: 'Formulário', icone: FileText },
  { v: 'email', rotulo: 'E-mail', icone: Mail },
  { v: 'manual', rotulo: 'Manual', icone: Hand },
  { v: 'api', rotulo: 'API', icone: Globe },
];

const dataCurta = (v: string | null) =>
  v ? new Date(v).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) : '—';

const Canais = () => {
  const { ehAdmin, naEquipe, carregando: carregandoPapel } = usePapel();
  const [canais, setCanais] = useState<Canal[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [busca, setBusca] = useState('');
  const [filtro, setFiltro] = useState<'todos' | 'ativos' | 'inativos' | 'caixa_morta' | 'sem_destino'>('todos');
  const [editando, setEditando] = useState<string | null>(null);
  const [rascunho, setRascunho] = useState<Partial<Canal>>({});
  const [salvando, setSalvando] = useState(false);
  const [conferindo, setConferindo] = useState(false);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    const { data, error } = await supabase
      .from('directory_channels')
      .select('*')
      .order('is_active', { ascending: false })
      .order('code');
    if (error) setErro(error.message);
    else setCanais((data ?? []) as unknown as Canal[]);
    setCarregando(false);
  }, []);

  useEffect(() => {
    if (!carregandoPapel && naEquipe) carregar();
    else if (!carregandoPapel) setCarregando(false);
  }, [carregandoPapel, naEquipe, carregar]);

  const lista = useMemo(() => {
    const t = busca.trim().toLowerCase();
    return canais.filter((c) => {
      if (t && !`${c.code} ${c.name} ${c.region ?? ''} ${c.category ?? ''}`.toLowerCase().includes(t)) return false;
      const morta = c.email_status ? CAIXA[c.email_status]?.morta : false;
      const semDestino = !c.form_url && !c.email_to && c.submission_type !== 'manual';
      if (filtro === 'ativos') return Boolean(c.is_active);
      if (filtro === 'inativos') return !c.is_active;
      if (filtro === 'caixa_morta') return Boolean(morta);
      if (filtro === 'sem_destino') return semDestino;
      return true;
    });
  }, [canais, busca, filtro]);

  const abrir = (c: Canal) => {
    setEditando(c.code);
    setAviso(null);
    setRascunho({
      name: c.name, country: c.country, submission_type: c.submission_type,
      email_to: c.email_to, form_url: c.form_url, website_url: c.website_url,
      category: c.category, categories: c.categories, instructions: c.instructions,
      requires_paid_plan: c.requires_paid_plan, requires_login: c.requires_login,
      priority: c.priority, region: c.region,
    });
  };

  const salvar = async (c: Canal) => {
    setSalvando(true);
    setErro(null);
    const { error } = await supabase
      .from('directory_channels')
      .update({ ...rascunho, updated_at: new Date().toISOString() } as never)
      .eq('code', c.code);
    setSalvando(false);
    if (error) { setErro(error.message); return; }
    setEditando(null);
    setAviso(`${c.name} salvo.`);
    carregar();
  };

  const ligar = async (c: Canal) => {
    const morta = c.email_status ? CAIXA[c.email_status]?.morta : false;
    if (!c.is_active && morta && c.submission_type === 'email') {
      if (!window.confirm(
        `A caixa deste canal está provada morta (${CAIXA[c.email_status!]?.texto}).\n\n` +
        'Religar como e-mail faz o sistema enviar para o vazio e queima a reputação de ' +
        'envio.pquadrado.com.br, que é compartilhado com o CRM.\n\n' +
        'Se o diretório tem formulário, mude o tipo para Formulário em vez de religar o e-mail. Continuar mesmo assim?'
      )) return;
    }
    const { error } = await supabase
      .from('directory_channels')
      .update({ is_active: !c.is_active, updated_at: new Date().toISOString() } as never)
      .eq('code', c.code);
    if (error) setErro(error.message); else carregar();
  };

  const conferirAgora = async () => {
    setConferindo(true);
    setErro(null);
    setAviso(null);
    try {
      const { data: s } = await supabase.auth.getSession();
      const r = await fetch(
        'https://fljcywbqzzakwgzyguvl.supabase.co/functions/v1/directory-channels-check?limit=12&mode=safe',
        { method: 'POST', headers: { Authorization: `Bearer ${s.session?.access_token ?? ''}` } },
      );
      const d = await r.json();
      if (!d?.success) throw new Error(d?.error ?? 'A conferência falhou');
      setAviso(`Conferidos ${d.checked} canais: ${d.active} ativos, ${d.inactive} inativos. Roda em lotes, pelos mais esquecidos primeiro.`);
      carregar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível conferir agora');
    } finally {
      setConferindo(false);
    }
  };

  if (carregandoPapel || carregando) {
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

  const ativos = canais.filter((c) => c.is_active).length;
  const mortas = canais.filter((c) => c.email_status && CAIXA[c.email_status]?.morta).length;

  return (
    <div>
      <div className="flex items-start justify-between gap-4 flex-wrap mb-5">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Canais de diretório</h2>
          <p className="text-sm text-muted-foreground mt-1">
            {canais.length} canais · {ativos} ativos · {mortas} com caixa de e-mail provada morta
            {!ehAdmin && ' · só leitura (você não é administrador)'}
          </p>
        </div>
        {ehAdmin && (
          <button
            type="button"
            onClick={conferirAgora}
            disabled={conferindo}
            className="px-3 py-2 text-sm border border-border rounded-md hover:bg-card transition-colors text-foreground flex items-center gap-2 disabled:opacity-50"
            title="Roda o health-check num lote de 12 canais"
          >
            {conferindo ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Conferir agora
          </button>
        )}
      </div>

      {erro && <p className="text-sm text-destructive bg-destructive/10 p-3 rounded-md mb-4">{erro}</p>}
      {aviso && <p className="text-sm text-accent bg-accent/10 p-3 rounded-md mb-4">{aviso}</p>}

      <div className="flex gap-3 flex-wrap mb-4">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="h-4 w-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            className={`${campo} pl-9`}
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="buscar por nome, código, região ou nicho"
          />
        </div>
        <select className={`${campo} w-auto`} value={filtro} onChange={(e) => setFiltro(e.target.value as typeof filtro)}>
          <option value="todos">Todos</option>
          <option value="ativos">Só ativos</option>
          <option value="inativos">Só inativos</option>
          <option value="caixa_morta">Caixa morta</option>
          <option value="sem_destino">Sem formulário nem e-mail</option>
        </select>
      </div>

      <ul className="space-y-3">
        {lista.map((c) => {
          const caixa = c.email_status ? CAIXA[c.email_status] : null;
          const tipo = TIPOS.find((t) => t.v === c.submission_type);
          const Icone = tipo?.icone ?? Hand;
          const aberto = editando === c.code;
          const destino = c.form_url || c.email_to;
          return (
            <li key={c.code} className="bg-card border border-border rounded-xl overflow-hidden">
              <div className="px-5 py-4 flex items-start gap-4 flex-wrap">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    {c.is_active
                      ? <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                      : <XCircle className="h-4 w-4 text-muted-foreground shrink-0" />}
                    <span className="text-sm font-medium text-foreground">{c.name}</span>
                    <code className="text-xs text-muted-foreground">{c.code}</code>
                    <span className="text-xs px-1.5 py-0.5 border border-border rounded text-muted-foreground flex items-center gap-1">
                      <Icone className="h-3 w-3" /> {tipo?.rotulo ?? c.submission_type}
                    </span>
                    <span className="text-xs px-1.5 py-0.5 border border-border rounded text-muted-foreground">
                      {c.country ?? 'GLOBAL'}
                    </span>
                    {c.requires_paid_plan && (
                      <span className="text-xs px-1.5 py-0.5 border border-amber-500/40 text-amber-500 rounded flex items-center gap-1">
                        <DollarSign className="h-3 w-3" /> plano pago
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1.5 truncate">
                    {destino || <span className="text-destructive">sem formulário nem e-mail</span>}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    nicho: {c.category ?? '—'}
                    {c.region ? ` · ${c.region}` : ''}
                    {' · site conferido '}{dataCurta(c.last_checked_at)}
                    {c.last_check_status ? ` (${c.last_check_status})` : ''}
                  </p>
                  {caixa && (
                    <p className={`text-xs mt-1 ${caixa.tom}`}>
                      caixa: {caixa.texto}
                      {c.email_checked_at ? ` · conferida ${dataCurta(c.email_checked_at)}` : ''}
                    </p>
                  )}
                  {caixa?.morta && c.email_evidence && (
                    <p className="text-xs text-muted-foreground mt-1 italic">{c.email_evidence}</p>
                  )}
                </div>
                {ehAdmin && (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => ligar(c)}
                      className="px-3 py-1.5 text-xs border border-border rounded-md hover:bg-background transition-colors text-foreground"
                    >
                      {c.is_active ? 'Desligar' : 'Ligar'}
                    </button>
                    <button
                      type="button"
                      onClick={() => (aberto ? setEditando(null) : abrir(c))}
                      className="px-3 py-1.5 text-xs border border-border rounded-md hover:bg-background transition-colors text-foreground"
                    >
                      {aberto ? 'Fechar' : 'Editar'}
                    </button>
                  </div>
                )}
              </div>

              {aberto && ehAdmin && (
                <div className="px-5 pb-5 pt-1 border-t border-border bg-background/40">
                  <div className="grid gap-4 sm:grid-cols-2 mt-4">
                    <div>
                      <label className="block text-xs font-medium text-foreground mb-1">Nome</label>
                      <input className={campo} value={rascunho.name ?? ''} onChange={(e) => setRascunho({ ...rascunho, name: e.target.value })} />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-foreground mb-1">Como cadastra</label>
                      <select className={campo} value={rascunho.submission_type ?? 'form'} onChange={(e) => setRascunho({ ...rascunho, submission_type: e.target.value })}>
                        {TIPOS.map((t) => <option key={t.v} value={t.v}>{t.rotulo}</option>)}
                      </select>
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-xs font-medium text-foreground mb-1">URL do formulário de cadastro</label>
                      <input className={campo} value={rascunho.form_url ?? ''} onChange={(e) => setRascunho({ ...rascunho, form_url: e.target.value || null })} placeholder="https://..." />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-foreground mb-1">E-mail de cadastro</label>
                      <input className={campo} value={rascunho.email_to ?? ''} onChange={(e) => setRascunho({ ...rascunho, email_to: e.target.value || null })} placeholder="cadastro@..." />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-foreground mb-1">Site do diretório</label>
                      <input className={campo} value={rascunho.website_url ?? ''} onChange={(e) => setRascunho({ ...rascunho, website_url: e.target.value || null })} />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-foreground mb-1">País que atende</label>
                      <select className={campo} value={rascunho.country ?? 'GLOBAL'} onChange={(e) => setRascunho({ ...rascunho, country: e.target.value })}>
                        <option value="GLOBAL">GLOBAL — qualquer país</option>
                        <option value="BR">BR — só Brasil</option>
                        <option value="US">US — só Estados Unidos</option>
                        <option value="AE">AE — Emirados</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-foreground mb-1">Nicho principal</label>
                      <input className={campo} value={rascunho.category ?? ''} onChange={(e) => setRascunho({ ...rascunho, category: e.target.value || null })} placeholder="general, restaurants, real_estate…" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-foreground mb-1">Nichos extras (separados por vírgula)</label>
                      <input
                        className={campo}
                        value={(rascunho.categories ?? []).join(', ')}
                        onChange={(e) => setRascunho({ ...rascunho, categories: e.target.value.split(',').map((x) => x.trim()).filter(Boolean) })}
                        placeholder="general, services"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-foreground mb-1">Região (opcional)</label>
                      <input className={campo} value={rascunho.region ?? ''} onChange={(e) => setRascunho({ ...rascunho, region: e.target.value || null })} placeholder="Ribeirão Preto e região (SP)" />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-xs font-medium text-foreground mb-1">
                        Instruções para quem vai cadastrar
                      </label>
                      <textarea
                        className={`${campo} min-h-[80px]`}
                        value={rascunho.instructions ?? ''}
                        onChange={(e) => setRascunho({ ...rascunho, instructions: e.target.value || null })}
                        placeholder="Ex.: cadastro grátis só uma vez por negócio; o anúncio destacado é pago e fica em outro link."
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        Este texto aparece para o operador no painel do cliente. É onde mora o que ninguém adivinha.
                      </p>
                    </div>
                    <label className="flex items-center gap-2 text-sm text-foreground">
                      <input type="checkbox" checked={Boolean(rascunho.requires_paid_plan)} onChange={(e) => setRascunho({ ...rascunho, requires_paid_plan: e.target.checked })} />
                      Exige plano pago
                    </label>
                    <label className="flex items-center gap-2 text-sm text-foreground">
                      <input type="checkbox" checked={Boolean(rascunho.requires_login)} onChange={(e) => setRascunho({ ...rascunho, requires_login: e.target.checked })} />
                      Exige criar login no diretório
                    </label>
                  </div>
                  <div className="flex gap-2 mt-5">
                    <button
                      type="button"
                      onClick={() => salvar(c)}
                      disabled={salvando}
                      className="px-4 py-2 text-sm bg-accent hover:bg-accent/90 text-accent-foreground font-semibold rounded-md flex items-center gap-2 disabled:opacity-50"
                    >
                      {salvando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                      Salvar
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditando(null)}
                      className="px-4 py-2 text-sm border border-border rounded-md hover:bg-background transition-colors text-foreground flex items-center gap-2"
                    >
                      <X className="h-4 w-4" /> Cancelar
                    </button>
                  </div>
                </div>
              )}
            </li>
          );
        })}
      </ul>
      {lista.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-10">Nenhum canal com esse filtro.</p>
      )}
    </div>
  );
};

export default Canais;
