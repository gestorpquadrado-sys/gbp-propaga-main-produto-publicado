// directory-propagate
// Porte do workflow n8n "buz-propaga-dinamico-sem-google-facebook-retorno-synclogs"
// (18 nós / 756 linhas de Code) para uma única Edge Function.
//
// Mudanças deliberadas em relação ao n8n, e o porquê:
//  1. Gmail -> Resend. O nó Gmail usava OAuth de uma conta pessoal; o Resend envia
//     por domínio próprio e deixa rastro de entrega.
//  2. A service_role saiu do código (estava em texto puro em 2 nós) e vem do ambiente.
//  3. Os canais eram consultados um por um dentro do loop (1 request por canal).
//     Agora é uma única consulta com code=in.(...) — 26 canais viravam 26 round-trips,
//     o que não cabe no tempo de uma Edge Function.
//  4. $getWorkflowStaticData virou acumulador em memória. O re-fetch de sync_logs no
//     nó final existia só para contornar o Split In Batches devolver um item só;
//     aqui não há esse bug, então o acumulador é a fonte da verdade. O re-fetch
//     continua como fallback se a gravação falhar.
//  5. Envio com concorrência limitada e espaçamento, para não bater no rate limit
//     do Resend nem parecer disparo em massa.
//
// Comportamento preservado: google e facebook continuam filtrados do payload
// (são fonte de dados/IDs, não destino de propagação), o contrato de resposta para o
// front é idêntico, e o HTML do e-mail é o mesmo.

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
const RESEND_FROM = Deno.env.get("RESEND_FROM") ?? "P2 Local Listings <listings@envio.pquadrado.com.br>";

// google/facebook são fontes de dados, não diretórios de propagação.
const PROVIDER_ONLY_CHANNELS = ["google", "facebook"];

const EMAIL_CONCURRENCY = 2;
const EMAIL_SPACING_MS = 600;

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// --------------------------------------------------------------------------
// Fallback de diretórios: mesma tabela que estava embutida no nó
// "Function - Email Directory Router", usada quando directory_channels não
// responde ou não tem o código.
// --------------------------------------------------------------------------
const FALLBACK_DIRECTORIES: Record<string, {
  name: string; country: string; email: string; submission_type: string; subject: string; language: string;
}> = {
  apontador: { name: "Apontador", country: "BR", email: "cadastro@apontador.com.br", submission_type: "email", subject: "Solicitação de Cadastro/Atualização - {name}", language: "pt-BR" },
  guiamais: { name: "Guia Mais", country: "BR", email: "contato@guiamais.com.br", submission_type: "email", subject: "Inclusão de Empresa no Guia Mais - {name}", language: "pt-BR" },
  telelistas: { name: "Telelistas", country: "BR", email: "cadastro@telelistas.net", submission_type: "email", subject: "Cadastro Comercial - {name}", language: "pt-BR" },
  acheiaqui: { name: "Achei Aqui", country: "BR", email: "contato@acheiaqui.com.br", submission_type: "email", subject: "Solicitação de Cadastro - {name}", language: "pt-BR" },
  encontrabrasil: { name: "Encontra Brasil", country: "BR", email: "cadastro@encontrabrasil.com.br", submission_type: "email", subject: "Inclusão no Guia Comercial - {name}", language: "pt-BR" },
  guiasp: { name: "Guia SP", country: "BR", email: "cadastro@guiasp.com.br", submission_type: "email", subject: "Cadastro de Empresa - {name}", language: "pt-BR" },
  bing: { name: "Bing Places", country: "GLOBAL", email: "bingplaces@microsoft.com", submission_type: "email", subject: "Business Listing Submission - {name}", language: "en-US" },
  yelp: { name: "Yelp", country: "GLOBAL", email: "support@yelp.com", submission_type: "email", subject: "Business Claim Request - {name}", language: "en-US" },
  doctoralia: { name: "Doctoralia", country: "BR", email: "medicos@doctoralia.com.br", submission_type: "email", subject: "Cadastro Profissional de Saúde - {name}", language: "pt-BR" },
  ifood: { name: "iFood", country: "BR", email: "restaurantes@ifood.com.br", submission_type: "email", subject: "Parceria Comercial - {name}", language: "pt-BR" },
  rappi: { name: "Rappi", country: "BR", email: "restaurantes@rappi.com.br", submission_type: "email", subject: "Cadastro de Restaurante - {name}", language: "pt-BR" },
  getninjas: { name: "GetNinjas", country: "BR", email: "profissionais@getninjas.com.br", submission_type: "email", subject: "Cadastro de Profissional/Empresa - {name}", language: "pt-BR" },
  habitissimo: { name: "Habitissimo", country: "BR", email: "profissionais@habitissimo.com.br", submission_type: "email", subject: "Cadastro Profissional - {name}", language: "pt-BR" },
  vivareal: { name: "Viva Real", country: "BR", email: "anunciantes@vivareal.com.br", submission_type: "email", subject: "Cadastro de Anunciante - {name}", language: "pt-BR" },
  zapimoveis: { name: "ZAP Imóveis", country: "BR", email: "anuncie@zapimoveis.com.br", submission_type: "email", subject: "Cadastro Imobiliária - {name}", language: "pt-BR" },
  booking: { name: "Booking.com", country: "GLOBAL", email: "partner.help@booking.com", submission_type: "email", subject: "Property Registration - {name}", language: "en-US" },
  tripadvisor: { name: "TripAdvisor", country: "GLOBAL", email: "ownercenter@tripadvisor.com", submission_type: "email", subject: "Business Listing Request - {name}", language: "en-US" },
  foursquare: { name: "Foursquare", country: "GLOBAL", email: "support@foursquare.com", submission_type: "email", subject: "Venue Information Update - {name}", language: "en-US" },
};

// --------------------------------------------------------------------------
// Filtro de categoria
// --------------------------------------------------------------------------
// Por que existe: o roteador do n8n mandava o e-mail para todo canal que viesse no
// payload, sem olhar o nicho. Resultado prático: cadastro de laboratório indo para
// Rappi, Zomato, OpenTable e Doctoralia. Fora de ser inútil, uma dúzia de e-mails
// fora de contexto saindo do mesmo domínio no mesmo minuto é o padrão que queima
// reputação de remetente — e o domínio de envio é compartilhado com o CRM.
//
// O nicho do canal sai de `category` (singular). `categories` NÃO serve sozinho:
// o seed pôs "general" dentro de quase todos os arrays (rappi é
// ["food","general","restaurants"]), então tratar "general" no array como
// "serve para todos" anularia o filtro. Do array aproveitamos só os nichos.
//
// A categoria da empresa vem do Google como texto livre em pt-BR ("Restaurante
// japonês", "Companhia de gás", "Centro de diagnóstico médico por imagem"), e às
// vezes em inglês. Daí o casamento por palavra-chave.

const CATEGORIA_POR_PALAVRA: [RegExp, string[]][] = [
  [/imobili|corretor|im[óo]ve|real estate|loteament|incorporador/i, ["real_estate"]],
  [/restaurante|pizzar|lanchonet|hamb[úu]rg|burger|cafeteri|cafe?teria|padari|confeitari|sorveteri|ice cream|a[çc]a[íi]|churrascari|self-?service|food|bar\b|pub\b|delivery de comida|marmit|do[çc]aria/i, ["restaurants", "food"]],
  [/hotel|pousada|hostel|motel|resort|hospedage/i, ["hotels", "hospitality"]],
  [/farm[áa]ci|drogaria|medicament|manipula[çc]/i, ["pharmacy", "healthcare"]],
  [/m[ée]dic|cl[íi]nic|odonto|ortodont|dentist|diagn[óo]stic|exame|radiolog|imagem|sa[úu]de|psic[óo]|psiqui|fisioterap|nutricion|laborat[óo]ri|bioqu[íi]mic|veterin[áa]ri|[óo]ptic|oftalmo|dermato|pediatr|fonoaudi|enfermag|hospital/i, ["healthcare"]],
  [/arquitet|design|decora[çc]|interior|paisagis|urbanis/i, ["design"]],
  [/constru[çc]|construtora|empreiteir|gesso|serralh|reforma|obra|pedreir|alvenari|marmorari|vidra[çc]|telhad|esquadria|material de constru/i, ["construction", "services"]],
  [/servi[çc]o|dedetizador|lava-?r[áa]pid|jardinag|transport|entrega|conserto|manuten[çc]|instala[çc]|assist[êe]ncia|limpeza|chavei|guinch|mudan[çc]|advogad|advocaci|contabil|consultori|seguro|empr[ée]stim|marketing|fotograf|tape[çc]ari|gr[áa]fic|borracharia|eletricist|encanad|frete/i, ["services"]],
];

// Quem FORNECE para um setor não pertence a ele. "Ice cream equipment supplier" é
// fornecedor de equipamento, não sorveteria — e cadastrá-lo no Rappi ou no OpenTable
// é o mesmo erro que o filtro existe para evitar. O mesmo vale para distribuidor de
// material médico, que não é clínica.
const B2B_NAO_E_O_SETOR = /fornecedor|supplier|equipament|equipment|distribuidor|atacad|ind[úu]stri|f[áa]brica|fabricante|wholesale|revend/i;
const NICHOS_DE_CONSUMO_FINAL = ["restaurants", "food", "healthcare", "pharmacy", "hotels", "hospitality"];

function categoriasDaEmpresa(texto: string): string[] {
  const t = String(texto ?? "").trim();
  if (!t) return [];
  const slugs = new Set<string>();
  for (const [re, alvos] of CATEGORIA_POR_PALAVRA) {
    if (re.test(t)) alvos.forEach((a) => slugs.add(a));
  }
  if (B2B_NAO_E_O_SETOR.test(t)) {
    NICHOS_DE_CONSUMO_FINAL.forEach((n) => slugs.delete(n));
  }
  return [...slugs];
}

// Nichos do canal: `category` mais os nichos do array, "general" fora.
function nichosDoCanal(row: any): string[] {
  const brutos = [row?.category, ...(Array.isArray(row?.categories) ? row.categories : [])];
  return [...new Set(
    brutos
      .filter(Boolean)
      .map((c: any) => String(c).trim().toLowerCase())
      .filter((c: string) => c && c !== "general"),
  )];
}

// Canal sem nicho (ou com nicho que a empresa tem) passa. Canal de nicho alheio, não.
function canalCombina(row: any, slugsEmpresa: string[]) {
  const nichos = nichosDoCanal(row);
  if (nichos.length === 0) return { combina: true, nichos, motivo: "canal geral" };
  const emComum = nichos.filter((n) => slugsEmpresa.includes(n));
  if (emComum.length) return { combina: true, nichos, motivo: `nicho em comum: ${emComum.join(", ")}` };
  return { combina: false, nichos, motivo: null };
}

// Diretório só serve quem ele atende. Um diretório dos EUA não aceita empresa
// brasileira — o Manta diz em letra miúda "businesses located in the United States" —
// e oferecer o formulário dele para um cliente de São Carlos gasta o tempo do operador
// e infla o relatório com canal que nunca vai publicar.
//
// `GLOBAL` (ou vazio) atende qualquer país. Qualquer outro valor atende só aquele país.
// O campo `country` já existia, mas até 29/10/2026 era usado SÓ para escolher o idioma
// do e-mail; agora ele também decide quem recebe o canal.
function paisDaEmpresa(data: any): string {
  const cru = String(data?.address_country ?? "").trim().toUpperCase();
  if (!cru) return "BR";
  if (["BR", "BRA", "BRASIL", "BRAZIL"].includes(cru)) return "BR";
  if (["US", "USA", "EUA", "UNITED STATES", "UNITED STATES OF AMERICA"].includes(cru)) return "US";
  return cru.slice(0, 2);
}

function canalServePais(row: any, paisEmpresa: string) {
  const paisCanal = String(row?.country ?? "").trim().toUpperCase();
  if (!paisCanal || paisCanal === "GLOBAL" || paisCanal === "ALL") {
    return { serve: true, paisCanal: paisCanal || "GLOBAL" };
  }
  return { serve: paisCanal === paisEmpresa, paisCanal };
}

// --------------------------------------------------------------------------
// Formatação para humano (só na APRESENTAÇÃO, nunca no dado guardado)
// --------------------------------------------------------------------------
// O dado é normalizado para dígitos puros na entrada, que é o certo para guardar e
// para API. O problema é que ele saía cru também no e-mail e no bloco de copiar/colar,
// os dois lugares onde uma PESSOA do outro lado lê para cadastrar: "1633831000" e
// "13560000". Quem recebe tem de contar dígito para saber se há DDD.
function exibirTelefone(v: unknown): string {
  const b = String(v ?? "").trim();
  if (!b) return "";
  if (b.startsWith("+") && !b.startsWith("+55")) return b;        // estrangeiro: não mexer
  const d = b.replace(/\D/g, "").replace(/^55(?=\d{10,11}$)/, ""); // tira o +55 do Brasil
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;  // celular
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;  // fixo
  if (d.length === 9) return `${d.slice(0, 5)}-${d.slice(5)}`;    // sem DDD
  if (d.length === 8) return `${d.slice(0, 4)}-${d.slice(4)}`;
  return b;                                                       // formato estranho: como veio
}

function exibirCep(v: unknown): string {
  const b = String(v ?? "").trim();
  const d = b.replace(/\D/g, "");
  return d.length === 8 ? `${d.slice(0, 5)}-${d.slice(5)}` : b;
}

// --------------------------------------------------------------------------
// 1. Validate Input
// --------------------------------------------------------------------------
type Normalized = Record<string, any>;

function validateInput(payload: Record<string, any>): Normalized {
  const pick = (...values: any[]) =>
    values.find((v) => v !== undefined && v !== null && String(v).trim() !== "") ?? "";
  const cleanPhone = (v: any) => String(v ?? "").replace(/[^\d+]/g, "");
  const cleanCep = (v: any) => String(v ?? "").replace(/\D/g, "");
  const asArray = (value: any): any[] => {
    if (!value) return [];
    if (Array.isArray(value)) return value;
    if (typeof value === "string") return value.split(",").map((v) => v.trim()).filter(Boolean);
    return [];
  };

  const company = payload.company ?? {};
  const location = payload.location ?? payload.google_location ?? {};

  const channelsRaw = asArray(
    payload.channels ?? payload.channel_codes ?? payload.selected_channels ?? payload.selectedChannels,
  );

  const allChannels = channelsRaw
    .map((c: any) => (typeof c === "string" ? c : (c?.code ?? c?.channel_code ?? c?.id ?? c?.name)))
    .filter(Boolean)
    .map((c: any) => String(c).trim().toLowerCase());

  const ignored = allChannels.filter((c) => PROVIDER_ONLY_CHANNELS.includes(c));
  const channels = [...new Set(allChannels.filter((c) => !PROVIDER_ONLY_CHANNELS.includes(c)))];

  const normalized: Normalized = {
    company_id: pick(payload.company_id, company.id),
    location_id: pick(payload.location_id, payload.google_location_uuid, location.id),
    user_id: pick(payload.user_id, company.user_id, location.user_id),

    id: pick(payload.id, payload.profile_id, payload.company_id, company.id, payload.location_id, location.id),
    profile_id: pick(payload.profile_id, payload.location_id, location.id, payload.company_id, company.id),
    external_id: pick(payload.external_id, payload.google_place_id, location.google_place_id),
    gbp_location_id: pick(payload.gbp_location_id, payload.google_location_id, location.google_location_id),
    google_location_id: pick(payload.google_location_id, payload.gbp_location_id, location.google_location_id),
    google_place_id: pick(payload.google_place_id, location.google_place_id),

    name: pick(payload.name, company.name, location.name),
    brand: pick(payload.brand, company.brand),
    description: pick(payload.description, company.description, location.description),
    category: pick(payload.category, payload.category_primary, company.category, location.category_primary),

    phone_primary: cleanPhone(pick(payload.phone_primary, payload.phone, company.phone, location.phone_primary)),
    phone_whatsapp: cleanPhone(pick(payload.phone_whatsapp, payload.whatsapp, company.whatsapp, payload.phone_primary, payload.phone, company.phone)),
    email: pick(payload.email, company.email),
    website: pick(payload.website, company.website, location.website),

    address_street: pick(payload.address_street, payload.address, payload.address_full, company.address, location.address_full),
    address_number: pick(payload.address_number, company.address_number),
    address_complement: pick(payload.address_complement, company.address_complement),
    address_neighborhood: pick(payload.address_neighborhood, payload.neighborhood, company.neighborhood, location.address_neighborhood),
    address_city: pick(payload.address_city, payload.city, company.city, location.address_city),
    address_state: pick(payload.address_state, payload.state, company.state, location.address_state),
    address_zip: cleanCep(pick(payload.address_zip, payload.postal_code, payload.address_postal_code, company.postal_code, location.address_postal_code)),
    address_country: pick(payload.address_country, payload.country, company.country, location.address_country, "BR"),

    business_hours: pick(payload.business_hours, payload.hours_text),
    owner_name: pick(payload.owner_name, payload.user_name),
    owner_email: pick(payload.owner_email, payload.user_email),

    channels,
    ignored_provider_channels: ignored,
    company_categories: [] as string[], // preenchido abaixo, depois do pick de `category`
    processed_at: new Date().toISOString(),
    sync_id: pick(payload.sync_id, `sync_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`),
  };

  const required = ["name", "phone_primary", "address_street", "address_city", "address_state", "address_zip", "channels"];
  const missing = required.filter((f) => {
    const v = normalized[f];
    return Array.isArray(v) ? v.length === 0 : !v;
  });

  if (missing.length > 0) {
    const err: any = new Error(
      `Missing required fields: ${missing.join(", ")}. Canais ignorados por serem fontes de dados: ${ignored.join(", ") || "nenhum"}`,
    );
    err.missing = missing;
    err.ignored_provider_channels = ignored;
    throw err;
  }

  normalized.company_categories = categoriasDaEmpresa(normalized.category);
  normalized.company_country = paisDaEmpresa(normalized);

  if (!normalized.company_id || !normalized.user_id) {
    normalized.integration_warning =
      "company_id ou user_id ausente; gravação em directory_submissions pode falhar.";
  }

  return normalized;
}

// --------------------------------------------------------------------------
// PostgREST
// --------------------------------------------------------------------------
async function rest(path: string, init: RequestInit = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });
  const text = await res.text();
  let body: any = null;
  try { body = text ? JSON.parse(text) : null; } catch { body = text; }
  return { ok: res.ok, status: res.status, body };
}

// Uma consulta para todos os canais, em vez de uma por canal dentro do loop.
async function loadDirectories(codes: string[]) {
  if (codes.length === 0) return { rows: [] as any[], error: null as string | null };
  const list = codes.map((c) => `"${c.replace(/"/g, '""')}"`).join(",");
  const r = await rest(`directory_channels?code=in.(${encodeURIComponent(list)})&select=*`);
  if (!r.ok) {
    return { rows: [], error: `HTTP ${r.status}: ${typeof r.body === "string" ? r.body : JSON.stringify(r.body)}` };
  }
  return { rows: Array.isArray(r.body) ? r.body : [], error: null };
}

// --------------------------------------------------------------------------
// 2. Email Directory Router
// --------------------------------------------------------------------------
function routeChannel(data: Normalized, channel: string, row: any | null, lookupError: string | null) {
  const base = { ...data, channel, current_channel: channel };

  if (lookupError && !row) {
    const fb = FALLBACK_DIRECTORIES[channel];
    if (!fb) {
      return {
        ...base,
        directory_name: channel,
        directory_source: "lookup_error",
        email_to: "", email_subject: "", email_language: "pt-BR",
        email_skip: true, skip_status: "error", skip_status_code: 500,
        email_error: `Erro ao consultar directory_channels: ${lookupError}`,
        raw_directory_config: {},
      };
    }
  }

  let source = "supabase";
  if (!row) {
    const fb = FALLBACK_DIRECTORIES[channel];
    if (fb) {
      row = {
        code: channel, name: fb.name, country: fb.country, email_to: fb.email,
        submission_type: fb.submission_type || "email", is_active: true,
        website_url: null, form_url: null, requires_login: false,
        requires_manual_review: true, requires_paid_plan: false, api_available: false,
        notes: null, _fallback_subject: fb.subject, _fallback_language: fb.language,
      };
      source = "fallback";
    }
  }

  if (!row) {
    return {
      ...base,
      directory_name: channel, directory_source: "not_found",
      email_to: "", email_subject: "", email_language: "pt-BR",
      email_skip: true, skip_status: "error", skip_status_code: 404,
      email_error: `Diretório ${channel} não encontrado em directory_channels`,
      raw_directory_config: {},
    };
  }

  const active = row.is_active !== false;
  const submissionType = String(row.submission_type ?? "manual").toLowerCase();
  const emailTo = row.email_to ?? row.email ?? "";
  const directoryName = row.name ?? channel;
  const language = row.country === "BR" ? "pt-BR" : "en-US";
  const defaultSubject = language === "pt-BR"
    ? `Solicitação de cadastro/atualização - ${data.name}`
    : `Business listing request - ${data.name}`;
  const subjectTemplate = row.email_subject ?? row.subject ?? row._fallback_subject;
  const emailSubject = subjectTemplate
    ? String(subjectTemplate).replace("{name}", data.name)
    : defaultSubject;

  const common = {
    ...base,
    directory_name: directoryName,
    directory_country: row.country,
    directory_source: source,
    directory_submission_type: submissionType,
    directory_website_url: row.website_url ?? null,
    directory_form_url: row.form_url ?? null,
    directory_instructions: row.instructions ?? null,
    raw_directory_config: row,
  };

  if (!active) {
    return {
      ...common,
      email_to: "", email_subject: "", email_language: language,
      email_skip: true, skip_status: "inactive", skip_status_code: 410,
      email_error: `Diretório ${directoryName} está inativo e foi ignorado`,
    };
  }

  // Antes de qualquer coisa: o diretório atende o país da empresa?
  if (!data.ignore_country_filter && (emailTo || row.form_url || submissionType === "manual")) {
    const { serve, paisCanal } = canalServePais(row, data.company_country ?? "BR");
    if (!serve) {
      return {
        ...common,
        email_to: "",
        email_subject: "",
        email_language: language,
        email_skip: true,
        skip_status: "manual_required",
        skip_status_code: 202,
        country_mismatch: true,
        channel_country: paisCanal,
        email_error: `Pulado: ${directoryName} atende ${paisCanal} e a empresa é de ${
          data.company_country ?? "BR"
        }. Se for intencional, reenvie com ignore_country_filter=true.`,
      };
    }
  }

  // Antes de aceitar o canal, confere se o nicho combina com a empresa.
  //
  // Vale para QUALQUER submission_type, não só e-mail. Até 29/10/2026 a guarda era
  // `submissionType === "email"`, e enquanto todo canal de nicho era de e-mail isso
  // passava. Quando os canais de caixa morta viraram `form`, a imobiliária voltou a
  // receber Doctoralia, Rappi, OpenTable, iFood e Booking — não como e-mail enviado,
  // mas como "abra este formulário". Mandar o operador cadastrar imobiliária no
  // OpenTable é o mesmo erro, só mais lento: gasta o tempo dele e suja o relatório.
  if (!data.ignore_category_filter && (emailTo || row.form_url || submissionType === "manual")) {
    const { combina, nichos } = canalCombina(row, data.company_categories ?? []);
    if (!combina) {
      const daEmpresa = (data.company_categories ?? []).join(", ") || "não identificada";
      return {
        ...common,
        email_to: "",
        email_subject: "",
        email_language: language,
        email_skip: true,
        skip_status: "manual_required",
        skip_status_code: 202,
        category_mismatch: true,
        channel_niches: nichos,
        email_error: `Pulado: ${directoryName} é de ${nichos.join("/")} e a empresa é de ${daEmpresa}. ${
          submissionType === "email" ? "Nenhum e-mail enviado." : "Formulário não oferecido."
        } Se for intencional, reenvie com ignore_category_filter=true.`,
      };
    }
  }

  if (submissionType === "email" && emailTo) {
    return {
      ...common,
      email_to: emailTo,
      email_subject: emailSubject,
      email_language: row._fallback_language ?? language,
      email_skip: false,
    };
  }

  if (submissionType === "email" && !emailTo) {
    return {
      ...common,
      email_to: "", email_subject: "", email_language: language,
      email_skip: true, skip_status: "error", skip_status_code: 422,
      email_error: `Diretório ${directoryName} está como email, mas não possui email_to configurado`,
    };
  }

  if (submissionType === "form") {
    return {
      ...common,
      email_to: "", email_subject: "", email_language: language,
      email_skip: true, skip_status: "manual_required", skip_status_code: 202,
      email_error: row.form_url
        ? `Diretório ${directoryName} exige cadastro via formulário: ${row.form_url}`
        : `Diretório ${directoryName} exige cadastro via formulário`,
    };
  }

  if (submissionType === "api" || row.api_available === true) {
    return {
      ...common,
      email_to: "", email_subject: "", email_language: language,
      email_skip: true, skip_status: "not_implemented", skip_status_code: 501,
      email_error: `Diretório ${directoryName} possui API/parceiro, mas o conector ainda não foi implementado`,
    };
  }

  return {
    ...common,
    email_to: "", email_subject: "", email_language: language,
    email_skip: true, skip_status: "manual_required", skip_status_code: 202,
    email_error: row.instructions
      ? `Diretório ${directoryName} requer ação manual: ${row.instructions}`
      : `Diretório ${directoryName} requer ação manual ou configuração adicional`,
  };
}

// --------------------------------------------------------------------------
// 3. Generate Email Body  (HTML idêntico ao do n8n)
// --------------------------------------------------------------------------
function esc(v: any) {
  return String(v ?? "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
function br(v: any) {
  return esc(v).replace(/\n/g, "<br>");
}

function generateEmailBody(data: any): string {
  const isPt = data.email_language === "pt-BR";
  const title = isPt ? "Solicitação de Cadastro/Atualização de Empresa" : "Business Listing Request";
  const intro = isPt
    ? "Solicitamos a inclusão ou atualização dos dados abaixo no diretório de vocês. Os dados já estão organizados em formato de cadastro para facilitar a publicação."
    : "Please include or update the business listing below. The information is structured to make publication easier.";
  const signoff = isPt ? "Atenciosamente" : "Best regards";

  const rows: [string, any][] = [
    ["Nome da empresa", data.name],
    ["Categoria", data.category],
    ["Descrição", data.description],
    ["Telefone", exibirTelefone(data.phone_primary)],
    ["WhatsApp", exibirTelefone(data.phone_whatsapp)],
    ["E-mail", data.email],
    ["Site", data.website],
    ["Endereço", `${data.address_street}${data.address_number ? ", " + data.address_number : ""}`],
    ["Complemento", data.address_complement],
    ["Bairro", data.address_neighborhood],
    ["Cidade/UF", `${data.address_city} - ${data.address_state}`],
    ["CEP", exibirCep(data.address_zip)],
    ["Google Location ID", data.google_location_id || data.gbp_location_id],
    ["Google Place ID", data.google_place_id],
  ];

  const tableRows = rows
    .filter(([, v]) => v !== undefined && v !== null && String(v).trim() !== "")
    .map(([label, value]) =>
      `<tr><td style="padding:8px;border:1px solid #ddd;font-weight:bold;background:#f7f7f7;width:180px">${esc(label)}</td><td style="padding:8px;border:1px solid #ddd">${br(value)}</td></tr>`
    )
    .join("");

  return `<!DOCTYPE html><html><head><meta charset="UTF-8"></head><body style="font-family:Arial,sans-serif;line-height:1.6;color:#333"><div style="max-width:720px;margin:0 auto;padding:20px"><h2>${esc(title)}</h2><p><strong>Diretório:</strong> ${esc(data.directory_name)}</p><p>${esc(intro)}</p><table style="border-collapse:collapse;width:100%;font-size:14px">${tableRows}</table><p style="margin-top:18px">${esc(signoff)},<br><strong>${esc(data.owner_name || "Equipe " + data.name)}</strong><br>${esc(data.owner_email || data.email || "")}</p><hr><small>Email gerado automaticamente pelo P² Local Listings. Sync ID: ${esc(data.sync_id)}</small></div></body></html>`;
}

// --------------------------------------------------------------------------
// 4. Envio (Resend, no lugar do nó Gmail)
// --------------------------------------------------------------------------
async function sendEmail(data: any) {
  if (!RESEND_API_KEY) {
    return {
      ok: false,
      status: 503,
      body: { error: "RESEND_API_KEY não configurado no projeto" },
    };
  }

  // O diretório precisa poder responder à empresa, não à agência.
  const replyTo = data.owner_email || data.email || undefined;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: RESEND_FROM,
      to: [data.email_to],
      subject: data.email_subject,
      html: data.email_body_html,
      ...(replyTo ? { reply_to: replyTo } : {}),
      tags: [{ name: "source", value: "p2-local-listings" }],
    }),
  });

  const text = await res.text();
  let body: any = null;
  try { body = text ? JSON.parse(text) : null; } catch { body = text; }
  return { ok: res.ok, status: res.status, body };
}

// --------------------------------------------------------------------------
// 5. Process Response + Prepare Sync Logs
// --------------------------------------------------------------------------
function copyPayload(d: any) {
  return {
    "Nome da empresa": d.name || "",
    "Categoria": d.category || "",
    "Descrição": d.description || "",
    "Telefone": exibirTelefone(d.phone_primary),
    "WhatsApp": exibirTelefone(d.phone_whatsapp),
    "E-mail": d.email || "",
    "Site": d.website || "",
    "Endereço": `${d.address_street || ""}${d.address_number ? ", " + d.address_number : ""}`,
    "Complemento": d.address_complement || "",
    "Bairro": d.address_neighborhood || "",
    "Cidade": d.address_city || "",
    "Estado": d.address_state || "",
    "CEP": exibirCep(d.address_zip),
    "Google Location ID": d.google_location_id || d.gbp_location_id || "",
    "Google Place ID": d.google_place_id || "",
  };
}

function buildResult(routed: any, send: any | null, startedAt: number, dryRun: boolean) {
  const duration = Date.now() - startedAt;
  const submissionType = routed.directory_submission_type || "manual";
  const formUrl = routed.directory_form_url ?? routed.raw_directory_config?.form_url ?? null;
  const websiteUrl = routed.directory_website_url ?? routed.raw_directory_config?.website_url ?? null;

  const baseRaw = {
    provider_response: send?.body ?? null,
    provider: send ? "resend" : null,
    directory_config: routed.raw_directory_config ?? {},
    submission_type: submissionType,
    source: routed.directory_source ?? null,
    form_url: formUrl,
    website_url: websiteUrl,
    directory_name: routed.directory_name,
    copy_payload: copyPayload(routed),
    dry_run: dryRun || undefined,
    category_mismatch: routed.category_mismatch || undefined,
    country_mismatch: routed.country_mismatch || undefined,
    channel_niches: routed.channel_niches,
    channel_country: routed.channel_country,
    company_categories: routed.company_categories,
    company_country: routed.company_country,
  };

  // Caminho assistido/manual: não houve envio.
  if (routed.email_skip) {
    const status = routed.skip_status || "error";
    const statusCode = routed.skip_status_code || 400;
    const isAssisted = ["manual_required", "not_implemented", "inactive"].includes(status);
    return {
      channel: routed.channel,
      status,
      statusCode,
      message: routed.email_error || "Diretório exige ação assistida/manual",
      durationMs: duration,
      submissionType,
      directoryName: routed.directory_name,
      formUrl,
      websiteUrl,
      profileUrl: null,
      verificationStatus: isAssisted ? "manual_check_required" : "not_checked",
      verificationMessage: isAssisted
        ? "Este canal precisa de formulário, login, captcha, API futura ou revisão manual."
        : null,
      nextVerificationAt: null,
      categoryMismatch: routed.category_mismatch ?? false,
      countryMismatch: routed.country_mismatch ?? false,
      channelNiches: routed.channel_niches ?? null,
      channelCountry: routed.channel_country ?? null,
      manualInstructions: routed.country_mismatch
        ? `Não cadastre aqui: este diretório atende ${routed.channel_country} e a empresa é de ${routed.company_country}. Foi pulado de propósito.`
        : routed.category_mismatch
        ? `Não cadastre aqui sem pensar duas vezes: este diretório é de ${(routed.channel_niches ?? []).join("/")} e a empresa não é. Foi pulado de propósito.`
        : isAssisted
        // A instrução ESCRITA no canal ganha do texto genérico: é onde mora o que o
        // operador precisa saber e ninguém adivinha — que o Lista Mais só aceita de
        // graça uma vez, que o anúncio destacado da Lecto é pago, que o Diskfone
        // cadastra por telefone.
        ? (routed.directory_instructions
          ? `${routed.directory_instructions}\n\nCopie os dados padronizados e conclua o cadastro à mão. O sistema não força automação para não gerar bloqueio.`
          : "Abra o formulário/site do diretório, copie os dados padronizados e conclua o cadastro manualmente. O sistema evita automação forçada para não gerar bloqueios.")
        : null,
      copyPayload: baseRaw.copy_payload,
      raw: { ...baseRaw, status, manual_instructions: isAssisted ? "ver manualInstructions" : null },
      createdAt: new Date().toISOString(),
    };
  }

  if (dryRun) {
    return {
      channel: routed.channel,
      status: "dry_run",
      statusCode: 200,
      message: `Simulação: e-mail seria enviado para ${routed.directory_name} <${routed.email_to}>`,
      durationMs: duration,
      submissionType,
      directoryName: routed.directory_name,
      formUrl,
      websiteUrl,
      profileUrl: null,
      verificationStatus: "not_checked",
      verificationMessage: null,
      nextVerificationAt: null,
      manualInstructions: null,
      copyPayload: baseRaw.copy_payload,
      raw: {
        ...baseRaw,
        status: "dry_run",
        email_to: routed.email_to,
        email_subject: routed.email_subject,
        // Na simulação devolvemos o HTML para dar pra conferir o e-mail antes do envio real.
        email_body_html: routed.email_body_html,
      },
      createdAt: new Date().toISOString(),
    };
  }

  const ok = !!send?.ok;
  return {
    channel: routed.channel,
    status: ok ? "sent" : "error",
    statusCode: send?.status ?? 500,
    message: ok
      ? `Email sent to ${routed.directory_name}`
      : `Falha ao enviar para ${routed.directory_name}: ${typeof send?.body === "string" ? send.body : JSON.stringify(send?.body ?? {})}`,
    durationMs: duration,
    submissionType,
    directoryName: routed.directory_name,
    formUrl,
    websiteUrl,
    profileUrl: null,
    verificationStatus: ok ? "pending_review" : "not_checked",
    verificationMessage: ok
      ? "Solicitação enviada. Verificação online recomendada após a revisão do diretório."
      : null,
    nextVerificationAt: ok ? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() : null,
    manualInstructions: null,
    copyPayload: baseRaw.copy_payload,
    raw: { ...baseRaw, status: ok ? "sent" : "error", manual_instructions: null },
    createdAt: new Date().toISOString(),
  };
}

// --------------------------------------------------------------------------
// 6. Gravação
// --------------------------------------------------------------------------
const SUBMITTED_STATUSES = ["sent", "submitted", "manual_required"];

async function persist(data: Normalized, results: Record<string, any>) {
  const now = new Date().toISOString();
  const syncRows: any[] = [];
  const subRows: any[] = [];

  for (const r of Object.values(results) as any[]) {
    syncRows.push({
      sync_id: data.sync_id,
      profile_id: data.profile_id || data.location_id || data.company_id || data.id || null,
      channel: r.channel,
      status: r.status,
      status_code: r.statusCode,
      message: r.message,
      duration_ms: r.durationMs,
      created_at: r.createdAt || now,
    });

    // company_id e user_id são NOT NULL com FK; sem eles a linha não entra.
    if (data.company_id && data.user_id) {
      subRows.push({
        company_id: data.company_id,
        location_id: data.location_id || null,
        user_id: data.user_id,
        channel_code: r.channel,
        status: r.status,
        message: r.message,
        status_code: r.statusCode,
        duration_ms: r.durationMs,
        raw_response: { ...r.raw, ...stripRaw(r) },
        sync_id: data.sync_id,
        submission_type: r.submissionType,
        directory_name: r.directoryName,
        form_url: r.formUrl,
        profile_url: r.profileUrl,
        verification_status: r.verificationStatus,
        verification_message: r.verificationMessage,
        next_verification_at: r.nextVerificationAt,
        submitted_at: SUBMITTED_STATUSES.includes(r.status) ? now : null,
      });
    }
  }

  const errors: Record<string, string> = {};

  if (syncRows.length) {
    const r = await rest("sync_logs", { method: "POST", body: JSON.stringify(syncRows) });
    if (!r.ok) errors.sync_logs = `HTTP ${r.status}: ${JSON.stringify(r.body)}`;
  }
  if (subRows.length) {
    // directory_submissions tem UNIQUE (user_id, location_id, channel_code): o insert
    // simples do n8n devolvia 409 em toda re-sincronização do mesmo canal. Aqui é upsert,
    // então reenviar para um diretório atualiza a linha em vez de falhar.
    const r = await rest(
      "directory_submissions?on_conflict=user_id,location_id,channel_code",
      {
        method: "POST",
        headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
        body: JSON.stringify(subRows.map((row) => ({ ...row, updated_at: now }))),
      },
    );
    if (!r.ok) errors.directory_submissions = `HTTP ${r.status}: ${JSON.stringify(r.body)}`;
  } else if (!data.company_id || !data.user_id) {
    errors.directory_submissions = "company_id/user_id ausentes no payload; nada gravado nessa tabela";
  }

  return Object.keys(errors).length ? errors : null;
}

// raw_response guarda o mesmo resumo que o front recebe, como no n8n.
function stripRaw(r: any) {
  const { raw: _raw, ...rest } = r;
  return rest;
}

// --------------------------------------------------------------------------
// 7. Loop com concorrência limitada
// --------------------------------------------------------------------------
async function processChannels(data: Normalized, byCode: Map<string, any>, lookupError: string | null, dryRun: boolean) {
  const results: Record<string, any> = {};
  const fila = [...data.channels];

  // Canal onde a ficha JÁ ESTÁ NO AR não é repropagado.
  //
  // A tela de sincronizar já fixa esses canais fora da seleção, mas isso é proteção de
  // interface: uma chamada direta à função, ou uma sincronização disparada de outro
  // lugar, passaria por cima. Refazer cadastro num diretório que já publicou é trabalho
  // perdido no melhor caso e, no pior, cria ficha duplicada que o diretório recusa ou
  // mescla errado.
  const jaPublicados = new Map<string, string>();
  // Guardado em `data` porque quem monta a resposta é outra função (finalResponse):
  // declarar uma variável local aqui e usá-la lá dava ReferenceError e derrubava a
  // função com 500 em produção.
  data._erro_ja_publicados = null;
  if (data.location_id) {
    // `rest()` devolve { ok, status, body } — NÃO o array. Iterar o retorno direto
    // lançava TypeError, e o catch silencioso engolia a falha: a trava parecia
    // funcionar e nunca pulava nada. O erro agora volta no `erro_ja_publicados` da
    // resposta, em vez de desaparecer.
    const r = await rest(
      `directory_submissions?select=channel_code,profile_url` +
      `&location_id=eq.${encodeURIComponent(data.location_id)}` +
      `&verification_status=eq.found_online`,
    );
    if (r.ok && Array.isArray(r.body)) {
      for (const p of r.body) {
        if (p?.channel_code) jaPublicados.set(p.channel_code, p.profile_url ?? "");
      }
    } else {
      data._erro_ja_publicados =
        `Não foi possível conferir o que já está publicado (HTTP ${r.status}). A sincronização seguiu sem essa trava.`;
    }
  }

  // Canais que não enviam e-mail não precisam de espaçamento: resolvem na hora.
  const roteados = fila.map((ch) => {
    if (jaPublicados.has(ch) && !data.ignore_published) {
      const canal = byCode.get(ch) ?? null;
      const nome = canal?.name ?? ch;
      const url = jaPublicados.get(ch) || "";
      return {
        channel: ch,
        directory_name: nome,
        directory_country: canal?.country ?? null,
        directory_form_url: canal?.form_url ?? null,
        directory_instructions: canal?.instructions ?? null,
        company_categories: data.company_categories ?? [],
        company_country: data.company_country ?? "BR",
        email_to: "", email_subject: "", email_language: "pt-BR",
        email_skip: true,
        skip_status: "found_online",
        skip_status_code: 200,
        already_published: true,
        profile_url: url,
        email_error: `${nome} já tem a ficha publicada${url ? `: ${url}` : ""}. Nada foi reenviado. Para forçar, reenvie com ignore_published=true.`,
      } as any;
    }
    return routeChannel(data, ch, byCode.get(ch) ?? null, lookupError);
  });

  for (const routed of roteados.filter((r) => r.email_skip)) {
    const t0 = Date.now();
    results[routed.channel] = buildResult(routed, null, t0, dryRun);
  }

  const paraEnviar = roteados.filter((r) => !r.email_skip);
  for (let i = 0; i < paraEnviar.length; i += EMAIL_CONCURRENCY) {
    const lote = paraEnviar.slice(i, i + EMAIL_CONCURRENCY);
    await Promise.all(lote.map(async (routed) => {
      const t0 = Date.now();
      routed.email_body_html = generateEmailBody(routed);
      const send = dryRun ? null : await sendEmail(routed);
      results[routed.channel] = buildResult(routed, send, t0, dryRun);
    }));
    // Na simulação não há envio, então o espaçamento só faria a chamada demorar.
    if (!dryRun && i + EMAIL_CONCURRENCY < paraEnviar.length) await sleep(EMAIL_SPACING_MS);
  }

  return results;
}

// --------------------------------------------------------------------------
// 8. Final Response  (contrato idêntico ao do webhook n8n)
// --------------------------------------------------------------------------
const SUCCESS_STATUSES = ["success", "sent", "submitted", "found_online", "ok", "dry_run"];
const MANUAL_STATUSES = ["manual_required", "manual", "inactive", "not_implemented", "pending_review", "manual_check_required", "captcha_required"];
const ERROR_STATUSES = ["error", "failed", "not_returned", "not_found", "data_mismatch"];

function finalResponse(data: Normalized, results: Record<string, any>, persistErrors: any, dryRun: boolean) {
  const out: Record<string, any> = {};
  for (const [canal, r] of Object.entries(results) as [string, any][]) {
    out[canal] = {
      status: r.status,
      statusCode: r.statusCode,
      message: r.message,
      durationMs: r.durationMs,
      submissionType: r.submissionType,
      directoryName: r.directoryName,
      formUrl: r.formUrl,
      websiteUrl: r.websiteUrl,
      profileUrl: r.profileUrl,
      verificationStatus: r.verificationStatus,
      verificationMessage: r.verificationMessage,
      nextVerificationAt: r.nextVerificationAt,
      manualInstructions: r.manualInstructions,
      categoryMismatch: r.categoryMismatch ?? false,
      countryMismatch: r.countryMismatch ?? false,
      channelNiches: r.channelNiches ?? null,
      channelCountry: r.channelCountry ?? null,
      copyPayload: r.copyPayload,
      createdAt: r.createdAt,
      updatedAt: r.createdAt,
      // Só na simulação: o HTML do e-mail, para conferir antes do envio real.
      ...(dryRun ? { emailTo: r.raw?.email_to ?? null, emailSubject: r.raw?.email_subject ?? null, emailPreviewHtml: r.raw?.email_body_html ?? null } : {}),
    };
  }

  // Garante que todo canal selecionado apareça no retorno.
  for (const canal of data.channels) {
    if (!out[canal]) {
      out[canal] = {
        status: "not_returned",
        statusCode: 202,
        message: `Canal ${canal} foi selecionado, mas não retornou resultado. Verifique sync_logs/directory_submissions.`,
        durationMs: null, createdAt: null, updatedAt: null,
      };
    }
  }

  const vals = Object.values(out) as any[];
  const successCount = vals.filter((v) => SUCCESS_STATUSES.includes(v.status)).length;
  const manualCount = vals.filter((v) => MANUAL_STATUSES.includes(v.status)).length;
  const errorCount = vals.filter((v) => ERROR_STATUSES.includes(v.status)).length;

  return {
    success: vals.length > 0 && errorCount === 0 && (successCount + manualCount) === vals.length,
    sync_id: data.sync_id,
    timestamp: new Date().toISOString(),
    total_channels: Math.max(data.channels.length, vals.length),
    success_count: successCount,
    manual_count: manualCount,
    error_count: errorCount,
    ignored_provider_channels: data.ignored_provider_channels,
    company_categories: data.company_categories ?? [],
    category_mismatch_count: vals.filter((v: any) => v.categoryMismatch).length,
    category_filter: data.ignore_category_filter ? "desligado" : "ligado",
    company_country: data.company_country ?? "BR",
    country_mismatch_count: vals.filter((v: any) => v.countryMismatch).length,
    ja_publicados_count: vals.filter((v: any) => v.status === "found_online").length,
    erro_ja_publicados: (data as any)._erro_ja_publicados ?? undefined,
    country_filter: data.ignore_country_filter ? "desligado" : "ligado",
    response_source: dryRun ? "dry_run" : "edge_function",
    fetch_error: persistErrors ? JSON.stringify(persistErrors) : null,
    dry_run: dryRun,
    results: out,
  };
}

// --------------------------------------------------------------------------
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ success: false, error: "Use POST" }, 405);

  let payload: Record<string, any>;
  try {
    const body = await req.json();
    payload = body?.body ?? body ?? {};
  } catch {
    return json({ success: false, error: "JSON inválido no corpo da requisição" }, 400);
  }

  // dry_run monta tudo (valida, roteia, gera o HTML) sem enviar e-mail nem gravar.
  const dryRun = payload.dry_run === true || payload.dryRun === true;
  // Desliga o filtro de categoria para esta chamada, quando o envio fora de nicho é
  // deliberado (um restaurante que também quer aparecer no diretório de imóveis, p.ex.).
  const ignoraFiltro = payload.ignore_category_filter === true || payload.ignoreCategoryFilter === true;
  // Mesma ideia para o país: desliga só nesta chamada, para o caso deliberado.
  const ignoraPais = payload.ignore_country_filter === true || payload.ignoreCountryFilter === true;
  // Força o reenvio mesmo onde a ficha já está no ar. Existe para o caso em que a ficha
  // publicada está errada e se quer refazer de propósito.
  const ignoraPublicados = payload.ignore_published === true || payload.ignorePublished === true;

  let data: Normalized;
  try {
    data = validateInput(payload);
    data.ignore_category_filter = ignoraFiltro;
    data.ignore_country_filter = ignoraPais;
    data.ignore_published = ignoraPublicados;
  } catch (e: any) {
    return json({
      success: false,
      error: e.message,
      missing: e.missing ?? null,
      ignored_provider_channels: e.ignored_provider_channels ?? [],
    }, 400);
  }

  const { rows, error: lookupError } = await loadDirectories(data.channels);
  const byCode = new Map<string, any>(rows.map((r: any) => [String(r.code).toLowerCase(), r]));

  const results = await processChannels(data, byCode, lookupError, dryRun);
  const persistErrors = dryRun ? null : await persist(data, results);

  return json(finalResponse(data, results, persistErrors, dryRun));
});
