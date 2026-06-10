-- Diretórios ampliados + auditoria de status.
-- Rode no Supabase depois do schema base. Não remove dados existentes.

alter table public.directory_channels add column if not exists country text default 'GLOBAL';
alter table public.directory_channels add column if not exists region text;
alter table public.directory_channels add column if not exists segment text;
alter table public.directory_channels add column if not exists submission_type text not null default 'email';
alter table public.directory_channels add column if not exists email_to text;
alter table public.directory_channels add column if not exists website_url text;
alter table public.directory_channels add column if not exists api_available boolean not null default false;
alter table public.directory_channels add column if not exists api_type text;
alter table public.directory_channels add column if not exists requires_login boolean not null default false;
alter table public.directory_channels add column if not exists requires_manual_review boolean not null default true;
alter table public.directory_channels add column if not exists requires_paid_plan boolean not null default false;
alter table public.directory_channels add column if not exists priority int default 999;
alter table public.directory_channels add column if not exists last_checked_at timestamptz;
alter table public.directory_channels add column if not exists last_check_status text not null default 'unknown';
alter table public.directory_channels add column if not exists last_check_http_status int;
alter table public.directory_channels add column if not exists last_check_message text;
alter table public.directory_channels add column if not exists notes text;

create table if not exists public.directory_channel_checks (
  id uuid primary key default gen_random_uuid(),
  channel_code text not null,
  checked_at timestamptz not null default now(),
  status text not null default 'unknown',
  http_status int,
  message text,
  raw_response jsonb not null default '{}'::jsonb
);

create index if not exists directory_channels_active_priority_idx on public.directory_channels(is_active, priority, name);
create index if not exists directory_channel_checks_code_date_idx on public.directory_channel_checks(channel_code, checked_at desc);

with catalog(code, name, country, region, segment, submission_type, email_to, website_url, api_available, api_type, requires_login, requires_manual_review, requires_paid_plan, priority, icon, categories, description) as (
values
  ('google', 'Google Business Profile', 'GLOBAL', 'GLOBAL', 'general', 'api', null, 'https://business.google.com', true, 'official_api', true, false, false, 1, '🔍', array['all','general']::text[], 'Atualização via Google Business Profile API.'),
  ('facebook', 'Facebook Pages', 'GLOBAL', 'GLOBAL', 'general', 'api', null, 'https://www.facebook.com/pages/create', true, 'graph_api', true, false, false, 2, '📘', array['all','general']::text[], 'Atualização via Meta Graph API quando houver Page ID.'),
  ('apple', 'Apple Business Connect', 'GLOBAL', 'GLOBAL', 'general', 'api', null, 'https://businessconnect.apple.com', true, 'official_api', true, true, false, 3, '🍎', array['all','general']::text[], 'Presença no Apple Maps e ecossistema Apple.'),
  ('bing', 'Bing Places', 'GLOBAL', 'GLOBAL', 'general', 'email', 'bingplaces@microsoft.com', 'https://www.bingplaces.com', false, 'restricted_api', true, true, false, 4, '🅱️', array['all','general']::text[], 'Presença local no Bing/Microsoft.'),
  ('waze', 'Waze', 'GLOBAL', 'GLOBAL', 'maps', 'form', null, 'https://www.waze.com/editor', false, null, true, true, false, 5, '🚗', array['all','general','automotive']::text[], 'Atualização por comunidade/editor do Waze.'),
  ('here', 'HERE WeGo', 'GLOBAL', 'GLOBAL', 'maps', 'email', 'mapfeedback@here.com', 'https://wego.here.com', false, null, false, true, false, 6, '🗺️', array['all','general']::text[], 'Base de mapas HERE.'),
  ('tomtom', 'TomTom', 'GLOBAL', 'GLOBAL', 'maps', 'email', 'places@tomtom.com', 'https://www.tomtom.com/mapshare/tools/new/mapshare/', false, null, false, true, false, 7, '🧭', array['all','general']::text[], 'Base de mapas TomTom.'),
  ('mapquest', 'MapQuest', 'GLOBAL', 'GLOBAL', 'maps', 'email', 'feedback@mapquest.com', 'https://www.mapquest.com', false, null, false, true, false, 8, '🗺️', array['all','general']::text[], 'Diretório/mapas MapQuest.'),
  ('foursquare', 'Foursquare', 'GLOBAL', 'GLOBAL', 'general', 'email', 'support@foursquare.com', 'https://foursquare.com', false, 'partner_api', true, true, false, 9, '📍', array['all','general','restaurants','retail']::text[], 'Presença em Foursquare.'),
  ('yelp', 'Yelp', 'GLOBAL', 'GLOBAL', 'general', 'email', 'support@yelp.com', 'https://biz.yelp.com', false, null, true, true, false, 10, '📍', array['all','general','restaurants','services','beauty']::text[], 'Perfil comercial no Yelp.'),
  ('tripadvisor', 'Tripadvisor', 'GLOBAL', 'GLOBAL', 'restaurants', 'email', 'ownercenter@tripadvisor.com', 'https://www.tripadvisor.com/Owners', false, null, true, true, false, 11, '🦉', array['restaurants','hotels']::text[], 'Perfis de restaurantes, atrações e hospedagem.'),
  ('opentable', 'OpenTable', 'GLOBAL', 'GLOBAL', 'restaurants', 'email', 'restaurants@opentable.com', 'https://restaurant.opentable.com', false, null, true, true, true, 12, '🍽️', array['restaurants']::text[], 'Restaurantes e reservas.'),
  ('thefork', 'TheFork', 'GLOBAL', 'GLOBAL', 'restaurants', 'form', null, 'https://www.theforkmanager.com', false, null, true, true, true, 13, '🍴', array['restaurants']::text[], 'Restaurantes e reservas.'),
  ('zomato', 'Zomato', 'GLOBAL', 'GLOBAL', 'restaurants', 'email', 'restaurant@zomato.com', 'https://www.zomato.com', false, null, true, true, false, 14, '🍛', array['restaurants']::text[], 'Diretório de restaurantes.'),
  ('yellowpages', 'Yellow Pages', 'GLOBAL', 'GLOBAL', 'general', 'email', 'support@yellowpages.com', 'https://www.yellowpages.com', false, null, true, true, false, 20, '📒', array['all','general']::text[], 'Diretório Yellow Pages.'),
  ('whitepages', 'Whitepages', 'GLOBAL', 'GLOBAL', 'general', 'email', 'businesslistings@whitepages.com', 'https://www.whitepages.com', false, null, true, true, false, 21, '📖', array['all','general']::text[], 'Diretório Whitepages.'),
  ('manta', 'Manta', 'GLOBAL', 'GLOBAL', 'general', 'email', 'hello@manta.com', 'https://www.manta.com', false, null, true, true, false, 22, '🏢', array['all','general','services']::text[], 'Diretório empresarial Manta.'),
  ('hotfrog', 'Hotfrog', 'GLOBAL', 'GLOBAL', 'general', 'form', null, 'https://www.hotfrog.com', false, null, true, true, false, 23, '🐸', array['all','general']::text[], 'Diretório empresarial Hotfrog.'),
  ('cylex', 'Cylex', 'GLOBAL', 'GLOBAL', 'general', 'form', null, 'https://www.cylex-international.com', false, null, true, true, false, 24, '🌐', array['all','general']::text[], 'Diretório internacional Cylex.'),
  ('brownbook', 'Brownbook', 'GLOBAL', 'GLOBAL', 'general', 'form', null, 'https://www.brownbook.net', false, null, true, true, false, 25, '📚', array['all','general']::text[], 'Diretório Brownbook.'),
  ('showmelocal', 'ShowMeLocal', 'GLOBAL', 'GLOBAL', 'general', 'form', null, 'https://www.showmelocal.com', false, null, true, true, false, 26, '📌', array['all','general']::text[], 'Diretório local ShowMeLocal.'),
  ('chamberofcommerce', 'Chamber of Commerce', 'USA', 'US', 'general', 'form', null, 'https://www.chamberofcommerce.com', false, null, true, true, false, 27, '🏛️', array['all','general']::text[], 'Diretório empresarial dos EUA.'),
  ('superpages', 'Superpages', 'USA', 'US', 'general', 'form', null, 'https://www.superpages.com', false, null, true, true, false, 28, '📒', array['all','general']::text[], 'Diretório Superpages.'),
  ('dexknows', 'DexKnows', 'USA', 'US', 'general', 'form', null, 'https://www.dexknows.com', false, null, true, true, false, 29, '📒', array['all','general']::text[], 'Diretório DexKnows.'),
  ('bbb', 'Better Business Bureau', 'USA', 'US', 'general', 'form', null, 'https://www.bbb.org', false, null, true, true, true, 30, '🛡️', array['all','general','services']::text[], 'Cadastro/acreditação BBB.'),
  ('nextdoor', 'Nextdoor', 'GLOBAL', 'GLOBAL', 'general', 'form', null, 'https://business.nextdoor.com', false, null, true, true, false, 31, '🏘️', array['all','general','services']::text[], 'Presença local no Nextdoor.'),
  ('europages', 'Europages', 'EU', 'EU', 'b2b', 'form', null, 'https://www.europages.com', false, null, true, true, false, 32, '🇪🇺', array['all','general','industrial','services']::text[], 'Diretório B2B europeu.'),
  ('kompass', 'Kompass', 'GLOBAL', 'GLOBAL', 'b2b', 'form', null, 'https://br.kompass.com', false, null, true, true, true, 33, '🌍', array['all','general','industrial','services']::text[], 'Diretório B2B internacional.'),
  ('tuugo', 'Tuugo', 'GLOBAL', 'GLOBAL', 'general', 'form', null, 'https://www.tuugo.com.br', false, null, true, true, false, 34, '🌐', array['all','general']::text[], 'Diretório Tuugo.'),
  ('apontador', 'Apontador', 'BR', 'BR', 'general', 'email', 'cadastro@apontador.com.br', 'https://www.apontador.com.br', false, null, false, true, false, 40, '📍', array['all','general']::text[], 'Diretório local brasileiro.'),
  ('guiamais', 'GuiaMais', 'BR', 'BR', 'general', 'email', 'contato@guiamais.com.br', 'https://www.guiamais.com.br', false, null, false, true, false, 41, '🗺️', array['all','general']::text[], 'Diretório nacional de empresas.'),
  ('telelistas', 'TeleListas', 'BR', 'BR', 'general', 'email', 'cadastro@telelistas.net', 'https://www.telelistas.net', false, null, false, true, false, 42, '📞', array['all','general']::text[], 'Diretório telefônico/comercial.'),
  ('acheiaqui', 'Achei Aqui', 'BR', 'BR', 'general', 'email', 'contato@acheiaqui.com.br', 'https://www.acheiaqui.com.br', false, null, false, true, false, 43, '📍', array['all','general']::text[], 'Diretório brasileiro Achei Aqui.'),
  ('encontrabrasil', 'Encontra Brasil', 'BR', 'BR', 'general', 'email', 'cadastro@encontrabrasil.com.br', 'https://www.encontrabrasil.com.br', false, null, false, true, false, 44, '🇧🇷', array['all','general']::text[], 'Guia comercial Encontra Brasil.'),
  ('guiasp', 'Guia SP', 'BR', 'SP', 'general', 'email', 'cadastro@guiasp.com.br', 'https://www.guiasp.com.br', false, null, false, true, false, 45, '📍', array['all','general']::text[], 'Guia comercial de São Paulo.'),
  ('solutudo', 'Solutudo', 'BR', 'BR', 'general', 'form', null, 'https://www.solutudo.com.br', false, null, true, true, false, 46, '🔎', array['all','general']::text[], 'Guia local Solutudo.'),
  ('guiafacil', 'Guia Fácil', 'BR', 'BR', 'general', 'form', null, 'https://www.guiafacil.com', false, null, true, true, false, 47, '📘', array['all','general']::text[], 'Guia Fácil.'),
  ('hagah', 'Hagah', 'BR', 'BR', 'general', 'form', null, 'https://www.hagah.com.br', false, null, true, true, false, 48, '📌', array['all','general']::text[], 'Guia local Hagah.'),
  ('guiadasemana', 'Guia da Semana', 'BR', 'BR', 'events', 'form', null, 'https://www.guiadasemana.com.br', false, null, true, true, false, 49, '🎟️', array['restaurants','hotels','events']::text[], 'Guia de lazer e eventos.'),
  ('catracalivre', 'Catraca Livre', 'BR', 'BR', 'events', 'manual', null, 'https://catracalivre.com.br', false, null, true, true, false, 50, '🎟️', array['events','restaurants']::text[], 'Canal editorial/manual para eventos e experiências.'),
  ('ifood', 'iFood', 'BR', 'BR', 'restaurants', 'email', 'restaurantes@ifood.com.br', 'https://parceiros.ifood.com.br', false, 'partner_api', true, true, true, 60, '🍔', array['restaurants']::text[], 'Cadastro de restaurantes no iFood.'),
  ('rappi', 'Rappi', 'BR', 'BR', 'restaurants', 'email', 'restaurantes@rappi.com.br', 'https://www.rappi.com.br/restaurantes', false, null, true, true, true, 61, '🛵', array['restaurants']::text[], 'Cadastro de restaurantes no Rappi.'),
  ('aiqfome', 'aiqfome', 'BR', 'BR', 'restaurants', 'form', null, 'https://www.aiqfome.com', false, null, true, true, true, 62, '🍕', array['restaurants']::text[], 'Marketplace de delivery.'),
  ('deliverymuch', 'Delivery Much', 'BR', 'BR', 'restaurants', 'form', null, 'https://www.deliverymuch.com.br', false, null, true, true, true, 63, '🍽️', array['restaurants']::text[], 'Marketplace de delivery.'),
  ('vivareal', 'Viva Real', 'BR', 'BR', 'real_estate', 'email', 'anunciantes@vivareal.com.br', 'https://www.vivareal.com.br', false, null, true, true, true, 70, '🏠', array['real_estate']::text[], 'Portal imobiliário Viva Real.'),
  ('zapimoveis', 'ZAP Imóveis', 'BR', 'BR', 'real_estate', 'email', 'anuncie@zapimoveis.com.br', 'https://www.zapimoveis.com.br', false, null, true, true, true, 71, '🏘️', array['real_estate']::text[], 'Portal imobiliário ZAP Imóveis.'),
  ('imovelweb', 'Imovelweb', 'BR', 'BR', 'real_estate', 'form', null, 'https://www.imovelweb.com.br', false, null, true, true, true, 72, '🏠', array['real_estate']::text[], 'Portal imobiliário Imovelweb.'),
  ('chavesnamao', 'Chaves na Mão', 'BR', 'BR', 'real_estate', 'form', null, 'https://www.chavesnamao.com.br', false, null, true, true, true, 73, '🔑', array['real_estate','automotive']::text[], 'Portal de imóveis e veículos.'),
  ('olximoveis', 'OLX Imóveis', 'BR', 'BR', 'real_estate', 'form', null, 'https://www.olx.com.br/imoveis', false, null, true, true, true, 74, '🏠', array['real_estate']::text[], 'Classificados de imóveis OLX.'),
  ('quintoandar', 'QuintoAndar', 'BR', 'BR', 'real_estate', 'partner', null, 'https://www.quintoandar.com.br', false, null, true, true, true, 75, '🏢', array['real_estate']::text[], 'Plataforma imobiliária QuintoAndar.'),
  ('doctoralia', 'Doctoralia', 'BR', 'BR', 'healthcare', 'email', 'medicos@doctoralia.com.br', 'https://www.doctoralia.com.br', false, null, true, true, true, 80, '⚕️', array['healthcare']::text[], 'Cadastro de profissionais de saúde.'),
  ('boaconsulta', 'BoaConsulta', 'BR', 'BR', 'healthcare', 'form', null, 'https://www.boaconsulta.com', false, null, true, true, true, 81, '🩺', array['healthcare']::text[], 'Busca e agendamento médico.'),
  ('catalogosaude', 'Catálogo Saúde', 'BR', 'BR', 'healthcare', 'form', null, 'https://www.catalogosaude.com.br', false, null, true, true, false, 82, '🧬', array['healthcare']::text[], 'Catálogo de saúde.'),
  ('consultaremedios', 'Consulta Remédios', 'BR', 'BR', 'healthcare', 'email', 'farmacias@consultaremedios.com.br', 'https://consultaremedios.com.br', false, null, true, true, true, 83, '💊', array['healthcare','retail']::text[], 'Farmácias e medicamentos.'),
  ('getninjas', 'GetNinjas', 'BR', 'BR', 'services', 'email', 'profissionais@getninjas.com.br', 'https://www.getninjas.com.br', false, null, true, true, true, 90, '🛠️', array['services']::text[], 'Marketplace de serviços.'),
  ('habitissimo', 'Habitissimo', 'BR', 'BR', 'construction', 'email', 'profissionais@habitissimo.com.br', 'https://www.habitissimo.com.br', false, null, true, true, true, 91, '🏗️', array['construction','services']::text[], 'Serviços de construção e reformas.'),
  ('houzz', 'Houzz', 'GLOBAL', 'GLOBAL', 'construction', 'email', 'pro@houzz.com', 'https://www.houzz.com', false, null, true, true, true, 92, '🏡', array['construction','services']::text[], 'Arquitetura, decoração e construção.'),
  ('homeadvisor', 'HomeAdvisor', 'USA', 'US', 'services', 'email', 'prosupport@homeadvisor.com', 'https://www.homeadvisor.com', false, null, true, true, true, 93, '🛠️', array['services','construction']::text[], 'Serviços residenciais.'),
  ('angieslist', 'Angi / Angie’s List', 'USA', 'US', 'services', 'email', 'businessowners@angieslist.com', 'https://www.angi.com', false, null, true, true, true, 94, '🛠️', array['services','construction']::text[], 'Serviços residenciais Angi.'),
  ('thumbtack', 'Thumbtack', 'USA', 'US', 'services', 'form', null, 'https://www.thumbtack.com', false, null, true, true, true, 95, '📌', array['services']::text[], 'Marketplace de serviços.'),
  ('bark', 'Bark', 'GLOBAL', 'GLOBAL', 'services', 'form', null, 'https://www.bark.com', false, null, true, true, true, 96, '🐶', array['services']::text[], 'Marketplace de serviços.'),
  ('booking', 'Booking.com', 'GLOBAL', 'GLOBAL', 'hotels', 'email', 'partner.help@booking.com', 'https://join.booking.com', false, null, true, true, true, 100, '🏨', array['hotels']::text[], 'Cadastro de propriedades/hospedagem.'),
  ('airbnb', 'Airbnb', 'GLOBAL', 'GLOBAL', 'hotels', 'form', null, 'https://www.airbnb.com.br/host/homes', false, null, true, true, false, 101, '🏡', array['hotels']::text[], 'Hospedagem e experiências.'),
  ('expedia', 'Expedia', 'GLOBAL', 'GLOBAL', 'hotels', 'form', null, 'https://join.expediapartnercentral.com', false, null, true, true, true, 102, '✈️', array['hotels']::text[], 'Cadastro de hospedagens na Expedia.'),
  ('hotelscom', 'Hotels.com', 'GLOBAL', 'GLOBAL', 'hotels', 'partner', null, 'https://www.hotels.com', false, null, true, true, true, 103, '🏨', array['hotels']::text[], 'Rede Expedia/Hotels.com.'),
  ('trivago', 'Trivago', 'GLOBAL', 'GLOBAL', 'hotels', 'form', null, 'https://studio.trivago.com', false, null, true, true, true, 104, '🏨', array['hotels']::text[], 'Metabusca de hotéis.'),
  ('hostelworld', 'Hostelworld', 'GLOBAL', 'GLOBAL', 'hotels', 'form', null, 'https://inbox.hostelworld.com', false, null, true, true, true, 105, '🛏️', array['hotels']::text[], 'Hospedagens e hostels.'),
  ('olx', 'OLX', 'BR', 'BR', 'retail', 'form', null, 'https://www.olx.com.br', false, null, true, true, false, 110, '🛍️', array['retail','automotive','real_estate']::text[], 'Classificados OLX.'),
  ('mercadolivre', 'Mercado Livre', 'BR', 'BR', 'retail', 'form', null, 'https://www.mercadolivre.com.br', false, null, true, true, true, 111, '🛒', array['retail']::text[], 'Marketplace Mercado Livre.'),
  ('shopee', 'Shopee', 'BR', 'BR', 'retail', 'form', null, 'https://seller.shopee.com.br', false, null, true, true, true, 112, '🛒', array['retail']::text[], 'Marketplace Shopee.'),
  ('webmotors', 'Webmotors', 'BR', 'BR', 'automotive', 'form', null, 'https://www.webmotors.com.br', false, null, true, true, true, 120, '🚘', array['automotive']::text[], 'Portal automotivo Webmotors.'),
  ('icarros', 'iCarros', 'BR', 'BR', 'automotive', 'form', null, 'https://www.icarros.com.br', false, null, true, true, true, 121, '🚗', array['automotive']::text[], 'Portal automotivo iCarros.'),
  ('autoline', 'Autoline', 'GLOBAL', 'GLOBAL', 'automotive', 'form', null, 'https://autoline.info', false, null, true, true, true, 122, '🚚', array['automotive']::text[], 'Veículos e máquinas.'),
  ('trinks', 'Trinks', 'BR', 'BR', 'beauty', 'form', null, 'https://www.trinks.com', false, null, true, true, true, 130, '💅', array['beauty']::text[], 'Beleza, estética e agendamento.'),
  ('educamaisbrasil', 'Educa Mais Brasil', 'BR', 'BR', 'education', 'partner', null, 'https://www.educamaisbrasil.com.br', false, null, true, true, true, 140, '🎓', array['education']::text[], 'Educação e bolsas.'),
  ('querobolsa', 'Quero Bolsa', 'BR', 'BR', 'education', 'partner', null, 'https://querobolsa.com.br', false, null, true, true, true, 141, '🎓', array['education']::text[], 'Educação e bolsas.'),
  ('serasa', 'Serasa', 'BR', 'BR', 'finance', 'manual', null, 'https://www.serasa.com.br', false, null, true, true, true, 150, '💳', array['finance']::text[], 'Referência financeira/cadastro manual.'),
  ('jusbrasil', 'Jusbrasil', 'BR', 'BR', 'legal', 'form', null, 'https://www.jusbrasil.com.br', false, null, true, true, true, 160, '⚖️', array['legal','services']::text[], 'Perfil jurídico.'),
  ('petlove', 'Petlove', 'BR', 'BR', 'pet', 'partner', null, 'https://www.petlove.com.br', false, null, true, true, true, 170, '🐾', array['pet']::text[], 'Marketplace pet/parcerias.')
)
insert into public.directory_channels (
  code, name, country, region, segment, submission_type, email_to, website_url,
  api_available, api_type, requires_login, requires_manual_review, requires_paid_plan,
  priority, icon, categories, description, is_active, updated_at
)
select
  code, name, country, region, segment, submission_type, email_to, website_url,
  api_available, api_type, requires_login, requires_manual_review, requires_paid_plan,
  priority, icon, categories, description, true, now()
from catalog
on conflict (code) do update set
  name = excluded.name,
  country = excluded.country,
  region = excluded.region,
  segment = excluded.segment,
  submission_type = excluded.submission_type,
  email_to = excluded.email_to,
  website_url = excluded.website_url,
  api_available = excluded.api_available,
  api_type = excluded.api_type,
  requires_login = excluded.requires_login,
  requires_manual_review = excluded.requires_manual_review,
  requires_paid_plan = excluded.requires_paid_plan,
  priority = excluded.priority,
  icon = excluded.icon,
  categories = excluded.categories,
  description = excluded.description,
  is_active = true,
  updated_at = now();

-- Diretórios que forem marcados como inativos pelo verificador deixam de aparecer no frontend,
-- pois a tela consulta directory_channels com is_active = true.
