# Handoff para o Dev — gbp-propaga

## Contexto

O projeto foi reconstruído a partir de um repositório incompleto (arquivos de páginas, contextos,
serviços e componentes UI estavam ausentes). O código agora está funcional e buildando sem erros.

---

## Stack

- React 18 + TypeScript
- Vite
- Tailwind CSS + shadcn/ui
- Supabase (auth + banco de dados)
- n8n (automação via webhooks)
- React Router v6
- React Hook Form + Zod

---

## Como rodar localmente

```bash
git clone https://github.com/pquadrado/gbp-propaga
cd gbp-propaga
npm install
npm run dev
# Acesse http://localhost:8080
```

---

## Variáveis de ambiente (.env)

O arquivo `.env` já está no repositório com as seguintes variáveis:

```
VITE_SUPABASE_PROJECT_ID=fljcywbqzzakwgzyguvl
VITE_SUPABASE_PUBLISHABLE_KEY=eyJ...
VITE_SUPABASE_URL=https://fljcywbqzzakwgzyguvl.supabase.co
```

> Atenção: o .env está no repo pois é um projeto privado. Para produção, configure as variáveis
> diretamente na plataforma de deploy (Vercel, etc.) e remova o .env do repositório.

---

## Supabase

**Projeto:** https://supabase.com/dashboard/project/fljcywbqzzakwgzyguvl

### Autenticação

O sistema usa uma tabela de controle de acesso. Somente emails cadastrados em `authorized_users`
podem criar conta na plataforma.

**Para adicionar um novo usuário:**

1. Inserir o email na tabela (SQL Editor do Supabase):
```sql
INSERT INTO public.authorized_users (email, name, role)
VALUES ('email@exemplo.com', 'Nome', 'admin');
```

2. Criar o usuário em:
   Authentication → Users → Add user → Create new user

### Tabelas existentes

| Tabela | Descrição |
|---|---|
| `authorized_users` | Emails autorizados a criar conta |
| `directory_channels` | Diretórios disponíveis para sincronização (carregados no formulário) |
| `sync_logs` | Logs de sincronização gravados pelo n8n |

> Verificar se a tabela `directory_channels` está populada. Se estiver vazia, o passo 6 do
> formulário (seleção de canais) não vai exibir nenhum diretório.

---

## n8n

**Base URL:** `https://webhook.pquadrado.com.br`

### Workflows

| Workflow | Arquivo | Webhook | Status |
|---|---|---|---|
| Importação GBP | `n8n/gbp-propaga.json` | `GET /webhook/p2/gbp/import` | Com problema |
| Sincronização | `n8n/buz-propaga.json` | `POST /webhook/p2/business-profile/sync` | A verificar |

### Problema identificado: importação do Google

O endpoint `GET https://webhook.pquadrado.com.br/webhook/p2/gbp/import` não está respondendo.

**Verificar no n8n:**
- O workflow `gbp-propaga` está com status **Active**?
- As credenciais **Google Business Profile OAuth2** estão configuradas e válidas?
- O token do Google não expirou?

**Fluxo do workflow gbp-propaga:**
1. Webhook recebe GET
2. Busca contas na API do Google (`mybusinessaccountmanagement.googleapis.com`)
3. Busca localizações (`mybusinessbusinessinformation.googleapis.com`)
4. Enriquece endereço via ViaCEP
5. Retorna JSON com array `locations`

### Workflow de sincronização (buz-propaga)

Recebe POST com dados do formulário e roteia para cada canal:
- **google** → Google Business Profile API (PATCH)
- **facebook** → Facebook Graph API (POST)
- **apple** → Apple Business Connect API (POST)
- **outros** → envio de email via Gmail (SMTP)

**Verificar:**
- Credenciais do Google, Facebook, Gmail configuradas no n8n?
- Workflow `buz-propaga` está **Active**?

---

## Arquitetura de rotas

| Rota | Página | Autenticação |
|---|---|---|
| `/auth` | Login / Criar conta | Pública |
| `/` | Lista de empresas | Requer login |
| `/form` | Formulário de sincronização | Requer login |
| `/panel/:locationId` | Painel de diretórios da empresa | Requer login |

---

## O que foi reconstruído

Todos esses arquivos estavam ausentes no repositório original e foram recriados:

```
vite.config.ts
tsconfig.json / tsconfig.app.json / tsconfig.node.json
tailwind.config.ts
src/main.tsx
src/index.css
src/lib/utils.ts
src/types/business-profile.ts
src/integrations/supabase/client.ts
src/services/sync-service.ts
src/hooks/use-toast.ts
src/hooks/use-mobile.tsx
src/contexts/AuthContext.tsx
src/pages/Auth.tsx
src/pages/NotFound.tsx
src/pages/Index.tsx
src/pages/LocationSelector.tsx
src/pages/DirectoryPanel.tsx
src/components/ui/* (21 componentes shadcn)
```

---

## Deploy (recomendado: Vercel)

```bash
npm install -g vercel
vercel
```

Configurar as variáveis de ambiente no painel da Vercel:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`
- `VITE_SUPABASE_PROJECT_ID`

---

## Pendências prioritárias

1. **[CRITICO] n8n — workflow gbp-propaga inativo ou credencial Google expirada**
   - Sem isso, a importação do Google Meu Negócio não funciona
   - A tela inicial fica sem empresas

2. **[CRITICO] Verificar tabela `directory_channels` no Supabase**
   - Se vazia, o passo de seleção de canais no formulário não exibe nada
   - Popular com os diretórios desejados

3. **[MEDIO] Verificar workflow buz-propaga**
   - Testar uma sincronização completa após corrigir o item 1
   - Confirmar que emails estão sendo enviados para diretórios que exigem isso

4. **[MEDIO] Deploy em produção**
   - Publicar via Vercel ou Netlify
   - Configurar domínio customizado se necessário
   - Remover .env do repositório e usar variáveis de ambiente da plataforma

5. **[BAIXO] Pasta `@/` na raiz do projeto**
   - O shadcn criou arquivos duplicados em uma pasta `@/` na raiz (artefato do processo de reconstrução)
   - Pode ser deletada com segurança: `rm -rf @/`

---

## Contato / Contexto adicional

- Supabase: acesso via conta da agência em supabase.com
- n8n: instância própria em webhook.pquadrado.com.br
- GitHub: repositório privado em github.com/pquadrado/gbp-propaga
