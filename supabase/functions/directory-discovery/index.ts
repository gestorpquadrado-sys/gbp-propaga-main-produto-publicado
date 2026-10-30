// Descobre diretórios de busca que ainda NÃO estão na tabela, usando o Serper.
//
// Esta parte não existia: os workflows do n8n só conferiam os 36 canais já
// cadastrados. Quem some a gente detecta (o `directory-channels-check` marca
// 404/410 como inactive), mas quem nasce ninguém via.
//
// ## O CRITÉRIO (definido em 29/10/2026)
//
// Só entra aqui diretório que tem **perfil de empresa**: uma página por empresa,
// que as pessoas encontram quando buscam aquela empresa, e que mostra os dados de
// contato. É isso que o produto propaga.
//
// NÃO é diretório para este sistema, por mais que apareça na busca:
//   - marketplace e plataforma de pedido/reserva (o perfil existe para transacionar,
//     não para ser achado e contatado);
//   - marketplace de lead, onde a empresa paga por orçamento;
//   - fornecedor de software (PDV, ERP, site) — foi o caso do `saipos`, que estava
//     cadastrado como diretório e é fornecedor de PDV para restaurante;
//   - portal de notícia, blog, artigo "os 10 melhores X", comparador de preço;
//   - rede social, classificado de emprego, consulta de CNPJ.
//
// O sinal mais barato de "tem perfil de empresa" é a FORMA DA URL que aparece na
// busca: diretório de perfil expõe /empresa/, /perfil/, /local/, /estabelecimento/,
// /ficha/, /biz/. Portal de conteúdo expõe /blog/, /noticias/, /artigo/. Isso sai
// de graça dos resultados que já foram pagos.
//
// NÃO grava nada em `directory_channels` de propósito. Entrar na lista de
// diretórios é decisão humana: cada canal carrega form_url, submission_type,
// requires_login e instructions, que ninguém adivinha por busca. A função
// entrega a lista classificada para alguém aprovar.
//
// Uso:
//   GET /directory-discovery?segmento=restaurante&regiao=Sao%20Carlos&max=10
//   GET /directory-discovery?q=guia%20de%20empresas%20com%20telefone&max=5
//   GET /directory-discovery?incluir_descartados=1   (para auditar o filtro)
//   GET /directory-discovery?gravar=1                (guarda em directory_candidates)
//
// O cron semanal chama com gravar=1 e um `pular` que rotaciona as empresas, para
// cobrir a base inteira ao longo das semanas em vez de repetir as mesmas.
//
// Custo: 1 crédito do Serper por busca. O padrão são 6 buscas.
// A chave do Serper é COMPARTILHADA com o `radar` do CRM — não transformar isto
// em rotina agendada sem criar chave própria.

const URL_BASE = Deno.env.get("SUPABASE_URL")!;
const CHAVE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const CRON_TOKEN = Deno.env.get("CRON_TOKEN") ?? "";
const SERPER = Deno.env.get("SERPER_API_KEY");

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

// Domínios que aparecem em toda busca e nunca são diretório de perfil de empresa.
const RUIDO = [
  // rede social e plataforma de conteúdo
  "google.", "youtube.com", "facebook.com", "instagram.com", "twitter.com", "x.com",
  "linkedin.com", "tiktok.com", "pinterest.", "whatsapp.com", "wikipedia.org",
  "blogspot.", "wordpress.com", "medium.com", "substack.com",
  // marketplace de produto
  "mercadolivre.", "amazon.", "americanas.", "magazineluiza.", "shopee.",
  "aliexpress.", "casasbahia.", "submarino.",
  // pedido, entrega e reserva: o perfil existe para transacionar
  "ifood.com", "rappi.com", "ubereats.", "aiqfome.", "99app.", "booking.com",
  "airbnb.", "despegar.", "decolar.", "trivago.", "kayak.",
  // marketplace de lead e orçamento
  "getninjas.", "solutudo.", "habitissimo.", "homify.", "thumbtack.",
  "workana.", "99freelas.", "profissionaisdobrasil.",
  // fornecedor de software/site (o erro do saipos)
  "saipos.", "goomer.", "anotaai.", "consumer.com.br", "linx.com.br",
  "totvs.", "bling.com.br", "tiny.com.br", "wix.com", "wordpress.org",
  // emprego, CNPJ, reputação, jurídico
  "reclameaqui.com.br", "glassdoor.", "indeed.", "catho.", "vagas.com",
  // SEM ponto no fim de propósito: "serasa." não pegava empresas.serasaexperian.com.br,
  // e foi assim que um site de consulta de CNPJ entrou como "diretório" em 29/10/2026.
  "gov.br", "jusbrasil", "serasa", "receita.fazenda", "cnpj", "econodata",
  "consultasocio", "empresascnpj", "casadosdados", "escavador", "cpf",
  // raspador de processo judicial: tem página com nome de empresa, não é diretório
  "processorapido", "processos", "judicial", "tribunal", "oab",
  // site de escritório de advocacia: .adv.br é reservado a advogado no Brasil,
  // nunca é diretório de empresas
  ".adv.br", ".med.br",
  // agregador gerado por IA, que raspa e republica ficha de empresa
  "wanderboat", "trustpilot", "yellow.place", "cybo.com", "tuugo", "hotfrog",
  "maptons", "46graus", "ccmpedidoonline",
  // link de contato, não é diretório
  "wa.me", "api.whatsapp.com", "linktr.ee",
  // LOCALIZADOR DE PARCEIRO DE MARCA: tem página por empresa, mas entrar lá depende
  // de contrato com a marca, não de cadastro em diretório. Encheu a varredura de
  // 29/10/2026 por causa dos clientes de gás e de seguro.
  "portoseguro", "mapfre", "sulamerica", "bradescoseguros", "allianz",
  "ultragaz", "supergasbras", "comgas", "liquigas", "nacionalgas", "rinnai",
  "ppa.com.br", "intelbras", "positivo",
  // evento, curso e venda de produto
  "sympla", "eventbrite", "doity", "shopify", "nuvemshop", "lojaintegrada",
  // notícia e comparador
  "g1.globo.", "uol.com.br", "terra.com.br", "estadao.", "folha.uol",
  "zoom.com.br", "buscape.", "idealo.",
];

// Caminhos que indicam PERFIL DE EMPRESA — o que define o escopo deste sistema.
const PADRAO_PERFIL = [
  "/empresa/", "/empresas/", "/perfil/", "/local/", "/locais/", "/estabelecimento/",
  "/estabelecimentos/", "/ficha/", "/biz/", "/negocio/", "/negocios/", "/loja/",
  "/lojas/", "/profissional/", "/prestador/", "/clinica/", "/consultorio/",
  "/c/", "/b/", "/anunciante/",
];

// Caminhos que indicam CONTEÚDO, não perfil. Domínio que só aparece assim é portal.
const PADRAO_CONTEUDO = [
  "/blog/", "/noticia", "/artigo", "/post/", "/materia", "/dicas/", "/guia-de-",
  "/melhores-", "/top-", "/comparativo", "/review", "/wiki/", ".pdf",
];

// Caminhos de cadastro: prova de que o diretório aceita empresa nova.
const PADRAO_CADASTRO = [
  "cadastr", "anuncie", "anunciar", "adicionar-empresa", "incluir-empresa",
  "add-business", "claim", "para-empresas", "seja-parceiro", "criar-conta",
];

const TERMOS_PADRAO = [
  // todos buscam a PÁGINA DA EMPRESA, não "como divulgar"
  "guia de empresas telefone endereco perfil",
  "diretorio de empresas ficha da empresa contato",
  "lista de empresas por cidade telefone",
  "perfil da empresa endereco horario de funcionamento guia",
  "guia comercial online empresas da cidade",
  "cadastrar minha empresa gratis guia de empresas",
];

function dominio(url: string): string | null {
  try {
    const h = new URL(url).hostname.toLowerCase().replace(/^www\./, "");
    return h || null;
  } catch { return null; }
}

// O mesmo diretório aparece em vários domínios: tripadvisor.com e
// tripadvisor.com.br, por exemplo. Comparar o host inteiro faz o .com.br parecer
// canal novo. A marca é o primeiro rótulo do domínio, e é por ela que se compara.
function marca(host: string): string {
  return host.split(".")[0];
}

function eRuido(host: string): boolean {
  return RUIDO.some((r) => host.includes(r));
}

type Achado = {
  dominio: string;
  vezes: number;
  titulos: string[];
  buscas: string[];
  caminhos: string[];
  perfisDeEmpresaDaBase: number;
};

// Tira acento e pontuação para comparar nome de empresa com pedaço de URL.
function slug(t: string): string {
  return t.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

// Palavra de CATEGORIA não prova nada: `/advogados-sao-carlos` no site de um
// escritório casou com "Pepato & Buono Sociedade de Advogados" só pela palavra
// "advogados" — e aquilo era o site do próprio escritório, não um diretório.
// Só palavra distintiva (o nome de fato) serve como prova.
const CATEGORIA = [
  "ltda", "eireli", "comercio", "servicos", "empresa", "empresas", "grupo",
  "advogados", "advogado", "advocacia", "sociedade", "supermercado", "mercado",
  "restaurante", "lanchonete", "pizzaria", "imobiliaria", "imoveis", "clinica",
  "consultorio", "medico", "dentista", "odontologia", "academia", "loja",
  "artigos", "moda", "masculina", "feminina", "calcados", "tapecaria",
  "construcao", "materiais", "transporte", "transportes", "seguros", "contabilidade",
  "sao", "santo", "santa", "dos", "das", "para", "com",
];

// As palavras do nome que servem como prova dentro da URL: >=4 letras e não categoria.
function palavrasDoNome(nome: string): string[] {
  return slug(nome).split(" ").filter((w) => w.length >= 4 && !CATEGORIA.includes(w));
}

function casa(caminho: string, lista: string[]): boolean {
  const c = caminho.toLowerCase();
  return lista.some((p) => c.includes(p));
}

// Decide se o domínio é diretório de PERFIL DE EMPRESA, olhando as URLs que ele
// expôs na busca. Perfil ganha de conteúdo: um guia de verdade também tem blog.
function classificar(a: Achado) {
  const perfis = a.caminhos.filter((c) => casa(c, PADRAO_PERFIL)).length;
  const conteudos = a.caminhos.filter((c) => casa(c, PADRAO_CONTEUDO)).length;
  const cadastros = a.caminhos.filter((c) => casa(c, PADRAO_CADASTRO)).length;

  // Prova mais forte que existe: o domínio tem página de uma empresa DA NOSSA BASE,
  // achada buscando o nome dela. Não há como isso ser portal de conteúdo.
  if (a.perfisDeEmpresaDaBase > 0) {
    return {
      veredito: "diretorio_de_perfil_confirmado",
      aceito: true,
      porque: `tem página de ${a.perfisDeEmpresaDaBase} empresa(s) da nossa base, encontrada buscando o nome dela`,
      perfis, conteudos, cadastros,
    };
  }
  if (perfis > 0) {
    return {
      veredito: "diretorio_de_perfil",
      aceito: true,
      porque: `${perfis} URL(s) de perfil de empresa${cadastros ? ` e ${cadastros} de cadastro` : ""}`,
      perfis, conteudos, cadastros,
    };
  }
  if (cadastros > 0) {
    return {
      veredito: "aceita_cadastro_sem_perfil_visto",
      aceito: true,
      porque: `${cadastros} URL(s) de cadastro, mas nenhum perfil apareceu na busca: conferir à mão se cada empresa ganha página própria`,
      perfis, conteudos, cadastros,
    };
  }
  if (conteudos > 0 && conteudos >= a.caminhos.length / 2) {
    return {
      veredito: "portal_de_conteudo",
      aceito: false,
      porque: `${conteudos} de ${a.caminhos.length} URL(s) são blog/notícia/artigo: é portal, não diretório de perfil`,
      perfis, conteudos, cadastros,
    };
  }
  return {
    veredito: "indeterminado",
    aceito: false,
    porque: "nenhuma URL de perfil nem de cadastro apareceu: provável site institucional ou agregador",
    perfis, conteudos, cadastros,
  };
}

async function serper(q: string) {
  const r = await fetch("https://google.serper.dev/search", {
    method: "POST",
    headers: { "X-API-KEY": SERPER!, "Content-Type": "application/json" },
    body: JSON.stringify({ q, gl: "br", hl: "pt-br", num: 20 }),
  });
  if (!r.ok) throw new Error(`Serper ${r.status}: ${(await r.text()).slice(0, 200)}`);
  return await r.json();
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

  if (!SERPER) {
    return json({ success: false, error: "SERPER_API_KEY não configurada nesta função" }, 500);
  }

  try {
    const u = new URL(req.url);
    const max = Math.min(Number(u.searchParams.get("max") || 6), 12);
    const segmento = u.searchParams.get("segmento");
    const regiao = u.searchParams.get("regiao");
    const avulso = u.searchParams.get("q");
    const mostrarDescartados = u.searchParams.get("incluir_descartados") === "1";
    // gravar=1 guarda os achados em directory_candidates. É o que torna a rodada
    // agendada útil: sem isto o resultado morria na resposta HTTP e ninguém via.
    const gravar = u.searchParams.get("gravar") === "1";
    // modo=perfis é o padrão: busca empresas reais da base. modo=termos usa as
    // buscas genéricas antigas, que servem para explorar mas trazem muito ruído.
    const modo = u.searchParams.get("modo") || (avulso ? "termos" : "perfis");
    const porEmpresa = modo === "perfis" && !avulso;
    const quantasEmpresas = Math.min(Number(u.searchParams.get("amostra") || 4), 10);
    const cidade = u.searchParams.get("cidade");
    // offset permite varrer a cidade em tandas, sem repetir as mesmas empresas e
    // sem gastar crédito do Serper duas vezes na mesma.
    const deslocamento = Math.max(Number(u.searchParams.get("pular") || 0), 0);

    // MODO PERFIL (o que responde ao critério): em vez de procurar "guia de
    // empresas" — que devolve artigo de SEO —, busca EMPRESAS REAIS da base e vê em
    // quais domínios o perfil delas aparece. Se um domínio tem página da Karraza
    // Estofados, ele é por definição um diretório de perfil de empresa, e é onde as
    // pessoas acham essa empresa. É o sinal mais direto que existe, e custa 1
    // crédito por empresa.
    let amostra: any[] = [];
    if (porEmpresa) {
      // Guia local é por CIDADE: buscar empresas de uma cidade só concentra o sinal
      // naquele mercado. Sem `cidade`, pega qualquer uma e o resultado fica diluído.
      const filtroCidade = cidade ? `&city=ilike.*${encodeURIComponent(cidade)}*` : "";
      const q = `${URL_BASE}/rest/v1/companies?select=name,city,state,phone` +
        `&name=not.is.null&city=not.is.null${filtroCidade}` +
        `&offset=${deslocamento}&limit=${quantasEmpresas}`;
      const re = await fetch(q, { headers: { apikey: CHAVE, Authorization: `Bearer ${CHAVE}` } });
      amostra = (await re.json()) || [];
    }

    // Sem aspas de propósito: a chave do Serper deste projeto é de conta GRÁTIS, e
    // conta grátis recusa frase exata com `Query pattern not allowed for free
    // accounts`. O nome da empresa vai solto e a prova de perfil é a URL, não a frase.
    const nomePorTermo = new Map<string, string>();
    let termos: string[];
    if (porEmpresa && amostra.length) {
      termos = amostra.map((c: any) => {
        const q = `${c.name} ${c.city} telefone endereco`;
        nomePorTermo.set(q, String(c.name));
        return q;
      });
    } else if (avulso) {
      termos = [avulso];
    } else {
      termos = TERMOS_PADRAO.slice(0, max);
      if (segmento) termos.push(`diretorio de ${segmento}${regiao ? " em " + regiao : ""}`);
      if (regiao) termos.push(`guia comercial ${regiao}`);
      termos = termos.slice(0, max);
    }

    // quem já está na tabela, para não sugerir de novo
    const r = await fetch(
      `${URL_BASE}/rest/v1/directory_channels?select=code,name,website_url`,
      { headers: { apikey: CHAVE, Authorization: `Bearer ${CHAVE}` } },
    );
    const canais = await r.json();
    const conhecidos = new Set<string>();
    const marcasConhecidas = new Set<string>();
    for (const c of canais || []) {
      const d = c.website_url ? dominio(c.website_url) : null;
      if (d) { conhecidos.add(d); marcasConhecidas.add(marca(d)); }
      if (c.code) marcasConhecidas.add(String(c.code).toLowerCase());
    }

    // O site da PRÓPRIA empresa é o primeiro resultado quando se busca o nome dela,
    // e não é diretório nenhum. Sem isto, metade do "para revisar" era o site do
    // cliente que a gente mesmo cadastrou.
    const rs = await fetch(
      `${URL_BASE}/rest/v1/companies?select=website&website=not.is.null`,
      { headers: { apikey: CHAVE, Authorization: `Bearer ${CHAVE}` } },
    );
    for (const c of (await rs.json()) || []) {
      const d = c.website ? dominio(c.website) : null;
      if (d) conhecidos.add(d);
    }

    const achados = new Map<string, Achado>();
    let creditos = 0;
    const erros: string[] = [];

    for (const t of termos) {
      try {
        const res = await serper(t);
        creditos += Number(res.credits || 1);
        // no modo perfis, as palavras do nome buscado viram prova: se aparecem
        // dentro da URL, aquele domínio tem página DAQUELA empresa.
        const alvo = porEmpresa ? palavrasDoNome(nomePorTermo.get(t) ?? "") : [];
        for (const item of (res.organic || [])) {
          const d = dominio(item.link || "");
          if (!d || eRuido(d) || conhecidos.has(d) || marcasConhecidas.has(marca(d))) continue;
          const atual = achados.get(d) ||
            { dominio: d, vezes: 0, titulos: [], buscas: [], caminhos: [], perfisDeEmpresaDaBase: 0 };
          atual.vezes += 1;
          if (atual.titulos.length < 3 && item.title) atual.titulos.push(String(item.title).slice(0, 90));
          if (!atual.buscas.includes(t)) atual.buscas.push(t);
          try {
            const caminho = new URL(item.link).pathname;
            if (caminho && !atual.caminhos.includes(caminho)) atual.caminhos.push(caminho.slice(0, 120));
            // Duas palavras distintivas, ou uma bem longa: uma palavra curta sozinha
            // casa por acidente e foi o que deixou passar site de escritório.
            const naUrl = alvo.filter((w) => slug(caminho).includes(w));
            const prova = naUrl.length >= 2 || naUrl.some((w) => w.length >= 7);
            if (prova) atual.perfisDeEmpresaDaBase += 1;
          } catch { /* link torto: ignora */ }
          achados.set(d, atual);
        }
      } catch (e) {
        erros.push(`${t}: ${(e as Error).message}`);
      }
    }

    // Classifica pelo critério do sistema e separa o que entra do que foi descartado.
    // Aparecer em mais de uma busca segue sendo bom sinal, mas agora é desempate:
    // antes disso vem "tem perfil de empresa?".
    const avaliados = [...achados.values()]
      .map((a) => ({ ...a, ...classificar(a) }))
      .sort((a, b) =>
        Number(b.aceito) - Number(a.aceito) ||
        b.perfis - a.perfis ||
        b.vezes - a.vezes ||
        b.buscas.length - a.buscas.length
      );
    // Três baldes, não dois. "Indeterminado" não é o mesmo que "errado": é domínio
    // que apareceu buscando empresa e não deu prova nem contraprova — pode ser o guia
    // local da cidade cujo resultado foi a home. Jogar junto com blog esconde achado
    // bom, e foi o que aconteceu com um provável guia de Tupã em 29/10/2026.
    const candidatos = avaliados.filter((a) => a.aceito);
    const paraRevisar = avaliados.filter((a) => !a.aceito && a.veredito === "indeterminado");
    const descartados = avaliados.filter((a) => !a.aceito && a.veredito !== "indeterminado");

    // Guarda candidatos e os que ficaram para revisar. Descartados (portal de conteúdo)
    // não entram: já foram julgados e só sujariam a fila.
    let gravados = 0;
    let erroGravacao: string | null = null;
    if (gravar) {
      const guardar = [...candidatos, ...paraRevisar];
      try {
        for (const c of guardar) {
          // Upsert pelo domínio. `vezes` e `cidades` acumulam de propósito: o mesmo guia
          // aparecendo em várias cidades é sinal de que é bom, não duplicata.
          const existente = await fetch(
            `${URL_BASE}/rest/v1/directory_candidates?select=vezes,cidades,situacao&dominio=eq.${encodeURIComponent(c.dominio)}`,
            { headers: { apikey: CHAVE, Authorization: `Bearer ${CHAVE}` } },
          ).then((r) => r.json()).catch(() => []);
          const ant = Array.isArray(existente) ? existente[0] : null;

          // Quem já foi decidido não volta para a fila: só atualiza a contagem.
          const situacao = ant?.situacao && ant.situacao !== "novo" ? ant.situacao : "novo";
          const cidades = new Set<string>([...(ant?.cidades ?? [])]);
          if (cidade) cidades.add(cidade);

          const corpo = {
            dominio: c.dominio,
            veredito: c.veredito,
            porque: c.porque,
            caminho_exemplo: c.caminhos[0] ?? null,
            titulo: c.titulos[0] ?? null,
            perfis_da_base: c.perfisDeEmpresaDaBase,
            vezes: (ant?.vezes ?? 0) + c.vezes,
            cidades: [...cidades],
            situacao,
            ultima_vez: new Date().toISOString(),
          };
          const r = await fetch(`${URL_BASE}/rest/v1/directory_candidates`, {
            method: "POST",
            headers: {
              apikey: CHAVE,
              Authorization: `Bearer ${CHAVE}`,
              "Content-Type": "application/json",
              Prefer: "resolution=merge-duplicates,return=minimal",
            },
            body: JSON.stringify(corpo),
          });
          if (r.ok) gravados += 1;
        }
      } catch (e) {
        erroGravacao = (e as Error).message;
      }
    }

    return json({
      success: true,
      timestamp: new Date().toISOString(),
      gravados: gravar ? gravados : undefined,
      erro_gravacao: erroGravacao ?? undefined,
      buscas_feitas: termos,
      creditos_serper: creditos,
      canais_ja_cadastrados: conhecidos.size,
      criterio: "só diretório com perfil de empresa, onde as pessoas buscam a empresa e acham os dados de contato",
      modo,
      cidade: cidade || undefined,
      empresas_usadas: porEmpresa ? amostra.map((c: any) => `${c.name} (${c.city})`) : undefined,
      dominios_vistos: avaliados.length,
      candidatos_novos: candidatos.length,
      para_revisar_count: paraRevisar.length,
      descartados_count: descartados.length,
      candidatos,
      para_revisar: paraRevisar,
      descartados: mostrarDescartados ? descartados : undefined,
      erros: erros.length ? erros : undefined,
      aviso: "Nada foi gravado. `candidatos` tem prova de perfil de empresa; `para_revisar` apareceu na busca sem prova nem contraprova e merece olhada humana; `descartados` é portal de conteúdo. Cadastrar à mão em directory_channels com form_url, submission_type, country e instructions. ?incluir_descartados=1 mostra o terceiro balde.",
    });
  } catch (e) {
    return json({ success: false, error: (e as Error).message }, 500);
  }
});
