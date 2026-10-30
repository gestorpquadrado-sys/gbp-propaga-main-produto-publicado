-- Registro de que ALGUÉM preencheu o formulário do diretório.
--
-- Faltava por completo: o sistema sabia que o canal EXIGE formulário e parava aí. Quem
-- cadastrava à mão não tinha onde marcar, e dias depois ninguém sabia dizer em qual
-- diretório o cadastro foi feito. Sem isso o trabalho se repete e a verificação não
-- distingue o que tem chance de estar publicado do que nunca foi enviado.
alter table public.directory_submissions
  add column if not exists filled_at   timestamptz,
  add column if not exists filled_by   text,
  add column if not exists filled_note text;

comment on column public.directory_submissions.filled_at is
  'Quando alguem da equipe concluiu o cadastro no diretorio, a mao. Diferente de submitted_at, que e quando o sistema disparou o pedido.';
comment on column public.directory_submissions.filled_by is 'E-mail de quem marcou como preenchido.';

create index if not exists directory_submissions_preenchidas_idx
  on public.directory_submissions (filled_at desc nulls last)
  where filled_at is not null;
