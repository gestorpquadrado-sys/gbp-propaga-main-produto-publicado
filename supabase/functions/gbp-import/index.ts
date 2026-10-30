// Importa os perfis do Google Meu Negócio da conta conectada.
//
// Porte do workflow n8n `gbp-propaga` (webhook `p2/gbp/import`): lista as contas,
// pega os locais da primeira, e completa o bairro consultando o ViaCEP pelo CEP —
// porque a API do Google devolve `sublocality` vazio na maioria das fichas
// brasileiras, e sem bairro o cadastro em diretório local fica ruim.
//
// O formato de saída é IGUAL ao do n8n, campo por campo: o front consome esses
// nomes e não há código-fonte dele num repositório fácil de mexer.
//
// OAuth: mesmo refresh_token do `google-categories-list`, escopo business.manage.
//
// Uso: GET /gbp-import
//      GET /gbp-import?accountIndex=1   (para contas além da primeira)

const ID = Deno.env.get("GBP_CLIENT_ID");
const SECRET = Deno.env.get("GBP_CLIENT_SECRET");
const REFRESH = Deno.env.get("GBP_REFRESH_TOKEN");

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const READ_MASK =
  "name,title,phoneNumbers,storefrontAddress,websiteUri,regularHours,categories,profile,metadata";

async function accessToken(): Promise<string> {
  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: ID!, client_secret: SECRET!,
      refresh_token: REFRESH!, grant_type: "refresh_token",
    }),
  });
  const d = await r.json();
  if (!r.ok || !d.access_token) throw new Error(`OAuth ${r.status}: ${JSON.stringify(d).slice(0, 200)}`);
  return d.access_token;
}

async function google(url: string, token: string) {
  const r = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  const t = await r.text();
  if (!r.ok) throw new Error(`Google ${r.status} em ${url.split("/v1/")[1] || url}: ${t.slice(0, 200)}`);
  return t ? JSON.parse(t) : {};
}

// O ViaCEP é generoso mas não infinito: 6 de cada vez evita tomar bloqueio
// quando a conta tem muitas fichas.
async function bairroPorCep(ceps: string[]): Promise<Map<string, string>> {
  const mapa = new Map<string, string>();
  const unicos = [...new Set(ceps.filter((c) => c && c.length === 8))];
  for (let i = 0; i < unicos.length; i += 6) {
    const lote = unicos.slice(i, i + 6);
    await Promise.all(lote.map(async (cep) => {
      try {
        const ctl = new AbortController();
        const t = setTimeout(() => ctl.abort(), 8000);
        const r = await fetch(`https://viacep.com.br/ws/${cep}/json/`, { signal: ctl.signal });
        clearTimeout(t);
        if (!r.ok) return;
        const d = await r.json();
        // o ViaCEP responde 200 com {"erro": true} para CEP inexistente
        if (d && d.erro !== true && d.erro !== "true" && typeof d.bairro === "string" && d.bairro) {
          mapa.set(cep, d.bairro);
        }
      } catch { /* CEP sem resposta: cai no sublocality do Google */ }
    }));
  }
  return mapa;
}

function horarios(loc: any): Record<string, { open: string; close: string }> {
  const h: Record<string, { open: string; close: string }> = {};
  for (const p of loc?.regularHours?.periods || []) {
    const dia = String(p.openDay || "unknown").toLowerCase();
    const dd = (n: unknown) => String(Number(n) || 0).padStart(2, "0");
    h[dia] = {
      open: `${dd(p.openTime?.hours)}:${dd(p.openTime?.minutes)}`,
      close: `${dd(p.closeTime?.hours)}:${dd(p.closeTime?.minutes)}`,
    };
  }
  return h;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  const json = (b: unknown, s = 200) =>
    new Response(JSON.stringify(b), { status: s, headers: { ...CORS, "Content-Type": "application/json" } });

  if (!ID || !SECRET || !REFRESH) {
    return json({ success: false, error: "GBP_CLIENT_ID / GBP_CLIENT_SECRET / GBP_REFRESH_TOKEN não configurados" }, 500);
  }

  try {
    const idx = Number(new URL(req.url).searchParams.get("accountIndex") || 0);
    const token = await accessToken();

    const contas = await google("https://mybusinessaccountmanagement.googleapis.com/v1/accounts", token);
    const lista = contas.accounts || [];
    if (!lista.length) return json({ success: false, error: "Nenhuma conta do Google Business Profile nessa credencial" }, 404);
    if (idx >= lista.length) {
      return json({ success: false, error: `accountIndex ${idx} fora da faixa: há ${lista.length} conta(s)` }, 400);
    }
    const conta = lista[idx];

    const u = new URL(`https://mybusinessbusinessinformation.googleapis.com/v1/${conta.name}/locations`);
    u.searchParams.set("readMask", READ_MASK);
    u.searchParams.set("pageSize", "100");
    const resp = await google(u.toString(), token);
    const locais = resp.locations || [];

    const ceps = locais.map((l: any) => String(l.storefrontAddress?.postalCode || "").replace(/\D/g, ""));
    const bairros = await bairroPorCep(ceps);

    const formatados = locais.map((loc: any, i: number) => {
      const end = loc.storefrontAddress || {};
      const cats = loc.categories || {};
      const cep = ceps[i];
      return {
        google_location_id: loc.name,
        google_place_id: loc.metadata?.placeId || "",
        google_maps_uri: loc.metadata?.mapsUri || "",

        name: loc.title || "",
        description: loc.profile?.description || "",

        phone_primary: loc.phoneNumbers?.primaryPhone || "",
        phone_additional: (loc.phoneNumbers?.additionalPhones || []).join(", "),
        website: loc.websiteUri || "",

        address_full: end.addressLines?.[0] || "",
        address_city: end.locality || "",
        address_state: end.administrativeArea || "",
        address_postal_code: end.postalCode || "",
        address_country: end.regionCode || "BR",
        address_neighborhood: bairros.get(cep) || end.sublocality || "",

        category_primary: cats.primaryCategory?.displayName || "",
        categories_additional: (cats.additionalCategories || []).map((c: any) => c.displayName).filter(Boolean),

        hours: horarios(loc),
      };
    });

    return json({
      success: true,
      total: formatados.length,
      locations: formatados,
      conta: { nome: conta.name, titulo: conta.accountName || null, de: lista.length },
      bairros_do_viacep: bairros.size,
      timestamp: new Date().toISOString(),
    });
  } catch (e) {
    return json({ success: false, error: (e as Error).message }, 500);
  }
});
