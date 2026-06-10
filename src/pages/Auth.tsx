import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { Building2, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

const Auth = () => {
  const { user, loading } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [isLogin, setIsLogin] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (user) return <Navigate to="/" replace />;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setSubmitting(true);

    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              full_name: fullName,
              company_name: companyName,
              whatsapp,
            },
          },
        });
        if (error) throw error;
        setSuccess('Conta criada! Verifique seu email para confirmar.');
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Ocorreu um erro. Tente novamente.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center mb-8 gap-3">
          <div className="w-14 h-14 bg-gradient-to-br from-brand-purple to-brand-magenta rounded-xl flex items-center justify-center">
            <Building2 className="h-8 w-8 text-white" />
          </div>
          <div className="text-center">
            <h1 className="text-2xl font-bold text-foreground">pquadrado</h1>
            <p className="text-sm text-muted-foreground">Estratégias que Vencem</p>
          </div>
        </div>

        <div className="bg-card border border-border rounded-xl p-8 shadow-purple">
          <h2 className="text-xl font-semibold text-foreground mb-6 text-center">
            {isLogin ? 'Entrar na plataforma' : 'Criar conta'}
          </h2>

          <form onSubmit={handleSubmit} className="space-y-4">

            {!isLogin && (
              <>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1.5">Nome</label>
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="w-full px-3 py-2 bg-background border border-border rounded-md text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                    placeholder="Seu nome"
                    required={!isLogin}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1.5">Empresa</label>
                  <input
                    type="text"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    className="w-full px-3 py-2 bg-background border border-border rounded-md text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                    placeholder="Nome da empresa"
                    required={!isLogin}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1.5">WhatsApp</label>
                  <input
                    type="tel"
                    value={whatsapp}
                    onChange={(e) => setWhatsapp(e.target.value)}
                    className="w-full px-3 py-2 bg-background border border-border rounded-md text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                    placeholder="(16) 99999-9999"
                  />
                </div>
              </>
            )}
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3 py-2 bg-background border border-border rounded-md text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                placeholder="seu@email.com"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">Senha</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3 py-2 bg-background border border-border rounded-md text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                placeholder="••••••••"
                required
              />
            </div>

            {error && (
              <p className="text-sm text-destructive bg-destructive/10 p-3 rounded-md">{error}</p>
            )}
            {success && (
              <p className="text-sm text-accent bg-accent/10 p-3 rounded-md">{success}</p>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-2.5 bg-accent hover:bg-accent/90 text-accent-foreground font-semibold rounded-md flex items-center justify-center gap-2 disabled:opacity-50 transition-colors"
            >
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              {isLogin ? 'Entrar' : 'Criar conta'}
            </button>
          </form>

          <p className="text-center text-sm text-muted-foreground mt-6">
            {isLogin ? 'Não tem conta?' : 'Já tem conta?'}{' '}
            <button
              onClick={() => { setIsLogin(!isLogin); setError(null); setSuccess(null); }}
              className="text-primary underline font-medium"
            >
              {isLogin ? 'Criar conta' : 'Entrar'}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Auth;
