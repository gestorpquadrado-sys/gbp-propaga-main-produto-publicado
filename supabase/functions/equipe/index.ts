// Gestão de usuários do P² Local Listings, para a tela /equipe.
//
// Esta função usa a SERVICE_ROLE para criar e apagar conta no Auth, então a
// validação de QUEM está chamando é a parte que importa. A ordem é:
//
//   1. exige token de USUÁRIO no Authorization (recusa a própria service_role e a
//      anon: elas não identificam pessoa nenhuma);
//   2. pergunta ao Auth de quem é o token, em vez de confiar no que vem escrito nele;
//   3. confere em `authorized_users` que esse e-mail tem role='admin'.
//
// Só depois disso age. Qualquer falha nessa trilha devolve 401/403 e não toca em nada.
//
// Ações (POST, corpo JSON):
//   { acao: "listar" }
//   { acao: "adicionar", email, nome, papel }   -> cria e devolve senha temporária UMA vez
//   { acao: "editar", email, nome, papel }
//   { acao: "papel", email, papel }
//   { acao: "senha", email }                   -> redefine e devolve senha nova UMA vez
//   { acao: "convite", email }                 -> reenvia o e-mail com o link de senha
//   { acao: "remover", email }
//
// Travas que evitam deixar o sistema sem dono: ninguém remove ou rebaixa a si mesmo,
// e não é possível ficar sem nenhum admin.

const URL_BASE = Deno.env.get("SUPABASE_URL")!;
const CHAVE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const RESEND = Deno.env.get("RESEND_API_KEY") ?? "";
const REMETENTE = Deno.env.get("EQUIPE_FROM") ?? "P2 Local Listings <listings@envio.pquadrado.com.br>";
const ENDERECO_SISTEMA = Deno.env.get("EQUIPE_SITE") ?? "https://diretorios.pquadrado.com.br";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const PAPEIS = ["admin", "user"];

const cab = {
  apikey: CHAVE,
  Authorization: `Bearer ${CHAVE}`,
  "Content-Type": "application/json",
  Accept: "application/json",
};

async function sb(caminho: string, opcoes: RequestInit = {}) {
  const r = await fetch(`${URL_BASE}${caminho}`, {
    ...opcoes,
    headers: { ...cab, ...(opcoes.headers || {}) },
  });
  const texto = await r.text();
  if (!r.ok) throw new Error(`Supabase ${r.status}: ${texto.slice(0, 300)}`);
  return texto ? JSON.parse(texto) : null;
}

// Senha temporária legível: o admin vai ditar isso para alguém. Sem caracteres
// que se confundem (0/O, 1/l/I) e sem símbolo que quebre no copiar e colar.
function senhaTemporaria(): string {
  const letras = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const minus = "abcdefghijkmnpqrstuvwxyz";
  const num = "23456789";
  const b = new Uint32Array(14);
  crypto.getRandomValues(b);
  const p = (f: string, i: number) => f[b[i] % f.length];
  return [
    p(letras, 0), p(minus, 1), p(minus, 2), p(minus, 3),
    "-",
    p(minus, 4), p(minus, 5), p(minus, 6), p(minus, 7),
    "-",
    p(num, 8), p(num, 9), p(num, 10), p(letras, 11),
  ].join("");
}

// Quem está chamando? Pergunta ao Auth, não confia no conteúdo do token.
async function quemChama(req: Request) {
  const bruto = req.headers.get("Authorization") ?? "";
  const jwt = bruto.replace(/^Bearer\s+/i, "").trim();
  if (!jwt) return { erro: "Falta o token de quem está chamando", status: 401 };
  // Token de serviço não é pessoa: recusa explicitamente, senão qualquer um que
  // tenha a chave do projeto viraria admin de graça.
  if (jwt === CHAVE || (ANON && jwt === ANON)) {
    return { erro: "Esta ação exige login de usuário, não chave de projeto", status: 401 };
  }
  let dados: any;
  try {
    const r = await fetch(`${URL_BASE}/auth/v1/user`, {
      headers: { apikey: CHAVE, Authorization: `Bearer ${jwt}` },
    });
    if (!r.ok) return { erro: "Sessão inválida ou expirada", status: 401 };
    dados = await r.json();
  } catch {
    return { erro: "Não foi possível validar a sessão", status: 401 };
  }
  const email = String(dados?.email ?? "").toLowerCase();
  if (!email) return { erro: "Sessão sem e-mail", status: 401 };

  const linhas = await sb(
    `/rest/v1/authorized_users?select=email,name,role&email=ilike.${encodeURIComponent(email)}`,
  );
  const eu = (linhas || [])[0];
  if (!eu) return { erro: "Seu e-mail não está autorizado neste sistema", status: 403 };
  return { email, papel: eu.role, nome: eu.name };
}

// Convite por e-mail: manda LINK para a pessoa criar a própria senha, não a senha.
//
// Por que não usar o e-mail do próprio Supabase: este projeto não tem SMTP configurado,
// então o Auth usaria o SMTP compartilhado, limitado a 2 e-mails por hora. O Resend já
// está aqui com o domínio envio.pquadrado.com.br verificado.
//
// O link vem do admin/generate_link do próprio Auth (type=recovery) e aterra em
// /nova-senha, que detecta a sessão de recuperação e deixa definir a senha.
async function enviarConvite(email: string, nome: string, quemConvidou: string) {
  if (!RESEND) return { enviado: false, erro: "RESEND_API_KEY não configurada" };
  let link = "";
  try {
    const r = await fetch(`${URL_BASE}/auth/v1/admin/generate_link`, {
      method: "POST",
      headers: cab,
      body: JSON.stringify({
        type: "recovery",
        email,
        options: { redirect_to: `${ENDERECO_SISTEMA}/nova-senha` },
      }),
    });
    const d = await r.json();
    link = d?.action_link ?? d?.properties?.action_link ?? "";
    if (!link) return { enviado: false, erro: `Auth não devolveu o link: ${d?.msg ?? r.status}` };
  } catch (e) {
    return { enviado: false, erro: `Falha ao gerar o link: ${(e as Error).message}` };
  }

  const primeiro = (nome || "").trim().split(/\s+/)[0] || "você";
  const html = `<!doctype html><html lang="pt-BR"><body style="margin:0;background:#f5f5f7;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif">
  <div style="max-width:520px;margin:32px auto;background:#fff;border:1px solid #e5e5ea;border-radius:12px;padding:32px">
    <p style="margin:0 0 4px;font-size:13px;color:#8e8e93;letter-spacing:.04em;text-transform:uppercase">Pquadrado</p>
    <h1 style="margin:0 0 16px;font-size:20px;color:#1c1c1e">Seu acesso ao P² Local Listings</h1>
    <p style="margin:0 0 16px;font-size:15px;line-height:1.55;color:#3a3a3c">Olá, ${primeiro}. ${quemConvidou} criou um acesso para você no sistema de diretórios da Pquadrado, onde ficam os cadastros das empresas nos guias locais.</p>
    <p style="margin:0 0 24px;font-size:15px;line-height:1.55;color:#3a3a3c">Clique abaixo para <strong>definir a sua senha</strong>. O link é de uso único e vale por 1 hora.</p>
    <p style="margin:0 0 24px"><a href="${link}" style="display:inline-block;background:#6b4ce6;color:#fff;text-decoration:none;font-weight:600;font-size:15px;padding:13px 24px;border-radius:8px">Definir minha senha</a></p>
    <p style="margin:0 0 8px;font-size:13px;line-height:1.5;color:#8e8e93">Depois de definir, você entra em <a href="${ENDERECO_SISTEMA}" style="color:#6b4ce6">${ENDERECO_SISTEMA.replace("https://", "")}</a> com o seu e-mail e essa senha.</p>
    <p style="margin:0;font-size:13px;line-height:1.5;color:#8e8e93">Se o link já tiver expirado, peça um novo a quem administra o sistema.</p>
  </div></body></html>`;

  try {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${RESEND}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: REMETENTE,
        to: [email],
        subject: "Seu acesso ao P² Local Listings — defina sua senha",
        html,
      }),
    });
    const d = await r.json();
    if (!r.ok) return { enviado: false, erro: `Resend ${r.status}: ${d?.message ?? ""}` };
    return { enviado: true, id: d?.id ?? null };
  } catch (e) {
    return { enviado: false, erro: `Falha no envio: ${(e as Error).message}` };
  }
}

async function contasDoAuth() {
  const r = await fetch(`${URL_BASE}/auth/v1/admin/users?per_page=200`, { headers: cab });
  const d = await r.json();
  return (d?.users ?? []) as any[];
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  const json = (b: unknown, s = 200) =>
    new Response(JSON.stringify(b), { status: s, headers: { ...CORS, "Content-Type": "application/json" } });

  if (req.method !== "POST") return json({ erro: "Use POST" }, 405);

  try {
    const quem = await quemChama(req);
    if ("erro" in quem) return json({ erro: quem.erro }, quem.status);

    const corpo = await req.json().catch(() => ({}));
    const acao = String(corpo.acao ?? "listar");
    const alvo = String(corpo.email ?? "").trim().toLowerCase();

    // Listar é permitido a qualquer autorizado: a pessoa precisa ver com quem divide
    // o sistema, e a RLS da tabela já libera a leitura para a equipe.
    if (acao === "listar") {
      const autorizados = await sb("/rest/v1/authorized_users?select=email,name,role,created_at&order=email");
      const contas = await contasDoAuth();
      const porEmail = new Map(contas.map((c) => [String(c.email ?? "").toLowerCase(), c]));
      const lista = (autorizados || []).map((a: any) => {
        const c = porEmail.get(String(a.email).toLowerCase());
        return {
          email: a.email,
          nome: a.name,
          papel: a.role,
          autorizado_em: a.created_at,
          tem_conta: Boolean(c),
          ultimo_acesso: c?.last_sign_in_at ?? null,
          conta_criada_em: c?.created_at ?? null,
        };
      });
      // Conta no Auth sem linha de autorização é inconsistência que vale mostrar.
      const orfas = contas
        .filter((c) => !(autorizados || []).some((a: any) => String(a.email).toLowerCase() === String(c.email ?? "").toLowerCase()))
        .map((c) => ({ email: c.email, ultimo_acesso: c.last_sign_in_at ?? null }));
      return json({ ok: true, eu: { email: quem.email, papel: quem.papel }, usuarios: lista, contas_sem_autorizacao: orfas });
    }

    // As demais ações mexem em acesso: só admin.
    if (quem.papel !== "admin") {
      return json({ erro: "Só um administrador pode alterar usuários" }, 403);
    }
    if (!alvo || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(alvo)) {
      return json({ erro: "Informe um e-mail válido" }, 400);
    }

    const autorizados = await sb("/rest/v1/authorized_users?select=email,name,role");
    const admins = (autorizados || []).filter((a: any) => a.role === "admin");
    const jaExiste = (autorizados || []).find((a: any) => String(a.email).toLowerCase() === alvo);

    if (acao === "adicionar") {
      const nome = String(corpo.nome ?? "").trim();
      const papel = PAPEIS.includes(String(corpo.papel)) ? String(corpo.papel) : "user";
      if (!nome) return json({ erro: "Informe o nome da pessoa" }, 400);

      if (!jaExiste) {
        await sb("/rest/v1/authorized_users", {
          method: "POST",
          headers: { Prefer: "return=minimal" },
          body: JSON.stringify({ email: alvo, name: nome, role: papel }),
        });
      }

      const contas = await contasDoAuth();
      const conta = contas.find((c) => String(c.email ?? "").toLowerCase() === alvo);
      if (conta) {
        return json({
          ok: true,
          email: alvo,
          autorizado: true,
          conta_criada: false,
          aviso: jaExiste
            ? "Esta pessoa já estava autorizada e já tem conta. Nada foi alterado."
            : "A pessoa foi autorizada agora, mas já existia conta com este e-mail. A senha antiga continua valendo.",
        });
      }

      const senha = senhaTemporaria();
      const r = await fetch(`${URL_BASE}/auth/v1/admin/users`, {
        method: "POST",
        headers: cab,
        body: JSON.stringify({ email: alvo, password: senha, email_confirm: true }),
      });
      const criada = await r.json();
      if (!r.ok || !criada?.id) {
        return json({
          erro: `Autorizado, mas a conta não foi criada: ${criada?.message ?? r.status}`,
          autorizado: true, conta_criada: false,
        }, 502);
      }
      // Manda o convite por e-mail. A senha temporária continua voltando como rede de
      // segurança: se o e-mail falhar, o admin ainda tem como dar o acesso na hora.
      const convite = await enviarConvite(alvo, nome, quem.nome || quem.email);
      return json({
        ok: true, email: alvo, nome, papel,
        autorizado: true, conta_criada: true,
        senha_temporaria: senha,
        convite_enviado: convite.enviado,
        convite_erro: convite.enviado ? undefined : convite.erro,
        aviso: convite.enviado
          ? `Convite enviado para ${alvo}: a pessoa define a própria senha pelo link. A senha temporária abaixo é reserva, caso o e-mail não chegue.`
          : `O e-mail de convite NÃO saiu (${convite.erro}). Passe a senha temporária abaixo por um canal seguro.`,
      });
    }

    if (acao === "editar") {
      if (!jaExiste) return json({ erro: "Este e-mail não está na lista" }, 404);
      const nome = String(corpo.nome ?? "").trim();
      const papel = String(corpo.papel ?? jaExiste.role);
      if (!nome) return json({ erro: "Informe o nome da pessoa" }, 400);
      if (!PAPEIS.includes(papel)) return json({ erro: "Papel inválido" }, 400);
      // Mesmas travas da ação `papel`: ninguém muda o próprio papel, e o último
      // administrador não pode ser rebaixado — senão o sistema fica sem quem gerencia.
      if (papel !== jaExiste.role) {
        if (alvo === quem.email) return json({ erro: "Você não pode mudar o seu próprio papel" }, 400);
        if (jaExiste.role === "admin" && papel !== "admin" && admins.length <= 1) {
          return json({ erro: "Este é o único administrador: promova outra pessoa antes de rebaixá-lo" }, 400);
        }
      }
      await sb(`/rest/v1/authorized_users?email=eq.${encodeURIComponent(jaExiste.email)}`, {
        method: "PATCH",
        headers: { Prefer: "return=minimal" },
        body: JSON.stringify({ name: nome, role: papel }),
      });
      return json({ ok: true, email: alvo, nome, papel });
    }

    if (acao === "convite") {
      if (!jaExiste) return json({ erro: "Este e-mail não está na lista" }, 404);
      const contas = await contasDoAuth();
      if (!contas.find((c) => String(c.email ?? "").toLowerCase() === alvo)) {
        return json({ erro: "Esta pessoa ainda não tem conta criada" }, 404);
      }
      const c = await enviarConvite(alvo, jaExiste.name ?? "", quem.nome || quem.email);
      if (!c.enviado) return json({ erro: `O e-mail não saiu: ${c.erro}` }, 502);
      return json({ ok: true, email: alvo, convite_enviado: true,
        aviso: `Convite reenviado para ${alvo}. O link vale 1 hora.` });
    }

    if (acao === "senha") {
      // Redefinir a senha de outra pessoa: o caso real é "esqueci e não recebo o
      // e-mail". Devolve a nova senha UMA vez, como no cadastro.
      if (!jaExiste) return json({ erro: "Este e-mail não está na lista" }, 404);
      const contas = await contasDoAuth();
      const conta = contas.find((c) => String(c.email ?? "").toLowerCase() === alvo);
      if (!conta) return json({ erro: "Esta pessoa ainda não tem conta criada" }, 404);
      const senha = senhaTemporaria();
      const r = await fetch(`${URL_BASE}/auth/v1/admin/users/${conta.id}`, {
        method: "PUT",
        headers: cab,
        body: JSON.stringify({ password: senha }),
      });
      if (!r.ok) {
        const e = await r.json().catch(() => ({}));
        return json({ erro: `Não foi possível trocar a senha: ${e?.message ?? r.status}` }, 502);
      }
      return json({
        ok: true, email: alvo, senha_temporaria: senha,
        aviso: "Esta senha aparece UMA vez. Passe por um canal seguro e peça que troque no primeiro acesso.",
      });
    }

    if (acao === "papel") {
      const papel = String(corpo.papel ?? "");
      if (!PAPEIS.includes(papel)) return json({ erro: "Papel inválido" }, 400);
      if (!jaExiste) return json({ erro: "Este e-mail não está na lista" }, 404);
      if (alvo === quem.email) return json({ erro: "Você não pode mudar o seu próprio papel" }, 400);
      if (jaExiste.role === "admin" && papel !== "admin" && admins.length <= 1) {
        return json({ erro: "Este é o único administrador: promova outra pessoa antes de rebaixá-lo" }, 400);
      }
      await sb(`/rest/v1/authorized_users?email=eq.${encodeURIComponent(jaExiste.email)}`, {
        method: "PATCH",
        headers: { Prefer: "return=minimal" },
        body: JSON.stringify({ role: papel }),
      });
      return json({ ok: true, email: alvo, papel });
    }

    if (acao === "remover") {
      if (alvo === quem.email) return json({ erro: "Você não pode remover o seu próprio acesso" }, 400);
      if (jaExiste?.role === "admin" && admins.length <= 1) {
        return json({ erro: "Este é o único administrador: promova outra pessoa antes de removê-lo" }, 400);
      }
      const contas = await contasDoAuth();
      const conta = contas.find((c) => String(c.email ?? "").toLowerCase() === alvo);
      if (conta) {
        await fetch(`${URL_BASE}/auth/v1/admin/users/${conta.id}`, { method: "DELETE", headers: cab });
      }
      if (jaExiste) {
        await sb(`/rest/v1/authorized_users?email=eq.${encodeURIComponent(jaExiste.email)}`, {
          method: "DELETE",
          headers: { Prefer: "return=minimal" },
        });
      }
      return json({ ok: true, email: alvo, conta_apagada: Boolean(conta), autorizacao_removida: Boolean(jaExiste) });
    }

    return json({ erro: `Ação desconhecida: ${acao}` }, 400);
  } catch (e) {
    return json({ erro: (e as Error).message }, 500);
  }
});
