import { useCallback, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { Loader2, UserPlus, Trash2, Copy, KeyRound, AlertTriangle, Eye, EyeOff, Pencil, Save, X, Info } from 'lucide-react';
import Header from '@/components/Header';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { usePapel } from '@/hooks/usePapel';
import { appEnv } from '@/lib/env';

/**
 * Esta tela é usada sozinha em /equipe e também dentro da aba de Configurações;
 * `semMoldura` tira o Header e o container, que o hub já desenha.
 *
 * Precisa viver FORA do componente. Quando estava declarada dentro, cada tecla
 * digitada criava uma função nova, o React entendia como outro tipo de componente,
 * desmontava a árvore inteira e remontava — o input era destruído e recriado, e o
 * cursor saía do campo a cada letra.
 */
const Moldura = ({ semMoldura, children }: { semMoldura: boolean; children: ReactNode }) =>
  semMoldura ? <>{children}</> : (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="container mx-auto px-6 py-10 max-w-4xl">{children}</div>
    </div>
  );

type Usuario = {
  email: string;
  nome: string | null;
  papel: string;
  autorizado_em: string | null;
  tem_conta: boolean;
  ultimo_acesso: string | null;
};

const campo =
  'w-full px-3 py-2 bg-background border border-border rounded-md text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring';

const data = (v: string | null) =>
  v ? new Date(v).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—';

const Equipe = ({ semMoldura = false }: { semMoldura?: boolean }) => {
  const { user } = useAuth();
  const { ehAdmin, naEquipe, carregando: carregandoPapel } = usePapel();

  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [orfas, setOrfas] = useState<{ email: string }[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [papelNovo, setPapelNovo] = useState('user');
  const [enviando, setEnviando] = useState(false);
  const [senhaGerada, setSenhaGerada] = useState<{ email: string; senha: string } | null>(null);

  const [editando, setEditando] = useState<string | null>(null);
  const [edNome, setEdNome] = useState('');
  const [edPapel, setEdPapel] = useState('user');
  const [salvandoEd, setSalvandoEd] = useState(false);

  const [minhaSenha, setMinhaSenha] = useState('');
  const [trocando, setTrocando] = useState(false);
  const [verNova, setVerNova] = useState(false);

  const chamar = useCallback(async (corpo: Record<string, unknown>) => {
    const { data: sessao } = await supabase.auth.getSession();
    const token = sessao.session?.access_token;
    if (!token) throw new Error('Sua sessão expirou. Entre de novo.');
    const r = await fetch(appEnv.equipeEndpoint, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(corpo),
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(d?.erro ?? `Erro ${r.status}`);
    return d;
  }, []);

  const recarregar = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    try {
      const d = await chamar({ acao: 'listar' });
      setUsuarios(d.usuarios ?? []);
      setOrfas(d.contas_sem_autorizacao ?? []);
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível carregar a equipe');
    } finally {
      setCarregando(false);
    }
  }, [chamar]);

  useEffect(() => {
    if (!carregandoPapel && naEquipe) recarregar();
    else if (!carregandoPapel) setCarregando(false);
  }, [carregandoPapel, naEquipe, recarregar]);

  const adicionar = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro(null);
    setAviso(null);
    setSenhaGerada(null);
    setEnviando(true);
    try {
      const d = await chamar({ acao: 'adicionar', email: email.trim(), nome: nome.trim(), papel: papelNovo });
      if (d.senha_temporaria) setSenhaGerada({ email: d.email, senha: d.senha_temporaria });
      else setAviso(d.aviso ?? 'Pessoa autorizada.');
      setNome('');
      setEmail('');
      setPapelNovo('user');
      await recarregar();
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Não foi possível adicionar');
    } finally {
      setEnviando(false);
    }
  };

  const abrirEdicao = (u: Usuario) => {
    setEditando(u.email);
    setErro(null);
    setAviso(null);
    setEdNome(u.nome ?? '');
    setEdPapel(u.papel);
  };

  const salvarEdicao = async (u: Usuario) => {
    setSalvandoEd(true);
    setErro(null);
    try {
      await chamar({ acao: 'editar', email: u.email, nome: edNome.trim(), papel: edPapel });
      setEditando(null);
      setAviso(`${edNome.trim() || u.email} salvo.`);
      await recarregar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível salvar');
    } finally {
      setSalvandoEd(false);
    }
  };

  const redefinirSenha = async (u: Usuario) => {
    if (!window.confirm(
      `Gerar uma senha nova para ${u.email}?\n\nA senha atual deixa de funcionar na hora, ` +
      'e a nova aparece aqui uma única vez.'
    )) return;
    setErro(null);
    setAviso(null);
    setSenhaGerada(null);
    try {
      const d = await chamar({ acao: 'senha', email: u.email });
      if (d.senha_temporaria) setSenhaGerada({ email: d.email, senha: d.senha_temporaria });
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível redefinir a senha');
    }
  };


  const remover = async (u: Usuario) => {
    if (!window.confirm(`Remover o acesso de ${u.email}? A conta dela é apagada e ela perde o login.`)) return;
    setErro(null);
    try {
      await chamar({ acao: 'remover', email: u.email });
      await recarregar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível remover');
    }
  };

  const trocarMinhaSenha = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro(null);
    setAviso(null);
    if (minhaSenha.length < 8) {
      setErro('A senha precisa de pelo menos 8 caracteres.');
      return;
    }
    setTrocando(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: minhaSenha });
      if (error) throw error;
      setMinhaSenha('');
      setAviso('Senha trocada.');
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Não foi possível trocar a senha');
    } finally {
      setTrocando(false);
    }
  };

  if (carregandoPapel || carregando) {
    return (
      <Moldura semMoldura={semMoldura}>
        <div className="flex items-center justify-center py-24">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </Moldura>
    );
  }

  if (!naEquipe) {
    return (
      <Moldura semMoldura={semMoldura}>
        <div className="max-w-xl">
          <div className="bg-card border border-border rounded-xl p-8 text-center">
            <AlertTriangle className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
            <h2 className="text-lg font-semibold text-foreground">Sem acesso a esta área</h2>
            <p className="text-sm text-muted-foreground mt-2">
              Seu e-mail não está na lista da equipe. Peça a um administrador para autorizá-lo.
            </p>
          </div>
        </div>
      </Moldura>
    );
  }

  return (
    <Moldura semMoldura={semMoldura}>
      <div>
        <div className="mb-8">
          <h2 className="text-lg font-semibold text-foreground">Equipe</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Quem pode entrar no P² Local Listings e ver os clientes.
            {!ehAdmin && ' Só um administrador altera esta lista.'}
          </p>
        </div>

        {erro && (
          <p className="text-sm text-destructive bg-destructive/10 p-3 rounded-md mb-4">{erro}</p>
        )}
        {aviso && (
          <p className="text-sm text-accent bg-accent/10 p-3 rounded-md mb-4">{aviso}</p>
        )}

        {senhaGerada && (
          <div className="bg-accent/10 border border-accent/40 rounded-xl p-5 mb-6">
            <div className="flex items-start gap-3">
              <KeyRound className="h-5 w-5 text-accent mt-0.5 shrink-0" />
              <div className="min-w-0">
                <p className="text-sm font-semibold text-foreground">
                  Senha temporária de {senhaGerada.email}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Aparece uma única vez. Passe por um canal seguro e peça para trocar no primeiro acesso.
                </p>
                <div className="flex items-center gap-2 mt-3">
                  <code className="px-3 py-2 bg-background border border-border rounded-md text-foreground font-mono text-sm">
                    {senhaGerada.senha}
                  </code>
                  <button
                    type="button"
                    onClick={() => navigator.clipboard.writeText(senhaGerada.senha)}
                    className="p-2 border border-border rounded-md hover:bg-card transition-colors"
                    title="Copiar"
                  >
                    <Copy className="h-4 w-4 text-muted-foreground" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setSenhaGerada(null)}
                    className="text-xs text-muted-foreground underline ml-2"
                  >
                    já anotei
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {ehAdmin && (
          <form onSubmit={adicionar} className="bg-card border border-border rounded-xl p-6 mb-8">
            <h2 className="text-base font-semibold text-foreground mb-4 flex items-center gap-2">
              <UserPlus className="h-4 w-4 text-primary" /> Adicionar pessoa
            </h2>
            <div className="grid gap-4 sm:grid-cols-[1fr_1fr_auto]">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">Nome</label>
                <input className={campo} value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Nome da pessoa" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">E-mail</label>
                <input className={campo} type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="pessoa@pquadrado.com.br" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">Papel</label>
                <select className={campo} value={papelNovo} onChange={(e) => setPapelNovo(e.target.value)}>
                  <option value="user">Usuário</option>
                  <option value="admin">Administrador</option>
                </select>
              </div>
            </div>
            <div className="mt-4 rounded-lg border border-border bg-background/50 p-4">
              <p className="text-xs font-medium text-foreground flex items-center gap-1.5 mb-2">
                <Info className="h-3.5 w-3.5 text-primary" /> O que cada papel faz
              </p>
              <p className="text-xs text-muted-foreground">
                <strong className="text-foreground">Usuário</strong> — opera o produto inteiro: vê
                todos os clientes, abre o formulário de cada diretório com os dados prontos para
                colar, roda a sincronização, marca o que já foi publicado e troca a própria senha.
                Também <strong className="text-foreground">mexe no catálogo de diretórios</strong>:
                liga, desliga, corrige formulário, nicho e país, e cadastra diretório novo pela aba
                Descobrir. É quem cadastra que descobre essas coisas.
              </p>
              <p className="text-xs text-muted-foreground mt-2">
                <strong className="text-foreground">Administrador</strong> — tudo acima, mais o
                controle de quem entra: adicionar, editar e remover pessoas e redefinir a senha de
                outros. É a única diferença entre os dois papéis.
              </p>
              <p className="text-xs text-muted-foreground mt-2">
                Em caso de dúvida escolha <strong className="text-foreground">Usuário</strong>: dá
                para promover depois em dois cliques, no botão Editar da linha da pessoa.
              </p>
            </div>
            <button
              type="submit"
              disabled={enviando}
              className="mt-4 px-4 py-2.5 bg-accent hover:bg-accent/90 text-accent-foreground font-semibold rounded-md flex items-center justify-center gap-2 disabled:opacity-50 transition-colors"
            >
              {enviando && <Loader2 className="h-4 w-4 animate-spin" />}
              Criar acesso
            </button>
          </form>
        )}

        <div className="bg-card border border-border rounded-xl overflow-hidden mb-8">
          <div className="px-6 py-4 border-b border-border">
            <h2 className="text-base font-semibold text-foreground">
              {usuarios.length} {usuarios.length === 1 ? 'pessoa' : 'pessoas'} com acesso
            </h2>
          </div>
          <ul className="divide-y divide-border">
            {usuarios.map((u) => {
              const souEu = u.email.toLowerCase() === (user?.email ?? '').toLowerCase();
              return (
                <li key={u.email} className="px-6 py-4 flex items-center gap-4 flex-wrap">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground truncate">
                      {u.nome || u.email}
                      {souEu && <span className="text-xs text-muted-foreground font-normal ml-2">(você)</span>}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {u.papel === 'admin' ? 'Administrador' : 'Usuário'}
                      {' · '}
                      {u.tem_conta
                        ? u.ultimo_acesso ? `último acesso ${data(u.ultimo_acesso)}` : 'nunca entrou'
                        : 'sem conta criada'}
                    </p>
                  </div>
                  {ehAdmin && (
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => (editando === u.email ? setEditando(null) : abrirEdicao(u))}
                        className="px-3 py-1.5 text-xs border border-border rounded-md hover:bg-background transition-colors flex items-center gap-1.5 text-foreground"
                      >
                        <Pencil className="h-3.5 w-3.5" /> {editando === u.email ? 'Fechar' : 'Editar'}
                      </button>
                      {u.tem_conta && (
                        <button
                          type="button"
                          onClick={() => redefinirSenha(u)}
                          className="px-3 py-1.5 text-xs border border-border rounded-md hover:bg-background transition-colors flex items-center gap-1.5 text-foreground"
                          title="Gera uma senha nova e mostra aqui uma única vez"
                        >
                          <KeyRound className="h-3.5 w-3.5" /> Senha
                        </button>
                      )}
                      {!souEu && (
                        <button
                          type="button"
                          onClick={() => remover(u)}
                          className="px-3 py-1.5 text-xs border border-destructive/40 text-destructive rounded-md hover:bg-destructive/10 transition-colors flex items-center gap-1.5"
                        >
                          <Trash2 className="h-3.5 w-3.5" /> Remover
                        </button>
                      )}
                    </div>
                  )}
                  {ehAdmin && editando === u.email && (
                    <div className="w-full border-t border-border pt-4 mt-1 grid gap-4 sm:grid-cols-[1fr_auto_auto] items-end">
                      <div>
                        <label className="block text-xs font-medium text-foreground mb-1">Nome</label>
                        <input className={campo} value={edNome} onChange={(e) => setEdNome(e.target.value)} />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-foreground mb-1">Papel</label>
                        <select
                          className={campo}
                          value={edPapel}
                          onChange={(e) => setEdPapel(e.target.value)}
                          disabled={souEu}
                          title={souEu ? 'Você não pode mudar o seu próprio papel' : undefined}
                        >
                          <option value="user">Usuário</option>
                          <option value="admin">Administrador</option>
                        </select>
                      </div>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => salvarEdicao(u)}
                          disabled={salvandoEd}
                          className="px-3 py-2 text-sm bg-accent hover:bg-accent/90 text-accent-foreground font-semibold rounded-md flex items-center gap-2 disabled:opacity-50"
                        >
                          {salvandoEd ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                          Salvar
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditando(null)}
                          className="px-3 py-2 text-sm border border-border rounded-md hover:bg-background transition-colors text-foreground flex items-center gap-1.5"
                        >
                          <X className="h-4 w-4" /> Cancelar
                        </button>
                      </div>
                      <p className="sm:col-span-3 text-xs text-muted-foreground">
                        O e-mail não muda: ele é a chave do acesso. Para trocar de e-mail, remova e
                        cadastre de novo.
                        {souEu && ' E você não pode mudar o seu próprio papel.'}
                      </p>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </div>

        {ehAdmin && orfas.length > 0 && (
          <div className="bg-card border border-destructive/40 rounded-xl p-5 mb-8">
            <p className="text-sm font-semibold text-foreground flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-destructive" />
              {orfas.length} conta(s) de login sem autorização
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Existe conta no login que não está nesta lista. Ela não enxerga cliente nenhum, mas vale revisar:
              {' '}{orfas.map((o) => o.email).join(', ')}
            </p>
          </div>
        )}

        <form onSubmit={trocarMinhaSenha} className="bg-card border border-border rounded-xl p-6">
          <h2 className="text-base font-semibold text-foreground mb-4 flex items-center gap-2">
            <KeyRound className="h-4 w-4 text-primary" /> Trocar a minha senha
          </h2>
          <div className="flex gap-3 flex-wrap items-end">
            <div className="flex-1 min-w-[220px]">
              <label className="block text-sm font-medium text-foreground mb-1.5">Nova senha</label>
              <div className="relative">
                <input
                  className={`${campo} pr-11`}
                  type={verNova ? 'text' : 'password'}
                  value={minhaSenha}
                  onChange={(e) => setMinhaSenha(e.target.value)}
                  placeholder="pelo menos 8 caracteres"
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => setVerNova((v) => !v)}
                  tabIndex={-1}
                  aria-label={verNova ? 'Ocultar senha' : 'Mostrar senha'}
                  title={verNova ? 'Ocultar senha' : 'Mostrar senha'}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {verNova ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <button
              type="submit"
              disabled={trocando}
              className="px-4 py-2.5 border border-border rounded-md hover:bg-background transition-colors text-foreground font-medium flex items-center gap-2 disabled:opacity-50"
            >
              {trocando && <Loader2 className="h-4 w-4 animate-spin" />}
              Trocar
            </button>
          </div>
        </form>
      </div>
    </Moldura>
  );
};

export default Equipe;
