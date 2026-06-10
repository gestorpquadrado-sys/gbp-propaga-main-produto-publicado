# Ajustes — Diretórios ampliados e verificação de atividade

## O que foi adicionado

1. Nova migration Supabase:
   - `supabase/migrations/20260608152000_directory_catalog_health.sql`
   - amplia `directory_channels` com metadados de país, região, segmento, tipo de envio, URL, API, login, revisão manual, plano pago e prioridade;
   - cria `directory_channel_checks` para histórico de verificações;
   - insere uma base ampliada de diretórios Brasil + globais + segmentos.

2. Novo workflow n8n:
   - `n8n/p2-directory-channels-health-check.json`
   - endpoint: `GET /webhook/p2/directory-channels/check`
   - verifica `website_url` dos diretórios e atualiza:
     - `is_active`
     - `last_checked_at`
     - `last_check_status`
     - `last_check_http_status`
     - `last_check_message`

3. A tela de Canais agora mostra metadados:
   - país/região
   - método de envio: API, email, formulário, manual, parceiro
   - status de verificação
   - última verificação
   - se exige login, revisão manual ou plano pago

4. Diretórios inativos deixam de aparecer automaticamente porque a tela já busca apenas:
   - `is_active = true`

## Variáveis necessárias no n8n

Configure no ambiente do n8n:

```env
SUPABASE_URL=https://SEU_PROJETO.supabase.co
SUPABASE_SERVICE_ROLE_KEY=SUA_SERVICE_ROLE_KEY
```

Use `service_role` somente no n8n/backend. Nunca coloque essa chave na Vercel/frontend.

## Como testar o verificador

Depois de importar e ativar o workflow:

```txt
https://webhook.pquadrado.com.br/webhook/p2/directory-channels/check?limit=20
```

Modo padrão é seguro: não desativa por 403, 429 ou erro temporário.

Para modo mais rígido:

```txt
https://webhook.pquadrado.com.br/webhook/p2/directory-channels/check?limit=20&mode=strict
```

## Observação importante

Não existe uma fonte oficial única com todos os diretórios ativos do Brasil e do mundo. A base criada é uma base ampliada e operacional. O verificador ajuda a manter a lista limpa, removendo da tela os canais que forem marcados como inativos.
