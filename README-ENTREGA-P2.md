# GBP Propaga / P² Local Listings — entrega técnica

Esta versão foi organizada para a arquitetura Vercel + Supabase + n8n.

## O que foi adicionado

- Schema completo do Supabase em `supabase/migrations/20260528190000_complete_schema.sql`.
- `.env.example` com variáveis necessárias para Vercel.
- Cliente Supabase com fallback para `VITE_SUPABASE_ANON_KEY` ou `VITE_SUPABASE_PUBLISHABLE_KEY`.
- Endpoints de n8n configuráveis por variável de ambiente.
- Persistência dos perfis importados em `companies` e `google_locations`.
- Persistência de resultados em `directory_submissions`.
- Geração de página pública publicada em `directory_pages`.
- Página pública `/empresa/:slug`.
- Formulário de cadastro com nome, empresa e WhatsApp.

## Como testar localmente

```bash
cp .env.example .env
npm ci
npm run dev
```

Preencha o `.env` com as chaves reais do Supabase e endpoints do n8n.

## Como preparar o Supabase

1. Crie um projeto no Supabase.
2. Abra o SQL Editor.
3. Rode o conteúdo de `supabase/migrations/20260528190000_complete_schema.sql`.
4. No painel Authentication, configure as URLs autorizadas:
   - Local: `http://localhost:5173`
   - Produção: `https://diretorios.pquadrado.com.br`

## Variáveis para Vercel

```env
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
VITE_GBP_IMPORT_ENDPOINT=
VITE_SYNC_WEBHOOK_ENDPOINT=
VITE_PUBLIC_BASE_URL=
```

## Webhooks esperados no n8n

### Importação Google Business Profile

Método: `GET`

Endpoint:

```txt
VITE_GBP_IMPORT_ENDPOINT
```

Resposta esperada:

```json
{
  "success": true,
  "total": 1,
  "locations": []
}
```

### Sincronização/propagação

Método: `POST`

Endpoint:

```txt
VITE_SYNC_WEBHOOK_ENDPOINT
```

Payload: objeto `BusinessProfile`.

Resposta esperada:

```json
{
  "success": true,
  "sync_id": "abc123",
  "timestamp": "2026-05-28T00:00:00.000Z",
  "results": {
    "google": { "status": "success", "message": "OK" },
    "facebook": { "status": "sent", "message": "Email enviado" }
  }
}
```

## Deploy recomendado

- Frontend: Vercel conectado ao GitHub.
- Banco/Auth: Supabase.
- Automações: n8n em domínio próprio.
- Domínio final: `diretorios.pquadrado.com.br` apontando para Vercel.

## Observações importantes

- Não exponha `SUPABASE_SERVICE_ROLE_KEY` no frontend.
- O n8n deve validar token/Authorization antes de executar webhooks em produção.
- O fluxo atual de GBP ainda precisa ser protegido e preparado para múltiplas contas Google.
