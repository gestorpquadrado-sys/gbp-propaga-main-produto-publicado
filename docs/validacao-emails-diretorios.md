# Validação de emails dos diretórios no n8n

Este documento ensina, passo a passo, como verificar se os emails usados no fluxo
de propagação do n8n (`buz-propaga.json`) são realmente válidos e corretos.

O objetivo é garantir que cada diretório receba os emails de cadastro/atualização
das empresas, evitando que mensagens sejam enviadas para endereços inexistentes,
errados ou desatualizados.

---

## O que são esses emails?

Quando o sistema envia os dados de uma empresa para diretórios que não possuem API
(como Apontador, Guia Mais, TripAdvisor etc.), ele envia um **email automático**
para o endereço de contato daquele diretório.

Esses emails estão configurados dentro do node **Function - Email Directory Router**
no workflow `n8n/buz-propaga.json`.

---

## Lista completa de emails configurados

### Brasil

| Diretório          | Email configurado                        | Idioma |
|--------------------|------------------------------------------|--------|
| Apontador          | cadastro@apontador.com.br                | pt-BR  |
| Guia Mais          | contato@guiamais.com.br                  | pt-BR  |
| Telelistas         | cadastro@telelistas.net                  | pt-BR  |
| Achei Aqui         | contato@acheiaqui.com.br                 | pt-BR  |
| Saipos             | comercial@saipos.com                     | pt-BR  |
| Encontra Brasil    | cadastro@encontrabrasil.com.br           | pt-BR  |
| Guia SP            | cadastro@guiasp.com.br                   | pt-BR  |
| iFood              | restaurantes@ifood.com.br                | pt-BR  |
| Rappi              | restaurantes@rappi.com.br                | pt-BR  |
| GetNinjas          | profissionais@getninjas.com.br           | pt-BR  |
| Habitissimo        | profissionais@habitissimo.com.br         | pt-BR  |
| Viva Real          | anunciantes@vivareal.com.br              | pt-BR  |
| ZAP Imóveis        | anuncie@zapimoveis.com.br                | pt-BR  |
| Doctoralia         | medicos@doctoralia.com.br                | pt-BR  |
| Consulta Remédios  | farmacias@consultaremedios.com.br        | pt-BR  |

### Global

| Diretório          | Email configurado                        | Idioma |
|--------------------|------------------------------------------|--------|
| Booking.com        | partner.help@booking.com                 | en-US  |
| TripAdvisor        | ownercenter@tripadvisor.com              | en-US  |
| Bing Places        | placesfeedback@microsoft.com             | en-US  |
| HERE WeGo          | mapfeedback@here.com                     | en-US  |
| TomTom             | places@tomtom.com                        | en-US  |
| Waze               | support@waze.com                         | en-US  |
| MapQuest           | feedback@mapquest.com                    | en-US  |
| Yelp               | restaurantsupport@yelp.com               | en-US  |
| Foursquare         | support@foursquare.com                   | en-US  |
| Whitepages         | businesslistings@whitepages.com          | en-US  |
| Manta              | hello@manta.com                          | en-US  |
| OpenTable          | restaurants@opentable.com                | en-US  |
| Zomato             | restaurant@zomato.com                    | en-US  |
| Houzz              | pro@houzz.com                            | en-US  |
| Angie's List       | businessowners@angieslist.com            | en-US  |
| HomeAdvisor        | prosupport@homeadvisor.com               | en-US  |

---

## Passo a passo: como validar cada email

### Etapa 1 - Verificar se o domínio existe

Antes de tudo, confirme que o site do diretório ainda existe e está no ar.

1. Abra o navegador.
2. Acesse o site do diretório (ex: `https://www.apontador.com.br`).
3. Se o site abrir normalmente, o domínio é válido. Se der erro 404, página em
   branco ou redirecionamento estranho, o diretório pode ter sido descontinuado.

**Repita para cada diretório da lista acima.**

### Etapa 2 - Verificar se o email existe (MX lookup)

Mesmo que o site exista, o email pode estar errado. Para verificar:

1. Acesse uma ferramenta online gratuita de verificação de email. Sugestões:
   - https://email-checker.net
   - https://www.verifyemailaddress.org
   - https://hunter.io/email-verifier
2. Cole o email do diretório (ex: `cadastro@apontador.com.br`).
3. Clique em "Verificar" ou "Verify".
4. Analise o resultado:
   - **Valid / Deliverable**: o email existe e pode receber mensagens.
   - **Invalid / Undeliverable**: o email não existe ou rejeita mensagens.
   - **Risky / Unknown**: incerto; requer verificação manual.

**Anote o resultado de cada email em uma planilha.**

### Etapa 3 - Verificar o email correto no site oficial

Muitos diretórios mudam seus emails de contato com o tempo. Para encontrar o
email atualizado:

1. Acesse o site oficial do diretório.
2. Procure por páginas como:
   - "Contato" / "Contact"
   - "Para empresas" / "For Business"
   - "Cadastre sua empresa" / "Add your business"
   - "Parcerias" / "Partnerships"
3. Anote o email que aparece nessas páginas.
4. Compare com o email configurado no n8n.
5. Se forem diferentes, o email no n8n precisa ser atualizado.

### Etapa 4 - Verificar se o diretório aceita cadastro por email

Alguns diretórios podem ter mudado a forma de cadastro. Eles podem agora exigir:
- Cadastro via formulário online (sem email).
- Cadastro via painel próprio.
- Parceria comercial (contrato).

Se o diretório não aceitar mais email, você pode:
1. Marcar esse diretório como "manual" na documentação.
2. Remover do fluxo automático no n8n.
3. Ou substituir pelo formulário online, se o n8n suportar.

### Etapa 5 - Enviar um email de teste

Para ter certeza absoluta de que o email funciona:

1. Abra seu email pessoal ou corporativo.
2. Envie um email simples para o endereço do diretório.
   - Assunto: "Teste de contato - verificação de email"
   - Corpo: "Olá, estou verificando se este é o canal correto para cadastro
     de empresas. Podem confirmar?"
3. Aguarde 1-3 dias úteis.
4. Analise o resultado:
   - **Resposta recebida**: email válido e monitorado.
   - **Bounce (email devolvido)**: email inválido. Verifique o erro.
   - **Sem resposta após 5 dias**: pode ser válido mas não monitorado, ou pode
     ser uma caixa genérica. Considere buscar alternativa.

---

## Como atualizar um email no n8n

Se você descobrir que um email está errado, siga estes passos:

1. Abra o n8n.
2. Acesse o workflow **buz-propaga**.
3. Clique no node **Function - Email Directory Router**.
4. No código, localize o diretório. Exemplo:

```javascript
'apontador': {
  name: 'Apontador',
  country: 'BR',
  email: 'cadastro@apontador.com.br',     // <-- altere aqui
  subject: 'Solicitação de Cadastro/Atualização - {name}',
  language: 'pt-BR'
},
```

5. Substitua o valor de `email` pelo endereço correto.
6. Salve o node.
7. Salve o workflow.
8. Faça um teste enviando para esse diretório específico.

---

## Planilha modelo para controle

Use esta estrutura para organizar os resultados da validação:

| Diretório       | Email atual                   | Site ativo? | Email válido? | Email correto (site)? | Aceita email? | Teste enviado? | Resultado     | Ação necessária |
|-----------------|-------------------------------|-------------|---------------|-----------------------|---------------|----------------|---------------|-----------------|
| Apontador       | cadastro@apontador.com.br     | Sim/Não     | Sim/Não       | Sim/Não               | Sim/Não       | Sim/Não        | ok/bounce/... | Nenhuma/Atualizar |
| Guia Mais       | contato@guiamais.com.br       |             |               |                       |               |                |               |                 |
| ...             | ...                           |             |               |                       |               |                |               |                 |

---

## Frequência recomendada de validação

- **A cada 3 meses**: verificar se os sites ainda existem.
- **A cada 6 meses**: refazer o teste de envio de email.
- **Imediatamente**: quando um bounce for detectado nos logs do n8n.

---

## Como detectar bounces no n8n

Quando um email "volta" (bounce), o node de envio pode registrar um erro.

1. No n8n, abra o histórico de execuções do workflow **buz-propaga**.
2. Procure execuções com status de erro.
3. Clique na execução e veja o node **Send Email**.
4. Se a mensagem de erro mencionar "rejected", "bounced", "undeliverable" ou
   "mailbox not found", o email é inválido.
5. Atualize o email seguindo o passo a passo da seção anterior.

---

## Resumo rápido

1. Acesse o site do diretório para ver se ainda existe.
2. Use uma ferramenta online para verificar se o email é válido.
3. Confira no site oficial qual é o email correto de cadastro.
4. Envie um email de teste para confirmar.
5. Se estiver errado, atualize no node **Function - Email Directory Router** do n8n.
6. Repita a cada 3-6 meses.
