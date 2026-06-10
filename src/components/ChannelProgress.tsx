import { CheckCircle2, Loader2, XCircle, Mail, Clock, ClipboardList, SearchCheck, SearchX, AlertTriangle, ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ChannelResult, ChannelStatus } from '@/types/business-profile';
import { Button } from '@/components/ui/button';

interface ChannelProgressProps {
  name: string;
  status: ChannelResult['status'];
  result?: ChannelResult;
  onCopyPayload?: (result: ChannelResult) => void;
}

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
  default: '📍'
};

const statusConfig: Record<ChannelStatus, { label: string; color: string; bgColor: string; icon: any; animate?: 'animate-spin' }> = {
  pending: { icon: Clock, color: 'text-muted-foreground', bgColor: 'bg-muted/30', label: 'Aguardando' },
  syncing: { icon: Loader2, color: 'text-primary', bgColor: 'bg-primary/10', label: 'Sincronizando', animate: 'animate-spin' },
  success: { icon: CheckCircle2, color: 'text-accent', bgColor: 'bg-accent/10', label: 'Sucesso' },
  sent: { icon: Mail, color: 'text-secondary', bgColor: 'bg-secondary/10', label: 'Email enviado' },
  submitted: { icon: CheckCircle2, color: 'text-accent', bgColor: 'bg-accent/10', label: 'Formulário enviado' },
  manual_required: { icon: ClipboardList, color: 'text-amber-300', bgColor: 'bg-amber-500/10', label: 'Ação assistida' },
  pending_review: { icon: Clock, color: 'text-amber-300', bgColor: 'bg-amber-500/10', label: 'Aguardando revisão' },
  found_online: { icon: SearchCheck, color: 'text-accent', bgColor: 'bg-accent/10', label: 'Online encontrado' },
  not_found: { icon: SearchX, color: 'text-destructive', bgColor: 'bg-destructive/10', label: 'Não encontrado' },
  data_mismatch: { icon: AlertTriangle, color: 'text-amber-300', bgColor: 'bg-amber-500/10', label: 'Dados divergentes' },
  manual_check_required: { icon: ClipboardList, color: 'text-amber-300', bgColor: 'bg-amber-500/10', label: 'Conferência manual' },
  captcha_required: { icon: AlertTriangle, color: 'text-amber-300', bgColor: 'bg-amber-500/10', label: 'Captcha/login' },
  inactive: { icon: Clock, color: 'text-muted-foreground', bgColor: 'bg-muted/30', label: 'Inativo' },
  not_implemented: { icon: ClipboardList, color: 'text-amber-300', bgColor: 'bg-amber-500/10', label: 'Conector futuro' },
  not_returned: { icon: AlertTriangle, color: 'text-destructive', bgColor: 'bg-destructive/10', label: 'Sem retorno' },
  error: { icon: XCircle, color: 'text-destructive', bgColor: 'bg-destructive/10', label: 'Erro' }
};

export function ChannelProgress({ name, status, result, onCopyPayload }: ChannelProgressProps) {
  const config = statusConfig[status] || statusConfig.pending;
  const Icon = config.icon;
  const channelIcon = channelIcons[name] || channelIcons.default;
  const url = result?.formUrl || result?.profileUrl || result?.websiteUrl;
  const showManualActions = ['manual_required', 'manual_check_required', 'captcha_required', 'not_implemented'].includes(status);

  return (
    <div className={cn('flex items-start gap-3 p-4 rounded-lg border transition-all', config.bgColor, 'border-border')}>
      <div className="text-2xl mt-0.5">{channelIcon}</div>

      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <h4 className="font-medium capitalize text-foreground">{result?.directoryName || name}</h4>
          <span className={cn('text-xs font-medium', config.color)}>{config.label}</span>
          {result?.submissionType && (
            <span className="text-[11px] px-2 py-0.5 rounded-full border border-border text-muted-foreground">
              {result.submissionType}
            </span>
          )}
        </div>

        {result?.message && (
          <p className="text-sm text-muted-foreground mt-0.5">{result.message}</p>
        )}

        {result?.verificationStatus && (
          <p className="text-xs text-muted-foreground mt-1">
            Verificação online: <strong>{result.verificationStatus}</strong>
            {result.verificationMessage ? ` — ${result.verificationMessage}` : ''}
          </p>
        )}

        {result?.durationMs && (
          <p className="text-xs text-muted-foreground mt-1">⏱️ {result.durationMs}ms</p>
        )}

        {showManualActions && (
          <div className="flex flex-wrap gap-2 mt-3">
            {url && (
              <Button size="sm" variant="outline" asChild>
                <a href={url} target="_blank" rel="noreferrer">
                  Abrir {result?.formUrl ? 'formulário' : 'site'}
                  <ExternalLink className="w-3.5 h-3.5 ml-1" />
                </a>
              </Button>
            )}
            {result?.copyPayload && onCopyPayload && (
              <Button size="sm" variant="outline" onClick={() => onCopyPayload(result)}>
                Copiar dados da empresa
              </Button>
            )}
          </div>
        )}
      </div>

      <div className={config.color}>
        <Icon className={cn('w-5 h-5', config.animate)} />
      </div>
    </div>
  );
}
