import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

/**
 * Qual é o meu papel na equipe.
 *
 * Lê direto de `authorized_users`: a RLS libera a leitura para quem é da equipe, então
 * não precisa passar pela Edge Function só para saber isso. Quem não está autorizado
 * recebe zero linhas e fica com papel `null` — que é o que a tela usa para dizer
 * "sem acesso" em vez de quebrar.
 */
export function usePapel() {
  const { user, loading } = useAuth();
  const [papel, setPapel] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    let vivo = true;
    if (loading) return;
    const email = user?.email;
    if (!email) {
      setPapel(null);
      setCarregando(false);
      return;
    }
    supabase
      .from('authorized_users')
      .select('role')
      .ilike('email', email)
      .maybeSingle()
      .then(({ data }) => {
        if (!vivo) return;
        setPapel((data as { role?: string } | null)?.role ?? null);
        setCarregando(false);
      });
    return () => { vivo = false; };
  }, [user?.email, loading]);

  return { papel, ehAdmin: papel === 'admin', naEquipe: papel !== null, carregando };
}
