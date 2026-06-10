import { useEffect, useState } from 'react';
import type React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Building2, ArrowLeft, CheckCircle2, Mail, XCircle, Clock, RefreshCw, ClipboardList, SearchCheck, SearchX, ExternalLink, Copy, PlayCircle } from 'lucide-react';
import type { ChannelResult } from '@/types/business-profile';
import { getDirectoryStatusByGoogleLocationId, saveDirectorySubmissionProfileUrl } from '@/services/database-service';

interface DirectoryStatus {
  updatedAt: string;
  results: Record<string, ChannelResult>;
}

const VERIFY_ENDPOINT = import.meta.env.VITE_DIRECTORY_VERIFY_ENDPOINT || 'https://webhook.pquadrado.com.br/webhook/p2/directory-submissions/verify';

const channelIcons: Record<string, string> = {
  google: '🔍',
  facebook: '📘',
  apple: '🍎',
  instagram: '📷',
  bing: '🅱️',
  apontador: '📍',
  guiamais: '🗺️',
  telelistas: '📞',
  waze: '📍',
  yelp: '📍',
  guiasp: '📍',
  encontrabrasil: '📍',
  acheiaqui: '📍',
  foursquare: '📍',
  here: '🗺️',
  ifood: '🍽️',
  tripadvisor: '🧳',
  booking: '🏨',
};

const statusConfig: Record<string, { label: string; color: string; Icon: React.ComponentType<{ className?: string }> }> = {
  success: { label: 'Sincronizado', color: 'text-accent', Icon: CheckCircle2 },
  sent: { label: 'Email enviado', color: 'text-secondary', Icon: Mail },
  error: { label: 'Erro', color: 'text-destructive', Icon: XCircle },
  pending: { label: 'Pendente', color: 'text-muted-foreground', Icon: Clock },
  syncing: { label: 'Sincronizando', color: 'text-primary', Icon: RefreshCw },
  submitted: { label: 'Formulário enviado', color: 'text-accent', Icon: CheckCircle2 },
  manual_required: { label: 'Ação assistida', color: 'text-amber-300', Icon: ClipboardList },
  pending_review: { label: 'Aguardando revisão', color: 'text-amber-300', Icon: Clock },
  found_online: { label: 'Online encontrado', color: 'text-accent', Icon: SearchCheck },
  not_found: { label: 'Não encontrado', color: 'text-destructive', Icon: SearchX },
  data_mismatch: { label: 'Dados divergentes', color: 'text-amber-300', Icon: ClipboardList },
  manual_check_required: { label: 'Conferência manual', color: 'text-amber-300', Icon: ClipboardList },
  captcha_required: { label: 'Captcha/Login', color: 'text-amber-300', Icon: ClipboardList },
  inactive: { label: 'Inativo', color: 'text-muted-foreground', Icon: Clock },
  not_implemented: { label: 'API futura', color: 'text-amber-300', Icon: ClipboardList },
  not_returned: { label: 'Sem retorno', color: 'text-destructive', Icon: XCircle },
};

const verificationConfig: Record<string, { label: string; color: string }> = {
  not_checked: { label: 'Ainda não verificado', color: 'text-muted-foreground' },
  pending_review: { label: 'Aguardando revisão do diretório', color: 'text-amber-300' },
  found_online: { label: 'Perfil online encontrado', color: 'text-accent' },
  not_found: { label: 'Perfil ainda não encontrado', color: 'text-destructive' },
  data_mismatch: { label: 'Perfil encontrado com dados divergentes', color: 'text-amber-300' },
  manual_check_required: { label: 'Conferência manual necessária', color: 'text-amber-300' },
  error: { label: 'Erro na verificação', color: 'text-destructive' },
};

function extractUrl(text?: string | null): string | null {
  if (!text) return null;
  const match = String(text).match(/https?:\/\/[^\s)]+/i);
  return match?.[0] || null;
}

function formatSubmissionType(type?: string | null) {
  if (type === 'email') return 'Email automático';
  if (type === 'form') return 'Formulário assistido';
  if (type === 'manual') return 'Manual assistido';
  if (type === 'api') return 'API / conector';
  return 'Tipo não informado';
}

function buildCopyText(result: ChannelResult, channel: string) {
  const payload = result.copyPayload || null;
  if (payload && typeof payload === 'object') {
    return Object.entries(payload)
      .map(([key, value]) => `${key}: ${value || ''}`)
      .join('\n');
  }

  return [
    `Diretório: ${result.directoryName || channel}`,
    `Tipo: ${formatSubmissionType(result.submissionType)}`,
    result.message ? `Mensagem: ${result.message}` : '',
    result.formUrl ? `Formulário: ${result.formUrl}` : '',
    result.manualInstructions ? `Instrução: ${result.manualInstructions}` : '',
  ].filter(Boolean).join('\n');
}

const DirectoryPanel = () => {
  const { locationId } = useParams<{ locationId: string }>();
  const navigate = useNavigate();
  const [status, setStatus] = useState<DirectoryStatus | null>(null);
  const [locationName, setLocationName] = useState<string>('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [profileUrlInputs, setProfileUrlInputs] = useState<Record<string, string>>({});
  const [savingProfileUrl, setSavingProfileUrl] = useState<string | null>(null);

  const loadStatus = () => {
    if (!locationId) return;
    const decodedLocationId = decodeURIComponent(locationId);

    getDirectoryStatusByGoogleLocationId(decodedLocationId)
      .then((data) => {
        if (!data) return;
        setStatus({ updatedAt: data.updatedAt, results: data.results });
        setLocationName(data.locationName);
      })
      .catch((error) => {
        console.warn('Falha ao carregar status do Supabase, tentando cache local', error);
        try {
          const raw = localStorage.getItem('gbp_directory_status_v1');
          if (raw) {
            const parsed = JSON.parse(raw);
            const data = parsed[decodedLocationId] || parsed[locationId];
            if (data) setStatus(data);
          }
        } catch {
          // ignore
        }
      });
  };

  useEffect(() => {
    loadStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locationId]);

  const handleCopy = async (result: ChannelResult, channel: string) => {
    await navigator.clipboard.writeText(buildCopyText(result, channel));
    alert('Dados copiados para a área de transferência.');
  };

  const handleVerify = async () => {
    setIsVerifying(true);
    try {
      const response = await fetch(`${VERIFY_ENDPOINT}?limit=20`);
      if (!response.ok) throw new Error(`Erro ${response.status}`);
      await response.json().catch(() => null);
      await new Promise((resolve) => setTimeout(resolve, 1000));
      loadStatus();
      alert('Verificação acionada. O painel foi atualizado com os dados disponíveis.');
    } catch (error) {
      alert(`Não foi possível acionar a verificação: ${error instanceof Error ? error.message : 'erro desconhecido'}`);
    } finally {
      setIsVerifying(false);
    }
  };


  const handleSaveProfileUrl = async (channel: string) => {
    if (!locationId) return;
    const url = (profileUrlInputs[channel] || '').trim();
    if (!url) {
      alert('Cole a URL pública do perfil antes de salvar.');
      return;
    }

    setSavingProfileUrl(channel);
    try {
      await saveDirectorySubmissionProfileUrl(decodeURIComponent(locationId), channel, url);
      setProfileUrlInputs((current) => ({ ...current, [channel]: '' }));
      loadStatus();
      alert('URL do perfil salva. A partir de agora esse canal pode ser verificado diretamente pela URL pública.');
    } catch (error) {
      alert(`Não foi possível salvar a URL: ${error instanceof Error ? error.message : 'erro desconhecido'}`);
    } finally {
      setSavingProfileUrl(null);
    }
  };

  const successCount = status
    ? Object.values(status.results).filter((r) => ['success', 'sent', 'submitted', 'found_online'].includes(r.status)).length
    : 0;
  const totalCount = status ? Object.keys(status.results).length : 0;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-brand-purple to-brand-magenta rounded-lg flex items-center justify-center">
              <Building2 className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground">pquadrado</h1>
              <p className="text-xs text-muted-foreground">Painel de Diretórios</p>
            </div>
          </div>
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Voltar
          </button>
        </div>
      </header>

      <main className="container mx-auto px-6 py-12">
        <div className="max-w-3xl mx-auto">
          <div className="mb-8">
            <h2 className="text-3xl font-bold text-foreground">
              {locationName || 'Empresa'}
            </h2>
            <p className="text-muted-foreground mt-1 font-mono text-sm break-all">
              {decodeURIComponent(locationId || '')}
            </p>
          </div>

          {!status ? (
            <div className="bg-card border border-border rounded-xl p-12 text-center shadow-purple">
              <Clock className="h-12 w-12 text-muted-foreground/40 mx-auto mb-4" />
              <p className="text-muted-foreground text-lg">Nenhuma sincronização encontrada</p>
              <p className="text-muted-foreground text-sm mt-2">
                Faça uma sincronização primeiro para ver os resultados aqui
              </p>
              <button
                onClick={() => navigate('/form')}
                className="mt-6 px-6 py-2.5 bg-accent hover:bg-accent/90 text-accent-foreground font-medium rounded-md transition-colors"
              >
                Sincronizar agora
              </button>
            </div>
          ) : (
            <>
              <div className="bg-card border border-border rounded-xl p-6 mb-6 shadow-purple">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Última sincronização</p>
                    <p className="text-foreground font-medium">
                      {new Date(status.updatedAt).toLocaleString('pt-BR')}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold text-foreground">{successCount}/{totalCount}</p>
                    <p className="text-sm text-muted-foreground">canais OK</p>
                  </div>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    onClick={handleVerify}
                    disabled={isVerifying}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-md border border-border text-sm text-foreground hover:bg-muted disabled:opacity-60"
                  >
                    <PlayCircle className="h-4 w-4" />
                    {isVerifying ? 'Verificando...' : 'Verificar perfis online'}
                  </button>
                  <p className="text-xs text-muted-foreground self-center">
                    A verificação só confirma online quando houver URL pública, template de busca ou perfil encontrado.
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                  Status por Canal
                </h3>
                {Object.entries(status.results).map(([channel, result]) => {
                  const cfg = statusConfig[result.status] || statusConfig.pending;
                  const Icon = cfg.Icon;
                  const actionUrl = result.formUrl || result.profileUrl || result.websiteUrl || extractUrl(result.message) || null;
                  const searchUrl = result.searchUrl || result.checkedUrl || null;
                  const isAssisted = ['manual_required', 'manual_check_required', 'captcha_required', 'not_implemented'].includes(result.status) || ['form', 'manual'].includes(String(result.submissionType || ''));
                  const verification = verificationConfig[String(result.verificationStatus || 'not_checked')] || verificationConfig.not_checked;

                  return (
                    <div
                      key={channel}
                      className="bg-card border border-border rounded-xl p-4"
                    >
                      <div className="flex items-start gap-4">
                        <span className="text-2xl">{channelIcons[channel] || '📍'}</span>
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-medium capitalize text-foreground">{result.directoryName || channel}</p>
                            <span className="text-[11px] px-2 py-0.5 rounded-full border border-border text-muted-foreground">
                              {formatSubmissionType(result.submissionType)}
                            </span>
                          </div>

                          {result.message && (
                            <p className="text-sm text-muted-foreground mt-1">{result.message}</p>
                          )}

                          <p className={`text-xs mt-1 ${verification.color}`}>
                            Verificação online: <strong>{verification.label}</strong>
                            {result.verificationMessage ? ` — ${result.verificationMessage}` : ''}
                          </p>

                          {isAssisted && result.manualInstructions && (
                            <p className="text-xs text-muted-foreground mt-1">
                              {result.manualInstructions}
                            </p>
                          )}
                        </div>

                        <div className={`flex items-center gap-1.5 ${cfg.color} shrink-0`}>
                          <Icon className="h-4 w-4" />
                          <span className="text-sm font-medium">{cfg.label}</span>
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-2 mt-4 pl-10">
                        {actionUrl && (
                          <a
                            href={actionUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-2 px-3 py-2 rounded-md border border-amber-500/40 bg-amber-500/10 text-amber-200 text-xs font-medium hover:bg-amber-500/20"
                          >
                            {result.profileUrl ? 'Abrir perfil encontrado' : result.formUrl || result.submissionType === 'form' ? 'Abrir formulário' : 'Abrir site'}
                            <ExternalLink className="h-3.5 w-3.5" />
                          </a>
                        )}

                        {searchUrl && !result.profileUrl && (
                          <a
                            href={searchUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-2 px-3 py-2 rounded-md border border-primary/40 bg-primary/10 text-primary text-xs font-medium hover:bg-primary/20"
                          >
                            Abrir busca de verificação
                            <SearchCheck className="h-3.5 w-3.5" />
                          </a>
                        )}

                        {isAssisted && (
                          <button
                            onClick={() => handleCopy(result, channel)}
                            className="inline-flex items-center gap-2 px-3 py-2 rounded-md border border-border text-xs font-medium text-foreground hover:bg-muted"
                          >
                            Copiar dados para preencher
                            <Copy className="h-3.5 w-3.5" />
                          </button>
                        )}

                        {!result.profileUrl && (result.verificationStatus === 'manual_check_required' || searchUrl) && (
                          <div className="flex flex-col sm:flex-row gap-2 w-full mt-2">
                            <input
                              type="url"
                              value={profileUrlInputs[channel] || ''}
                              onChange={(event) => setProfileUrlInputs((current) => ({ ...current, [channel]: event.target.value }))}
                              placeholder="Cole aqui a URL pública do perfil encontrado"
                              className="flex-1 min-w-[240px] rounded-md border border-border bg-background px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                            />
                            <button
                              onClick={() => handleSaveProfileUrl(channel)}
                              disabled={savingProfileUrl === channel}
                              className="inline-flex items-center justify-center gap-2 px-3 py-2 rounded-md border border-accent/40 bg-accent/10 text-accent text-xs font-medium hover:bg-accent/20 disabled:opacity-60"
                            >
                              {savingProfileUrl === channel ? 'Salvando...' : 'Salvar URL do perfil'}
                            </button>
                          </div>
                        )}

                        {result.profileUrl && (
                          <span className="inline-flex items-center gap-2 px-3 py-2 rounded-md border border-accent/40 bg-accent/10 text-accent text-xs font-medium">
                            Perfil publicado encontrado
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="mt-8 flex gap-3">
                <button
                  onClick={() => navigate('/form')}
                  className="px-6 py-2.5 bg-accent hover:bg-accent/90 text-accent-foreground font-medium rounded-md transition-colors"
                >
                  Nova sincronização
                </button>
                <button
                  onClick={() => navigate('/')}
                  className="px-6 py-2.5 border border-border text-foreground font-medium rounded-md hover:bg-muted transition-colors"
                >
                  Ver outras empresas
                </button>
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
};

export default DirectoryPanel;
