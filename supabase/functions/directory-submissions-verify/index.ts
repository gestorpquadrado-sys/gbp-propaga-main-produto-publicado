// Confere se a submissão a um diretório realmente saiu no ar.
//
// Porte fiel do nó Code do workflow n8n `p2-directory-submissions-verify`
// (263 linhas), cron `0 4 * * 2,5`. Mesma ordem de tentativa, mesmo casamento de
// nome/telefone/cidade, mesma classificação, mesmas duas tabelas.
//
// A service_role NÃO fica mais no código (no n8n estava em texto puro dentro do nó):
// vem de SUPABASE_SERVICE_ROLE_KEY, injetada pelo Supabase.
//
// Como ele decide qual URL conferir, em ordem:
//   1. `profile_url` da submissão, se alguém já anotou
//   2. `verification_url_template` do canal
//   3. `search_url_template` do canal
//   4. último recurso: busca no Bing por  site:dominio "nome" "cidade"
//
// Uso:
//   GET /directory-submissions-verify?limit=100
//   GET /directory-submissions-verify?sync_id=...
//   GET /directory-submissions-verify?location_id=...
// Sem sync_id nem location_id, pega só as pendentes
// (not_checked, pending_review, manual_check_required, error).

const URL_BASE = Deno.env.get("SUPABASE_URL")!;
const CHAVE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SERPER = Deno.env.get("SERPER_API_KEY") ?? "";
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

const enc = (v: unknown) => encodeURIComponent(String(v ?? ""));
const soDigitos = (v: unknown) => String(v || "").replace(/\D/g, "");

// Tira acento e baixa a caixa nos dois lados da comparação: "Café Açaí" casa com
// "cafe acai" no HTML. Sem isso metade dos nomes brasileiros nunca casaria.
const limpar = (v: unknown) =>
  String(v || "").normalize("NFD").replace(/[̀-ͯ]/g, "")
    .toLowerCase().replace(/\s+/g, " ").trim();

function normalizar(url: unknown): string | null {
  if (!url) return null;
  const cru = String(url).trim();
  if (!cru) return null;
  return /^https?:\/\//i.test(cru) ? cru : `https://${cru}`;
}

function dominioDe(url: unknown): string | null {
  if (!url) return null;
  try {
    return new URL(normalizar(url)!).hostname.replace(/^www\./, "");
  } catch {
    return String(url).replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0] || null;
  }
}

type Negocio = { name: string; phone: string; city: string; state: string; zip: string };

function aplicarTemplate(tpl: string | null, d: Negocio): string | null {
  if (!tpl) return null;
  const subs: Record<string, string> = {
    name: d.name || "",
    business_name: d.name || "",
    city: d.city || "",
    state: d.state || "",
    phone: soDigitos(d.phone),
    zip: soDigitos(d.zip),
    q: [d.name, d.city, d.state].filter(Boolean).join(" "),
  };
  let out = String(tpl);
  for (const [k, v] of Object.entries(subs)) {
    const e = encodeURIComponent(v);
    out = out.split(`{${k}}`).join(e).split(`{{${k}}}`).join(e);
  }
  return normalizar(out);
}

function buscaDeUltimoRecurso(canal: any, n: Negocio): string | null {
  const dom = dominioDe(canal?.website_url || canal?.form_url || "");
  if (!dom || !n.name) return null;
  const q = `site:${dom} "${n.name}" "${n.city || ""}"`;
  return `https://www.bing.com/search?q=${encodeURIComponent(q)}`;
}

function talvezJson(v: unknown): any {
  if (!v) return {};
  if (typeof v === "object") return v;
  try { return JSON.parse(String(v)); } catch { return {}; }
}

async function sb(caminho: string, opcoes: RequestInit = {}) {
  const r = await fetch(`${URL_BASE}${caminho}`, { ...opcoes, headers: { ...cab, ...(opcoes.headers || {}) } });
  const t = await r.text();
  if (!r.ok) throw new Error(`Supabase ${r.status}: ${t.slice(0, 300)}`);
  return t ? JSON.parse(t) : null;
}
async function umSo(caminho: string) {
  const rows = await sb(caminho);
  return Array.isArray(rows) && rows.length ? rows[0] : null;
}

async function pegarHtml(url: string) {
  const inicio = Date.now();
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), 20000);
  try {
    const r = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; P2LocalListingsVerifier/1.1; +https://pquadrado.com.br)",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
      redirect: "follow",
      signal: ctl.signal,
    });
    const corpo = await r.text();
    return { statusCode: r.status, body: corpo, durationMs: Date.now() - inicio };
  } finally { clearTimeout(t); }
}

// Quem pode chamar: o cron, uma chamada interna, ou pessoa da equipe.
// Esta era a última das três funções de diretórios ainda ABERTA, e é a que mais
// custa: cada verificação gasta crédito do Serper (chave compartilhada com o radar
// do CRM), então qualquer um na internet podia zerar o saldo chamando em laço.
// O cron chama com um token próprio do vault, não com a service_role — ver
// directory-channels-check e directory-discovery, que usam exatamente esta guarda.
async function podeChamar(req: Request): Promise<{ ok: true } | { ok: false; erro: string; status: number }> {
  const jwt = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
  if (!jwt) return { ok: false, erro: "Falta o token de quem está chamando", status: 401 };
  if (jwt === CHAVE) return { ok: true };            // chamada interna
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
    const syncId = u.searchParams.get("sync_id") || u.searchParams.get("syncId");
    const locationId = u.searchParams.get("location_id") || u.searchParams.get("locationId");
    const limite = Math.min(Number(u.searchParams.get("limit") || 100), 200);

    // A ordenação é o que faz a fila ANDAR, e aqui estava um laço que se autoalimentava:
    // era `order=updated_at.desc`, e como a função grava `updated_at` em cada
    // verificação, as linhas que ela acabava de conferir viravam as mais recentes e
    // voltavam para o início na rodada seguinte. Resultado medido em 30/10/2026: em dois
    // meses rodando 2x por semana, as mesmas 109 submissões foram reverificadas (algumas
    // 32 vezes) e **202 nunca foram tocadas**.
    //
    // `verified_at.asc.nullsfirst` resolve: primeiro quem nunca foi verificada, depois a
    // mais esquecida. A fila drena em vez de girar em falso.
    let filtro = "select=*";
    if (syncId) filtro += `&sync_id=eq.${enc(syncId)}`;
    if (locationId) filtro += `&location_id=eq.${enc(locationId)}`;
    if (!syncId && !locationId) {
      // Respeita `next_verification_at`: sem isto, o cron reconferia antes da hora e a
      // escada de 30/90 dias não servia para nada — e cada reconferência gasta 1 crédito
      // do Serper. `or=` para incluir quem nunca foi verificada (campo nulo).
      const agora = new Date().toISOString();
      filtro += `&verification_status=in.(not_checked,pending_review,error)` +
        `&or=(next_verification_at.is.null,next_verification_at.lte.${agora})` +
        // Preenchida à mão vem PRIMEIRO: é a que tem chance real de ter publicado.
        // Depois, quem nunca foi verificada, depois a mais esquecida.
        `&order=filled_at.desc.nullslast,verified_at.asc.nullsfirst&limit=${limite}`;
    } else {
      // Consulta dirigida (uma sincronização ou uma ficha): aí a ordem natural é a mais
      // recente primeiro, que é o que a tela espera mostrar.
      filtro += `&order=updated_at.desc&limit=${limite}`;
    }

    const subs = await sb(`/rest/v1/directory_submissions?${filtro}`);
    // Busca pelo Serper (API do Google), que devolve os links em JSON.
    //
    // Por que não raspar o Bing, como era antes: medido em 30/10/2026, a página que o
    // Bing entrega a cliente automatizado **não tem resultado orgânico nenhum** — nem
    // para buscas que obrigatoriamente têm, como `site:doctoralia.com.br dentista
    // campinas`. O teste antigo só olhava se o nome aparecia no HTML, e o nome está na
    // própria consulta: dava "encontrado" para tudo. Eram 132 falsos positivos.
    //
    // Custa 1 crédito por verificação, e a chave é compartilhada com o radar do CRM —
    // é por isso que o cron é mensal e pula canal morto.
    const buscarNoDiretorio = async (site: string, negocio: Negocio): Promise<
      { link: string | null; resultados: number; erro: string | null }
    > => {
      if (!SERPER) return { link: null, resultados: 0, erro: "SERPER_API_KEY não configurada" };
      const host = (site || "").replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0];
      if (!host) return { link: null, resultados: 0, erro: "canal sem website_url" };
      const termos = [negocio.name, negocio.city].filter(Boolean).join(" ");
      if (!termos.trim()) return { link: null, resultados: 0, erro: "empresa sem nome nem cidade" };
      try {
        const r = await fetch("https://google.serper.dev/search", {
          method: "POST",
          headers: { "X-API-KEY": SERPER, "Content-Type": "application/json" },
          body: JSON.stringify({ q: `site:${host} ${termos}`, gl: "br", hl: "pt-br", num: 10 }),
        });
        if (!r.ok) return { link: null, resultados: 0, erro: `Serper ${r.status}` };
        const d = await r.json();
        const org = (d.organic ?? []) as Array<{ link?: string; title?: string; snippet?: string }>;

        // Não basta o link ser do domínio do diretório: tem de ser DESTA empresa.
        //
        // Sem esta checagem, o Yelp (que não tem o Piassa Restaurante) devolvia
        // `m.yelp.com/biz/churrasqueira-guerreiro-portimao` — um restaurante em Portugal —
        // e o sistema amarraria esse perfil no cliente. Perfil errado é pior que nenhum.
        //
        // A prova é uma palavra DISTINTIVA do nome aparecendo no título, no resumo ou na
        // própria URL. Palavra de categoria não conta: "restaurante" casaria com qualquer
        // ficha de restaurante do mundo.
        const CATEGORIA = [
          "restaurante", "lanchonete", "pizzaria", "bar", "cafe", "padaria", "mercado",
          "supermercado", "loja", "imobiliaria", "imoveis", "clinica", "consultorio",
          "advogados", "advocacia", "sociedade", "academia", "hotel", "pousada",
          "ltda", "eireli", "comercio", "servicos", "empresa", "grupo", "centro",
          "sao", "santo", "santa", "dos", "das", "and", "the",
          "laboratorio", "tecnologia", "solucoes", "industria", "equipamentos",
          "distribuidora", "transportadora", "construtora", "incorporadora",
          "seguros", "corretora", "contabilidade", "consultoria", "assessoria",
          "estofados", "tapecaria", "calcados", "moda", "masculina", "feminina",
        ];
        const semAcento = (t: string) =>
          t.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
        const palavras = semAcento(negocio.name)
          .replace(/[^a-z0-9]+/g, " ")
          .split(" ")
          .filter((w) => w.length >= 4 && !CATEGORIA.includes(w));
        // A PRIMEIRA palavra é quase sempre a marca ("Piassa", "Labitec", "Mercotech").
        // Exigir a marca, ou duas palavras do nome, ou o telefone.
        //
        // Sem isso o Yelp devolvia, para a "Labitec Laboratorio De Tecnologia", uma
        // página de busca de "Mobile Phones" em Tijucas-SC: casava só por "tecnologia",
        // que é genérica. Marca identifica; categoria não.
        const marca = palavras[0] ?? "";
        const distintivas = palavras;
        const foneFinal = (negocio.phone || "").replace(/\D/g, "").slice(-8);

        for (const o of org) {
          try {
            const u = new URL(o.link ?? "");
            const h = u.hostname.replace(/^www\./, "");
            if (!(h === host || h.endsWith("." + host))) continue;
            if (!u.pathname || u.pathname === "/") continue;   // home não prova ficha

            // Página de BUSCA ou de categoria do diretório não é ficha de empresa.
            const caminho = semAcento(u.pathname + " " + u.search);
            if (/(search|busca|buscar|find|pesquisa|categoria|category|lista|listing|result)/.test(caminho)) continue;
            // marketplace de serviço expõe página de CATEGORIA por cidade, que parece
            // ficha: /reformas-e-reparos/serralheria-e-solda/serralheria/sp/sao-carlos.
            // Ficha de empresa não tem a UF como penúltimo segmento.
            if (/\/(a[cplm]|ba|ce|df|es|go|m[agst]|p[abeir]|r[jnors]|s[cep]|to)\/[a-z0-9-]+\/?$/.test(caminho.trim())) continue;
            if (/[?&](find_desc|find_loc|q|query|search|termo)=/i.test(u.search)) continue;

            const texto = semAcento(`${o.title ?? ""} ${o.snippet ?? ""} ${u.pathname}`);
            const digitos = (`${o.title ?? ""} ${o.snippet ?? ""}`).replace(/\D/g, "");
            const quantasCasam = distintivas.filter((w) => texto.includes(w)).length;
            const casaMarca = marca.length >= 4 && texto.includes(marca);
            const casaFone = foneFinal.length >= 8 && digitos.includes(foneFinal);
            if (!casaMarca && quantasCasam < 2 && !casaFone) continue;

            // A CIDADE tem de bater quando o resultado menciona lugar. Sem isto, a
            // "Casa Nossa Materiais para Construção" de São Carlos casou com
            // `waze.com/.../br/ce/materiais-de-construcao-casa-and-ci` — outra empresa,
            // no Ceará, só porque "casa" e "construcao" apareciam. O telefone, quando
            // bate, dispensa a cidade: é prova mais forte.
            const cidade = semAcento(negocio.city || "").replace(/[^a-z0-9]+/g, " ").trim();
            const uf = (negocio.state || "").toLowerCase().slice(0, 2);
            if (!casaFone && cidade.length >= 4) {
              const cidadeSemEspaco = cidade.replace(/\s+/g, "");
              const textoSemEspaco = texto.replace(/[^a-z0-9]+/g, "");
              const temCidade = texto.includes(cidade) || textoSemEspaco.includes(cidadeSemEspaco);
              // outra UF escrita no caminho é contraprova: /br/ce/ para empresa de SP
              const outraUf = uf && new RegExp(`/(?!${uf})(a[cplm]|ba|ce|df|es|go|m[agst]|p[abeir]|r[jnors]|s[cep]|to)/`).test(caminho);
              if (!temCidade || outraUf) continue;
            }

            return { link: u.toString(), resultados: org.length, erro: null };
          } catch { /* link torto */ }
        }
        return { link: null, resultados: org.length, erro: null };
      } catch (e) {
        return { link: null, resultados: 0, erro: (e as Error).message };
      }
    };

    // Extrai, do HTML de uma página de BUSCA, o primeiro link que aponta para o
    // domínio do próprio diretório. É isso que prova que a ficha existe.
    //
    // Por que isto é necessário: antes bastava o nome da empresa aparecer no HTML — e a
    // página de resultados do Bing SEMPRE contém o nome, porque ele está na própria
    // consulta. O teste era tautológico e dava "encontrado" para tudo. Medido em
    // 30/10/2026: 119 de 132 "found_online" tinham como profile_url a própria URL de
    // busca, não a ficha.
    const linkNoDominio = (html: string, siteDoDiretorio: string): string | null => {
      const host = (siteDoDiretorio || "").replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0];
      if (!host) return null;
      const marca = host.split(".")[0];
      if (!marca || marca.length < 3) return null;
      for (const m of html.matchAll(/href="(https?:\/\/[^"]+)"/gi)) {
        const u = m[1];
        let h = "";
        try { h = new URL(u).hostname.replace(/^www\./, ""); } catch { continue; }
        // o buscador aparece em todo link da própria página; não conta
        if (/bing\.|google\.|duckduckgo\.|microsoft\.|msn\./i.test(h)) continue;
        if (h === host || h.endsWith("." + host) || h.split(".")[0] === marca) {
          // descarta a home e páginas de serviço: perfil tem caminho
          try {
            const caminho = new URL(u).pathname;
            if (caminho && caminho !== "/" && caminho.length > 1) return u;
          } catch { /* ignora */ }
        }
      }
      return null;
    };

    // Intervalo crescente em vez de reconferir sempre igual: diretório publica em dias
    // ou semanas, e insistir para sempre em quem nunca publicou só gasta crédito. Depois
    // da terceira tentativa a ficha vai para conferência humana e sai da fila.
    const proximaTentativa = (status: string, jaVerificadaAntes: string | null): string | null => {
      if (status === "found_online") return null;           // achou: não precisa mais
      const dias = jaVerificadaAntes ? 90 : 30;             // 1ª vez: 30d; depois: 90d
      return new Date(Date.now() + dias * 86400000).toISOString();
    };

    const resultados: any[] = [];

    for (const sub of subs || []) {
      const quando = new Date().toISOString();
      const codigo = sub.channel_code;
      let status = "manual_check_required";
      let mensagem = "Sem URL verificável configurada. Conferência manual recomendada.";
      let profileUrl = sub.profile_url || null;
      let urlConferida: string | null = null;
      let statusCode: number | null = null;
      let achouNome = false, achouFone = false, achouCidade = false;
      let fonte = "none";

      const canal = await umSo(`/rest/v1/directory_channels?code=eq.${enc(codigo)}&select=*`);
      const empresa = sub.company_id ? await umSo(`/rest/v1/companies?id=eq.${enc(sub.company_id)}&select=*`) : null;
      const local = sub.location_id ? await umSo(`/rest/v1/google_locations?id=eq.${enc(sub.location_id)}&select=*`) : null;
      // Canal desligado ou com caixa provada morta nunca publicou nada: verificar é
      // queimar crédito do Serper à toa. Em 30/10/2026 eram 127 das 310 submissões.
      const CAIXA_MORTA = ["bounce", "sem_mx", "null_mx", "nao_existe"];
      if (canal && (canal.is_active === false || CAIXA_MORTA.includes(canal.email_status))) {
        await sb(`/rest/v1/directory_submissions?id=eq.${enc(sub.id)}`, {
          method: "PATCH",
          body: JSON.stringify({
            verification_status: "manual_check_required",
            verification_message: canal.is_active === false
              ? `Canal ${codigo} está desligado: nada foi publicado, não há o que verificar.`
              : `Canal ${codigo} tem a caixa de cadastro morta (${canal.email_status}): o pedido nunca chegou ao diretório.`,
            verified_at: quando,
            next_verification_at: null,
            updated_at: quando,
          }),
        });
        resultados.push({ channel: codigo, status: "manual_check_required", pulado: "canal morto" });
        continue;
      }

      const cru = talvezJson(sub.raw_response);
      const payload = cru.copyPayload || cru.copy_payload || cru.business || {};

      const n: Negocio = {
        name: empresa?.name || local?.name || payload["Nome da empresa"] || payload.name || cru.name || "",
        phone: empresa?.phone || local?.phone_primary || payload.Telefone || payload.phone || cru.phone_primary || cru.phone || "",
        city: empresa?.city || local?.address_city || payload.Cidade || payload.city || cru.address_city || cru.city || "",
        state: empresa?.state || local?.address_state || payload.Estado || payload.state || cru.address_state || cru.state || "",
        zip: empresa?.postal_code || local?.address_postal_code || payload.CEP || payload.zip || cru.address_zip || cru.zip || "",
      };

      if (profileUrl) {
        urlConferida = normalizar(profileUrl); fonte = "profile_url";
      } else if (canal?.verification_url_template) {
        urlConferida = aplicarTemplate(canal.verification_url_template, n); fonte = "verification_url_template";
      } else if (canal?.search_url_template) {
        urlConferida = aplicarTemplate(canal.search_url_template, n); fonte = "search_url_template";
      } else {
        urlConferida = buscaDeUltimoRecurso(canal, n);
        fonte = urlConferida ? "fallback_domain_search" : "none";
      }

      if (urlConferida) {
        try {
          const pag = await pegarHtml(urlConferida);
          statusCode = pag.statusCode;
          const html = limpar(pag.body);
          const nome = limpar(n.name);
          const cidade = limpar(n.city);
          const fone = soDigitos(n.phone);
          const digitosHtml = soDigitos(pag.body);

          achouNome = nome ? html.includes(nome) : false;
          achouCidade = cidade ? html.includes(cidade) : false;
          // só os 8 últimos dígitos: o DDD e o 9º dígito variam de formato em cada site
          achouFone = fone && fone.length >= 8 ? digitosHtml.includes(fone.slice(-8)) : false;

          const ok2xx = pag.statusCode >= 200 && pag.statusCode < 400;
          const porBusca = fonte.includes("search") || fonte.includes("fallback");

          if (ok2xx && porBusca) {
            // Fonte é busca: o nome aparecer no HTML não prova nada (está na consulta).
            // Só vale link de resultado apontando PARA DENTRO do diretório — e isso vem
            // do Serper, porque o HTML do buscador não entrega resultado a robô.
            const viaApi = await buscarNoDiretorio(canal?.website_url || "", n);
            const achado = viaApi.link ?? linkNoDominio(pag.body, canal?.website_url || "");
            if (achado) {
              status = "found_online";
              mensagem = "Ficha encontrada no diretório pela busca pública.";
              profileUrl = achado;
              urlConferida = achado;
            } else {
              status = "pending_review";
              mensagem = viaApi.erro
                ? `Não foi possível verificar agora: ${viaApi.erro}.`
                : `A busca no Google devolveu ${viaApi.resultados} resultado(s) do diretório e ` +
                  "nenhum é desta empresa. Ou a ficha ainda não foi publicada, ou o diretório não é indexado.";
            }
          } else if (ok2xx && (achouNome || achouFone) && (achouCidade || achouFone || fonte.includes("profile"))) {
            // Fonte é a própria URL do perfil: aí conferir o texto faz sentido.
            status = "found_online";
            mensagem = "Perfil com dados compatíveis confirmado online.";
            profileUrl = profileUrl || urlConferida;
          } else if ([401, 403, 429].includes(pag.statusCode)) {
            status = "manual_check_required";
            mensagem = `Diretório/busca bloqueou verificação automática ou exige login/captcha. HTTP ${pag.statusCode}.`;
          } else if ([404, 410].includes(pag.statusCode)) {
            status = "not_found";
            mensagem = `URL verificada não existe ou foi removida. HTTP ${pag.statusCode}.`;
          } else if (ok2xx) {
            status = "not_found";
            mensagem = "Busca/URL acessível, mas não encontrou nome/telefone/cidade compatíveis.";
          } else {
            status = "manual_check_required";
            mensagem = `Resposta HTTP ${pag.statusCode}. Conferir manualmente.`;
          }
        } catch (e) {
          status = "error";
          mensagem = (e as Error).message || "Erro ao verificar URL.";
        }
      }

      await sb(`/rest/v1/directory_submissions?id=eq.${enc(sub.id)}`, {
        method: "PATCH",
        body: JSON.stringify({
          verification_status: status,
          verification_message: mensagem,
          verified_at: quando,
          profile_url: profileUrl,
          next_verification_at: proximaTentativa(status, sub.verified_at),
          updated_at: quando,
        }),
      });

      await sb("/rest/v1/directory_submission_verification_logs", {
        method: "POST",
        body: JSON.stringify({
          submission_id: sub.id,
          sync_id: sub.sync_id,
          channel_code: codigo,
          checked_url: urlConferida,
          status,
          status_code: statusCode,
          found_name: achouNome,
          found_phone: achouFone,
          found_city: achouCidade,
          profile_url: profileUrl,
          message: mensagem,
          raw_response: {
            business: n,
            channel: canal || {},
            verification_source: fonte,
            previous_status: sub.verification_status || null,
            origem: "edge-function",
          },
          checked_at: quando,
        }),
      });

      resultados.push({
        channel: codigo, status, message: mensagem, checkedUrl: urlConferida,
        profileUrl, statusCode, foundName: achouNome, foundPhone: achouFone,
        foundCity: achouCidade, verificationSource: fonte,
      });
    }

    const conta = (s: string) => resultados.filter((r) => r.status === s).length;
    return json({
      success: true,
      sync_id: syncId, location_id: locationId,
      checked: resultados.length,
      found_online: conta("found_online"),
      manual_check_required: conta("manual_check_required"),
      not_found: conta("not_found"),
      data_mismatch: conta("data_mismatch"),
      error: conta("error"),
      timestamp: new Date().toISOString(),
      results: resultados,
    });
  } catch (e) {
    return json({ success: false, error: (e as Error).message }, 500);
  }
});
