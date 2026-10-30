// Lista as categorias do Google Business Profile, para escolher a categoria da ficha.
//
// Junta os dois nós Code do workflow n8n `p2-google-categories-list` (normalizar a
// consulta e formatar a resposta) com a chamada HTTP que ficava entre eles.
//
// O OAuth do Google sai do n8n e passa a viver aqui: o refresh_token é segredo da
// função e a access_token é renovada a cada chamada (vale 1h, não compensa guardar).
// Escopo: https://www.googleapis.com/auth/business.manage
//
// Uso:
//   GET /google-categories-list?q=restaurante&regionCode=BR&languageCode=pt-BR&limit=50
//   GET /google-categories-list?pageToken=...

const ID = Deno.env.get("GBP_CLIENT_ID");
const SECRET = Deno.env.get("GBP_CLIENT_SECRET");
const REFRESH = Deno.env.get("GBP_REFRESH_TOKEN");

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

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
  if (!r.ok || !d.access_token) {
    throw new Error(`OAuth ${r.status}: ${JSON.stringify(d).slice(0, 220)}`);
  }
  return d.access_token;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  const json = (b: unknown, s = 200) =>
    new Response(JSON.stringify(b), { status: s, headers: { ...CORS, "Content-Type": "application/json" } });

  if (!ID || !SECRET || !REFRESH) {
    return json({ success: false, error: "GBP_CLIENT_ID / GBP_CLIENT_SECRET / GBP_REFRESH_TOKEN não configurados" }, 500);
  }

  try {
    const u = new URL(req.url);
    const q = u.searchParams;

    // --- parte 1: normalizar a consulta (era o nó "Function - Normalize Query") ---
    const busca = String(q.get("query") || q.get("search") || q.get("q") || "").trim();
    const regionCode = String(q.get("regionCode") || q.get("region") || "BR").toUpperCase();
    const languageCode = String(q.get("languageCode") || q.get("language") || "pt-BR");
    const pageSize = Math.min(Math.max(parseInt(q.get("limit") || q.get("pageSize") || "100", 10) || 100, 1), 100);
    const pageToken = q.get("pageToken") || "";

    // --- parte 2: a chamada que no n8n era um nó HTTP ---
    const alvo = new URL("https://mybusinessbusinessinformation.googleapis.com/v1/categories");
    alvo.searchParams.set("regionCode", regionCode);
    alvo.searchParams.set("languageCode", languageCode);
    alvo.searchParams.set("view", "FULL");
    alvo.searchParams.set("pageSize", String(pageSize));
    if (busca) alvo.searchParams.set("filter", `displayName=${busca}`);
    if (pageToken) alvo.searchParams.set("pageToken", pageToken);

    const token = await accessToken();
    const r = await fetch(alvo.toString(), { headers: { Authorization: `Bearer ${token}` } });
    const texto = await r.text();
    if (!r.ok) {
      return json({ success: false, error: `Google ${r.status}`, detalhe: texto.slice(0, 300) }, 502);
    }
    const resposta = JSON.parse(texto || "{}");

    // --- parte 3: formatar (era o nó "Function - Format Category Response") ---
    const brutas = Array.isArray(resposta.categories) ? resposta.categories : [];
    const categorias = brutas.map((c: any) => ({
      categoryId: c.categoryId || c.name || null,
      id: c.name || c.categoryId || null,
      displayName: c.displayName || c.name || c.categoryId || "",
      serviceTypes: c.serviceTypes || [],
      moreHoursTypes: c.moreHoursTypes || [],
      raw: c,
    })).filter((c: any) => c.displayName);

    return json({
      success: true,
      source: "google-business-profile-api",
      total: categorias.length,
      categories: categorias,
      nextPageToken: resposta.nextPageToken || null,
      consulta: { busca, regionCode, languageCode, pageSize },
      timestamp: new Date().toISOString(),
    });
  } catch (e) {
    return json({ success: false, error: (e as Error).message }, 500);
  }
});
