# Ajustes aplicados neste pacote

1. O formulário não seleciona mais Google/Facebook por padrão.
   - Agora os canais padrão são: apontador, bing e yelp.

2. O payload enviado ao webhook de sincronização agora inclui identificadores necessários:
   - company_id
   - location_id
   - user_id
   - google_location_id
   - google_place_id
   - facebook_page_id

3. Perfis importados do Google Meu Negócio agora preservam os IDs internos do Supabase:
   - id da tabela google_locations
   - company_id
   - user_id

4. O google_location_id agora é normalizado.
   - Se vier apenas o número, vira locations/NUMERO.
   - Se já vier locations/NUMERO, é mantido.

5. Foi adicionado campo "Facebook Page ID" na etapa de contato.
   - Esse campo é necessário se o canal Facebook for selecionado.

6. O build foi testado com sucesso com npm run build.

Observação:
- Para o canal Google funcionar, o n8n precisa aceitar google_location_id no formato locations/ID.
- Para o canal Facebook funcionar, o n8n precisa receber facebook_page_id e a credencial Meta precisa ter permissão de edição da página.
