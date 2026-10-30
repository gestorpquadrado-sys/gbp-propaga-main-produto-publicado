// Confere se cada diretório ainda existe, e marca os que morreram.
//
// Portado do nó Code do workflow n8n `p2-directory-channels-health-check-agendado`
// (173 linhas), que rodava na VPS com cron `0 3 * * 1`. Mesma classificação, mesmas
// tabelas, mesma resposta. Duas diferenças, as duas a favor:
//
//  1. A service_role NÃO fica mais no código. No n8n ela estava colada em texto puro
//     dentro do nó — quem tivesse acesso ao editor, ou a um export do JSON, lia o banco
//     inteiro. Aqui vem de SUPABASE_SERVICE_ROLE_KEY, que o Supabase injeta sozinho.
//  2. Não depende de `this.helpers.httpRequest` do n8n: é `fetch` puro.
//
// Uso:
//   GET  /directory-channels-check?limit=50&mode=safe
//   mode=safe (padrão) não desativa diretório por 403/500/timeout — só por 404/410.
//   mode=strict também desativa em 5xx.

const URL_BASE = Deno.env.get("SUPABASE_URL")!;
const CHAVE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const CRON_TOKEN = Deno.env.get("CRON_TOKEN") ?? "";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const cab = {
  apikey: CHAVE,
  Authorization: `Bearer ${CHAVE}`,
  "Content-Type": "application/json",
  Accept: "application/json",
  Prefer: "return=representation",
};

function normalizar(url: string | null): string | null {
  if (!url) return null;
  const cru = String(url).trim();
  if (!cru) return null;
  return /^https?:\/\//i.test(cru) ? cru : `https://${cru}`;
}

// Estados de CAIXA que são prova de que o e-mail de cadastro não chega. O site estar
// no ar não desfaz nenhum deles: o diretório pode viver anos com a caixa morta — foi
// exatamente o que aconteceu em 29/10/2026, quando 10 dos 15 envios reais voltaram
// como hard bounce de domínios cujo site respondia 200.
const CAIXA_MORTA = ["bounce", "nao_existe", "sem_mx", "null_mx"];

// MX por DNS-over-HTTPS: o Edge Runtime não expõe resolvedor de DNS, e fetch resolve.
// Devolve "null_mx" quando o domínio declara formalmente que não recebe e-mail
// (registro MX "0 .", RFC 7505), "sem_mx" quando não há MX nenhum, e "ok" quando há.
async function olharMx(email: string | null): Promise<"ok" | "sem_mx" | "null_mx" | null> {
  const dom = String(email || "").split("@")[1];
  if (!dom) return null;
  try {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), 8000);
    const r = await fetch(
      `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(dom)}&type=MX`,
      { headers: { Accept: "application/dns-json" }, signal: ctl.signal },
    );
    clearTimeout(t);
    if (!r.ok) return null;
    const j = await r.json();
    const mx = (j.Answer || []).filter((a: any) => a.type === 15);
    if (mx.length === 0) return "sem_mx";
    // "0 ." é o null MX. O campo data vem como "<prioridade> <host>".
    const alvos = mx.map((a: any) => String(a.data || "").trim().split(/\s+/).pop());
    if (alvos.every((h: string) => h === "." || h === "")) return "null_mx";
    return "ok";
  } catch {
    return null;   // indecidível: não mexe no que já está gravado
  }
}

type Veredito = { status: string; ativo: boolean; mensagem: string };

// Mesma tabela de decisão do n8n. O ponto central: SÓ 404/410 mata um diretório.
// 403 e 429 são diretório vivo que não gosta de robô; 5xx é instabilidade do momento.
// Desativar por esses seria apagar diretório bom da lista.
function classificar(http: number | null, erro: string | null, modo: string): Veredito {
  if (erro) return { status: "warning", ativo: true, mensagem: erro };
  if (http === 404 || http === 410) {
    return { status: "inactive", ativo: false, mensagem: `HTTP ${http}: página não encontrada/removida` };
  }
  if (http !== null && http >= 200 && http < 400) {
    return { status: "active", ativo: true, mensagem: `HTTP ${http}: ativo` };
  }
  if (http !== null && [401, 403, 405, 429].includes(http)) {
    return { status: "warning", ativo: true, mensagem: `HTTP ${http}: exige login, bloqueia HEAD ou limita acesso` };
  }
  if (http !== null && http >= 500) {
    const estrito = modo === "strict";
    return { status: estrito ? "inactive" : "warning", ativo: !estrito, mensagem: `HTTP ${http}: instável no momento` };
  }
  return { status: "warning", ativo: true, mensagem: `HTTP ${http}: verificar manualmente` };
}

async function sb(caminho: string, opcoes: RequestInit = {}) {
  const r = await fetch(`${URL_BASE}${caminho}`, { ...opcoes, headers: { ...cab, ...(opcoes.headers || {}) } });
  const texto = await r.text();
  if (!r.ok) throw new Error(`Supabase ${r.status}: ${texto.slice(0, 300)}`);
  return texto ? JSON.parse(texto) : null;
}

// HEAD primeiro, porque é barato. Mas muito diretório responde 405 ou 403 a HEAD e
// 200 a GET — nesses casos tenta de novo com GET antes de julgar.
async function bater(url: string | null) {
  const alvo = normalizar(url);
  if (!alvo) return { http: null, erro: "URL ausente", ms: null };
  const inicio = Date.now();
  for (const metodo of ["HEAD", "GET"]) {
    try {
      const ctl = new AbortController();
      const t = setTimeout(() => ctl.abort(), 12000);
      const r = await fetch(alvo, { method: metodo, redirect: "follow", signal: ctl.signal });
      clearTimeout(t);
      if (metodo === "HEAD" && [403, 405].includes(r.status)) continue;
      return { http: r.status, erro: null, ms: Date.now() - inicio };
    } catch (e) {
      if (metodo === "GET") {
        return { http: null, erro: (e as Error).message || "Falha ao acessar URL", ms: null };
      }
    }
  }
  return { http: null, erro: "Falha ao acessar URL", ms: null };
}

// Quem pode chamar: o cron (que usa a chave de serviço) ou pessoa da equipe.
// Antes isto era aberto, e passou a importar quando a tela de Configurações ganhou
// um botão que GASTA crédito do Serper — chave compartilhada com o radar do CRM.
// O cron precisa continuar passando, então a chave de serviço é aceita de propósito.
async function podeChamar(req: Request): Promise<{ ok: true } | { ok: false; erro: string; status: number }> {
  const jwt = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
  if (!jwt) return { ok: false, erro: "Falta o token de quem está chamando", status: 401 };
  if (jwt === CHAVE) return { ok: true };            // chamada interna
  // Os crons deste projeto chamam com net.http_get e NÃO mandavam header nenhum —
  // funcionava porque não havia trava. Em vez de embutir a service_role no comando do
  // cron (que fica legível em cron.job para quem lê o banco), eles passam um token
  // próprio, guardado no vault, que não dá acesso a nada além de disparar a função.
  if (CRON_TOKEN && jwt === CRON_TOKEN) return { ok: true };
  try {
    const r = await fetch(`${URL_BASE}/auth/v1/user`, {
      headers: { apikey: CHAVE, Authorization: `Bearer ${jwt}` },
    });
    if (!r.ok) return { ok: false, erro: "Sessão inválida ou expirada", status: 401 };
    const u = await r.json();
    const email = String(u?.email ?? "").toLowerCase();
    if (!email) return { ok: false, erro: "Sessão sem e-mail", status: 401 };
    const lr = await fetch(
      `${URL_BASE}/rest/v1/authorized_users?select=email&email=ilike.${encodeURIComponent(email)}`,
      { headers: { apikey: CHAVE, Authorization: `Bearer ${CHAVE}` } },
    );
    const linhas = await lr.json();
    if (!Array.isArray(linhas) || linhas.length === 0) {
      return { ok: false, erro: "Seu e-mail não está autorizado neste sistema", status: 403 };
    }
    return { ok: true };
  } catch {
    return { ok: false, erro: "Não foi possível validar a sessão", status: 401 };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  const json = (b: unknown, s = 200) =>
    new Response(JSON.stringify(b), { status: s, headers: { ...CORS, "Content-Type": "application/json" } });

  const permitido = await podeChamar(req);
  if (!permitido.ok) return json({ success: false, error: permitido.erro }, permitido.status);

  try {
    const u = new URL(req.url);
    const limite = Number(u.searchParams.get("limit") || 50);
    const modo = String(u.searchParams.get("mode") || "safe");

    const canais = await sb(
      `/rest/v1/directory_channels?select=id,code,name,website_url,is_active,submission_type,email_to,email_status` +
      `&website_url=not.is.null` +
      // DESVIO DELIBERADO do n8n, que ordenava por priority.asc: lá o lote era 50 e
      // pegava os 36 de uma vez. Aqui o lote é menor (limite de tempo da Edge
      // Function), e por priority o cron conferiria sempre os mesmos primeiros.
      // Pelos mais esquecidos, poucas rodadas cobrem todos.
      `&order=last_checked_at.asc.nullsfirst,priority.asc&limit=${limite}`,
    );

    const resultados: unknown[] = [];
    for (const c of canais || []) {
      const url = normalizar(c.website_url);
      const quando = new Date().toISOString();
      const check = await bater(url);
      const v = classificar(check.http, check.erro, modo);

      // A caixa é avaliada à parte do site, e tem poder de veto. Um canal de e-mail
      // com caixa provada morta NÃO volta a ativo só porque o site respondeu 200 —
      // reativá-lo manda e-mail para o vazio e queima a reputação do remetente, que
      // é compartilhado com o CRM.
      let caixa: string | null = c.email_status ?? null;
      if (String(c.submission_type || "").toLowerCase() === "email" && c.email_to) {
        const mx = await olharMx(c.email_to);
        if (mx === "sem_mx" || mx === "null_mx") {
          caixa = mx;                                    // prova nova de que não chega
        } else if (mx === "ok" && (caixa === "sem_mx" || caixa === "null_mx")) {
          caixa = "indeterminado";                       // voltou a ter MX: reavaliar
        }
        if (caixa !== (c.email_status ?? null)) {
          await sb(`/rest/v1/directory_channels?code=eq.${encodeURIComponent(c.code)}`, {
            method: "PATCH",
            body: JSON.stringify({
              email_status: caixa,
              email_checked_at: quando,
              email_evidence: mx === "sem_mx"
                ? `Dominio sem registro MX em ${quando}: nao recebe e-mail de ninguem.`
                : mx === "null_mx"
                ? `Null MX (registro MX "0 .") em ${quando}: o dominio declara que nao recebe e-mail (RFC 7505).`
                : `Dominio voltou a ter MX em ${quando}. Caixa nao verificada: so envio real decide.`,
            }),
          });
        }
      }
      const caixaMorta = caixa !== null && CAIXA_MORTA.includes(caixa);
      if (caixaMorta) {
        v.ativo = false;
        v.status = v.status === "active" ? "warning" : v.status;
        v.mensagem = `${v.mensagem} — porém a caixa de cadastro nao recebe (${caixa}), entao o canal segue inativo`;
      }

      await sb(`/rest/v1/directory_channels?code=eq.${encodeURIComponent(c.code)}`, {
        method: "PATCH",
        body: JSON.stringify({
          is_active: v.ativo,
          last_checked_at: quando,
          last_check_status: v.status,
          updated_at: quando,
        }),
      });

      await sb("/rest/v1/directory_channel_checks", {
        method: "POST",
        body: JSON.stringify({
          channel_id: c.id ?? null,
          channel_code: c.code,
          channel_name: c.name,
          website_url: c.website_url,
          checked_url: url,
          status: v.status,
          status_code: check.http,
          response_time_ms: check.ms,
          error_message: check.erro || v.mensagem,
          is_active_result: v.ativo,
          raw_response: {
            previous_is_active: c.is_active,
            submission_type: c.submission_type,
            email_to: c.email_to ?? null,
            email_status: caixa,
            caixa_morta: caixaMorta,
            message: v.mensagem,
            origem: "edge-function",
          },
          checked_at: quando,
        }),
      });

      resultados.push({
        code: c.code, name: c.name, url,
        httpStatus: check.http, status: v.status,
        isActive: v.ativo, message: v.mensagem, error: check.erro ?? null,
        emailStatus: caixa, caixaMorta,
      });
    }

    return json({
      success: true,
      checked: resultados.length,
      active: resultados.filter((r: any) => r.isActive).length,
      inactive: resultados.filter((r: any) => !r.isActive).length,
      timestamp: new Date().toISOString(),
      results: resultados,
    });
  } catch (e) {
    return json({ success: false, error: (e as Error).message }, 500);
  }
});
