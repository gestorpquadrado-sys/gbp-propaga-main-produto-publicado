# Ajuste: Google e Facebook como fontes de dados, não diretórios

Google Business Profile e Facebook/Meta não devem aparecer na etapa de propagação.

Motivo: esses canais normalmente são os perfis principais já gerenciados manualmente pela empresa. O projeto usa Google/Facebook para importar dados, obter IDs e identificar a empresa, mas a propagação deve acontecer nos diretórios externos.

## O que foi alterado

- Google e Facebook foram removidos da lista selecionável de canais de propagação.
- A tela de Canais filtra `google` e `facebook`, mesmo que eles existam no Supabase.
- Foi criada a migration `20260609193000_google_facebook_provider_only.sql` para marcar esses canais como inativos/reference no banco.
- O n8n dinâmico também deve ignorar `google` e `facebook`, caso sejam enviados por payload antigo.

## Importante

Continue usando o workflow `gbp-propaga` para importar dados do Google Meu Negócio.
Não use `google` e `facebook` dentro de `channels` para propagação.
