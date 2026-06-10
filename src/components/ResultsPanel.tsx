import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Copy, CheckCheck, ClipboardList, RefreshCw } from 'lucide-react';
import { ChannelProgress } from './ChannelProgress';
import { useToast } from '@/hooks/use-toast';
import type { SyncResponse, ChannelResult } from '@/types/business-profile';
import { verifyDirectorySubmissions } from '@/services/verification-service';

interface ResultsPanelProps {
  response: SyncResponse;
  onReset: () => void;
}

function formatCopyPayload(payload?: Record<string, string> | null) {
  if (!payload) return '';
  return Object.entries(payload)
    .filter(([, value]) => value !== undefined && value !== null && String(value).trim() !== '')
    .map(([key, value]) => `${key}: ${value}`)
    .join('\n');
}

export function ResultsPanel({ response, onReset }: ResultsPanelProps) {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);
  const [checking, setChecking] = useState(false);

  const handleCopySyncId = async () => {
    try {
      await navigator.clipboard.writeText(response.sync_id);
      setCopied(true);
      toast({ title: '✅ Copiado!', description: 'ID de sincronização copiado para área de transferência' });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({ title: '❌ Erro ao copiar', description: 'Não foi possível copiar o ID', variant: 'destructive' });
    }
  };

  const handleCopyPayload = async (result: ChannelResult) => {
    const text = formatCopyPayload(result.copyPayload);
    if (!text) return;
    await navigator.clipboard.writeText(text);
    toast({ title: 'Dados copiados', description: 'Agora é só colar no formulário do diretório.' });
  };

  const handleVerifyOnline = async () => {
    try {
      setChecking(true);
      const data = await verifyDirectorySubmissions({ syncId: response.sync_id, limit: 30 });
      toast({
        title: 'Verificação iniciada',
        description: `${data.checked || 0} canais conferidos. Atualize o painel da empresa para ver os status.`
      });
    } catch (error) {
      toast({
        title: 'Erro na verificação',
        description: error instanceof Error ? error.message : 'Não foi possível verificar agora.',
        variant: 'destructive'
      });
    } finally {
      setChecking(false);
    }
  };

  const resultValues = Object.values(response.results || {});
  const successCount = resultValues.filter(r => ['success', 'sent', 'submitted', 'found_online'].includes(r.status)).length;
  const assistedCount = resultValues.filter(r => ['manual_required', 'manual_check_required', 'captcha_required', 'not_implemented', 'pending_review'].includes(r.status)).length;
  const errorCount = resultValues.filter(r => ['error', 'not_found', 'data_mismatch', 'not_returned'].includes(r.status)).length;
  const totalChannels = response.total_channels || Object.keys(response.results || {}).length;
  const manualResults = Object.entries(response.results || {}).filter(([, r]) => ['manual_required', 'manual_check_required', 'captcha_required', 'not_implemented'].includes(r.status));

  return (
    <Card className="w-full max-w-3xl mx-auto mt-8 bg-card border-border shadow-purple">
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div>
            <CardTitle className="text-2xl flex items-center gap-2 text-foreground">
              {errorCount === 0 ? '✅' : '⚠️'}
              {errorCount === 0 ? 'Sincronização Concluída!' : 'Sincronização com Pendências'}
            </CardTitle>
            <CardDescription className="mt-2">
              {successCount} automáticos/enviados, {assistedCount} assistidos/manuais, {errorCount} com erro ou divergência.
            </CardDescription>
          </div>
          <Badge variant={errorCount === 0 ? 'default' : 'destructive'}>
            {successCount + assistedCount}/{totalChannels}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
          <div className="flex-1 min-w-0">
            <p className="text-xs text-muted-foreground">ID de Sincronização</p>
            <p className="font-mono text-sm truncate text-foreground">{response.sync_id}</p>
          </div>
          <Button size="sm" variant="ghost" onClick={handleCopySyncId} className="shrink-0">
            {copied ? <CheckCheck className="w-4 h-4 text-accent" /> : <Copy className="w-4 h-4" />}
          </Button>
        </div>

        {manualResults.length > 0 && (
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-4">
            <div className="flex items-start gap-3">
              <ClipboardList className="w-5 h-5 text-amber-300 mt-0.5" />
              <div>
                <h3 className="font-semibold text-foreground">Canais assistidos</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Alguns diretórios exigem formulário, login, captcha ou revisão manual. O sistema não força automação nesses casos para evitar bloqueios. Use os botões de cada canal para abrir o formulário e copiar os dados padronizados.
                </p>
              </div>
            </div>
          </div>
        )}

        <div className="space-y-3">
          <h3 className="font-semibold text-sm text-muted-foreground uppercase">Resultados por Canal</h3>
          {Object.entries(response.results || {}).map(([channel, result]) => (
            <ChannelProgress key={channel} name={channel} status={result.status} result={result} onCopyPayload={handleCopyPayload} />
          ))}
        </div>

        <div className="flex flex-col sm:flex-row gap-3 pt-4">
          <Button onClick={onReset} className="flex-1 bg-accent hover:bg-accent/90">
            Nova Sincronização
          </Button>
          <Button onClick={handleVerifyOnline} disabled={checking} variant="outline" className="flex-1">
            {checking ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
            Verificar perfis online
          </Button>
        </div>

        <p className="text-xs text-center text-muted-foreground">
          Sincronizado em {new Date(response.timestamp).toLocaleString('pt-BR')}
        </p>
      </CardContent>
    </Card>
  );
}

export default ResultsPanel;
