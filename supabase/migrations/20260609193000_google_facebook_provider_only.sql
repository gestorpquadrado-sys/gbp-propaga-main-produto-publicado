-- Google e Facebook não são diretórios de propagação neste projeto.
-- Eles ficam como fontes/provedores de dados para importação e identificação dos perfis,
-- evitando sobrescrever informações já otimizadas manualmente e protegendo o ranking local.

update public.directory_channels
set is_active = false,
    submission_type = 'reference',
    requires_manual_review = true,
    last_check_status = 'provider_only',
    notes = coalesce(notes || ' | ', '') || 'Canal usado apenas como fonte de dados/identificação. Não usar para propagação automática.',
    updated_at = now()
where code in ('google', 'facebook');
