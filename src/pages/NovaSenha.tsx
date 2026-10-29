import { useEffect, useState } from 'react';
import { Loader2, Eye, EyeOff, CheckCircle2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Simbolo, Logotipo } from '@/components/Marca';

/**
 * Define a senha a partir do link de recuperação.
 *
 * O cliente Supabase está com `detectSessionInUrl: true`, então ao abrir o link do
 * e-mail a sessão de recuperação já fica ativa — é por isso que esta tela consegue
 * chamar `updateUser` sem pedir a senha antiga. Se alguém abrir /nova-senha sem vir
 * de um link, não há sessão e a tela diz isso em vez de falhar no envio.
 */
const NovaSenha = () => {
  const [senha, setSenha] = useState('');
  const [ver, setVer] = useState(false);
  const [temSessao, setTemSessao] = useState<boolean | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [pronto, setPronto] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setTemSessao(Boolean(data.session)));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => setTemSessao(Boolean(s)));
    return () => subscription.unsubscribe();
  }, []);

  const salvar = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro(null);
    if (senha.length < 8) { setErro('Use pelo menos 8 caracteres.'); return; }
    setEnviando(true);
    const { error } = await supabase.auth.updateUser({ password: senha });
    setEnviando(false);
    if (error) setErro(error.message);
    else setPronto(true);
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center mb-8 gap-3">
          <Simbolo className="w-16 h-16" />
          <div className="text-center">
            <Logotipo className="h-7 mx-auto" />
            <p className="text-sm text-muted-foreground mt-2">P² Local Listings</p>
          </div>
        </div>

        <div className="bg-card border border-border rounded-xl p-8 shadow-purple">
          {pronto ? (
            <div className="text-center">
              <CheckCircle2 className="h-10 w-10 text-emerald-500 mx-auto mb-3" />
              <h2 className="text-lg font-semibold text-foreground">Senha definida</h2>
              <p className="text-sm text-muted-foreground mt-2">Já pode usar a nova senha.</p>
              <a href="/" className="inline-block mt-5 px-4 py-2.5 bg-accent hover:bg-accent/90 text-accent-foreground font-semibold rounded-md transition-colors">
                Entrar no sistema
              </a>
            </div>
          ) : temSessao === false ? (
            <div className="text-center">
              <h2 className="text-lg font-semibold text-foreground">Link inválido ou expirado</h2>
              <p className="text-sm text-muted-foreground mt-2">
                Esta tela só funciona abrindo o link que chega por e-mail. Volte ao login e peça
                "Esqueci minha senha" de novo.
              </p>
              <a href="/auth" className="inline-block mt-5 text-sm text-primary underline">Voltar ao login</a>
            </div>
          ) : (
            <form onSubmit={salvar}>
              <h2 className="text-xl font-semibold text-foreground mb-6 text-center">Definir nova senha</h2>
              <label className="block text-sm font-medium text-foreground mb-1.5">Nova senha</label>
              <div className="relative">
                <input
                  type={ver ? 'text' : 'password'}
                  value={senha}
                  onChange={(e) => setSenha(e.target.value)}
                  className="w-full px-3 py-2 pr-11 bg-background border border-border rounded-md text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  placeholder="pelo menos 8 caracteres"
                  autoComplete="new-password"
                  required
                />
                <button
                  type="button"
                  onClick={() => setVer((v) => !v)}
                  tabIndex={-1}
                  aria-label={ver ? 'Ocultar senha' : 'Mostrar senha'}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {ver ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {erro && <p className="text-sm text-destructive bg-destructive/10 p-3 rounded-md mt-4">{erro}</p>}
              <button
                type="submit"
                disabled={enviando || temSessao === null}
                className="w-full mt-5 py-2.5 bg-accent hover:bg-accent/90 text-accent-foreground font-semibold rounded-md flex items-center justify-center gap-2 disabled:opacity-50 transition-colors"
              >
                {enviando && <Loader2 className="h-4 w-4 animate-spin" />}
                Salvar senha
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

export default NovaSenha;
