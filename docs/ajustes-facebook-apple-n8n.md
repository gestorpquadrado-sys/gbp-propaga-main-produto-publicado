# Ajustes do fluxo n8n para Facebook e Apple

Este documento descreve, de forma detalhada e didática, os ajustes necessários
para fazer os fluxos de Facebook e Apple funcionarem no workflow
`n8n/buz-propaga.json`.

## Objetivo
Garantir que os canais **Facebook** e **Apple** consigam receber o envio e
retornar status válidos no response do n8n (`success` ou `error`).

## Contexto rápido do fluxo
O workflow `buz-propaga.json` faz:
1) Recebe dados via webhook.
2) Valida e normaliza o payload.
3) Divide por canal.
4) Envia para cada diretório (Google/Facebook/Apple/Email).
5) Retorna o status agregado.

Os nós específicos de Facebook e Apple já existem, mas dependem de credenciais
e campos obrigatórios.

## Ajustes necessários para Facebook

### 1) Garantir que o payload envie `facebook_page_id`
O node de Facebook chama este endpoint:

```
https://graph.facebook.com/v19.0/{{ $json.facebook_page_id }}
```

Se `facebook_page_id` estiver vazio, o request falha.

**Como garantir isso:**
1. Verifique no sistema de origem se a empresa tem `facebook_page_id`.
2. No payload do sync (frontend), envie `facebook_page_id` quando existir.
3. Confirme no n8n, no node **Function - Validate Input**, se o campo está chegando.

### 2) Configurar credencial válida do Facebook Graph API
O node usa a credencial `Graph API Meta - Page`.

**Passos recomendados:**
1. No Facebook Developer, crie/valide um App.
2. Gere um **Page Access Token** válido.
3. Adicione as permissões necessárias ao token:
   - `pages_manage_metadata`
   - `pages_read_engagement`
   - `pages_manage_posts`
   - `business_management` (se exigido pelo endpoint)
4. No n8n, edite a credencial **Graph API Meta - Page** e cole o token.
5. Teste o node **HTTP Request - Facebook API** isoladamente.

### 3) Validar os campos obrigatórios do Facebook
O node usa campos básicos:
- `name`
- `phone_primary`
- `address_street`
- `address_city`
- `address_state`
- `address_zip`

Se algum campo faltar, o endpoint pode retornar erro.

## Ajustes necessários para Apple

### 1) Habilitar autenticação no request
O endpoint da Apple Business Connect exige **JWT** no header:

```
Authorization: Bearer <token>
```

Atualmente o node **HTTP Request - Apple** não possui autenticação.

**Como gerar o JWT:**
1. Acesse Apple Business Connect.
2. Gere uma chave privada (p. ex. `.p8`).
3. Anote:
   - `TEAM_ID`
   - `KEY_ID`
   - `ISSUER_ID`
4. Gere o JWT conforme a documentação da Apple.
5. Adicione o header `Authorization: Bearer <token>` no node HTTP.

### 2) Diferenciar POST vs PUT
Hoje o fluxo sempre faz `POST` para:
```
https://businessconnect.apple.com/api/v1/locations
```

Mas já existe a lógica:
```
apple_location_id: data.apple_location_id || 'NEW'
```

**O que falta:**
1. Se `apple_location_id === 'NEW'`, usar `POST` (criar).
2. Se houver um `apple_location_id`, usar `PUT` (atualizar).
3. Para `PUT`, o endpoint muda para:
   ```
   https://businessconnect.apple.com/api/v1/locations/{apple_location_id}
   ```

### 3) Validar os campos obrigatórios da Apple
Os campos básicos enviados hoje são:
- `name`
- `address_street`, `address_number`
- `address_city`, `address_state`, `address_zip`
- `phone_primary`
- `website`

Confirme se a Apple exige campos adicionais conforme o país.

## Como testar (passo a passo)

### Facebook
1. No n8n, execute o node **Function - Prepare Facebook Payload** com dados reais.
2. Verifique se `facebook_page_id` está presente.
3. Execute o node **HTTP Request - Facebook API**.
4. Valide `statusCode` e resposta.
5. Execute o node **Function - Process Facebook Response**.
6. Confira o resultado final no **Respond to Webhook**.

### Apple
1. Gere um JWT válido para Apple Business Connect.
2. Configure o header `Authorization: Bearer <token>` no node Apple.
3. Teste com `POST` (sem `apple_location_id`).
4. Teste com `PUT` usando um `apple_location_id` existente.
5. Verifique o `statusCode` e o retorno.

## Como confirmar que o status está correto
O status agregado é montado no node que reduz os resultados:
- `success` ou `sent` contam como enviados.
- `error` indica falha.

Se o Facebook ou Apple estiverem falhando, o painel mostrará **Erro**.

## Troubleshooting rápido

**Facebook**
- `OAuthException` ou `(#100)` → falta permissão ou token inválido.
- `Unsupported get request` → `facebook_page_id` errado.

**Apple**
- `401 Unauthorized` → JWT inválido ou expirado.
- `403 Forbidden` → conta sem permissão ou recurso não autorizado.
- `400 Bad Request` → payload inválido (campos obrigatórios faltando).

## Checklist final
- [ ] `facebook_page_id` chega no payload.
- [ ] Token do Graph API válido com permissões.
- [ ] JWT configurado no node Apple.
- [ ] POST/PUT correto para Apple.
- [ ] Status aparece como `success` no response final.

## Nota temporária no painel
Enquanto os fluxos de Facebook e Apple não estiverem concluídos no n8n, o painel
considera **Facebook** e **Apple** como **Enviado** para todas as empresas.

Quando os ajustes deste documento forem implementados, essa regra deve ser removida
para que o status passe a refletir o retorno real do n8n.

