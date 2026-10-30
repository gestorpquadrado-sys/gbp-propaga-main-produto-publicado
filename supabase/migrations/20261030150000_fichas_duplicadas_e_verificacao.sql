-- Duas correções de 30/10/2026.
--
-- 1. FICHAS DUPLICADAS
-- A Labitec tinha DUAS linhas em google_locations para a MESMA localização do Google,
-- gravadas com o id em formatos diferentes: `11747093895826954966` e
-- `locations/11747093...`. A API do GBP devolve `name` com ou sem o prefixo dependendo
-- do endpoint, e a gbp-import gravava cru.
--
-- Como a restrição de directory_submissions é UNIQUE (user_id, location_id,
-- channel_code), duas fichas significavam DUAS submissões por canal — 38 no total para
-- uma empresa que devia ter 19. O upsert estava correto; o defeito era a montante.
--
-- As fichas foram fundidas à mão (a sobrevivente é a que tinha a página publicada) e a
-- gbp-import passou a normalizar o id. Este índice impede a recorrência: a mesma
-- localização não entra duas vezes, qualquer que seja o formato.
create unique index if not exists google_locations_usuario_gbp_normalizado_idx
  on public.google_locations (user_id, regexp_replace(google_location_id, '^locations/', ''))
  where google_location_id is not null;

-- 2. LEITURA PÚBLICA DA PÁGINA DA EMPRESA
-- /empresa/<slug> é pública por desenho, mas nenhuma tabela tinha política para `anon`:
-- havia 27 páginas com status='published' que só o dono conseguia abrir.
--
-- A liberação é escopada ao que foi deliberadamente publicado, e as submissões só
-- aparecem quando CONFIRMADAS — a página do cliente não promete o que está pendente.
create policy if not exists directory_pages_publicas on public.directory_pages
  for select to anon using (status = 'published');

create policy if not exists companies_de_pagina_publicada on public.companies
  for select to anon using (exists (
    select 1 from public.directory_pages p
     where p.company_id = companies.id and p.status = 'published'));

create policy if not exists google_locations_de_pagina_publicada on public.google_locations
  for select to anon using (exists (
    select 1 from public.directory_pages p
     where p.location_id = google_locations.id and p.status = 'published'));

create policy if not exists submissoes_confirmadas_publicas on public.directory_submissions
  for select to anon using (
    verification_status = 'found_online' and profile_url is not null
    and exists (select 1 from public.directory_pages p
                 where p.company_id = directory_submissions.company_id
                   and p.status = 'published'));

create policy if not exists directory_channels_publico on public.directory_channels
  for select to anon using (true);
