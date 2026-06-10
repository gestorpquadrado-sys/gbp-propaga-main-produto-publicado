import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { supabase } from '@/integrations/supabase/client';
import type { DirectoryChannel } from '@/types/business-profile';
import { Loader2, AlertCircle, ChevronDown, ChevronUp, Sparkles, Info } from 'lucide-react';
import {
  businessTypeOptions,
  detectBusinessTypeFromCategories,
  getRecommendedChannelCodes,
  SPECIAL_CHANNELS,
  type ChannelBusinessType,
} from '@/data/channelRecommendations';

interface ChannelsStepProps {
  formData: any;
  updateFormData: (field: string, value: any) => void;
}

const DEFAULT_SAFE_CHANNELS = ['apontador', 'bing', 'yelp'];
const PROVIDER_ONLY_CHANNELS = ['google', 'facebook'];

const SUBMISSION_TYPE_LABELS: Record<string, string> = {
  api: 'API direta',
  email: 'Email',
  form: 'Formulário',
  manual: 'Manual',
  partner: 'Parceiro',
  reference: 'Referência',
};

const AUTOMATION_LABELS: Record<string, { label: string; className: string }> = {
  automatic: { label: 'Automático seguro', className: 'border-green-500/50 text-green-300' },
  assisted: { label: 'Assistido', className: 'border-amber-500/50 text-amber-300' },
  manual: { label: 'Manual seguro', className: 'border-slate-500/50 text-slate-300' },
  future: { label: 'API futura', className: 'border-blue-500/50 text-blue-300' },
};

const CHECK_STATUS_LABELS: Record<string, string> = {
  active: 'Ativo',
  inactive: 'Inativo',
  warning: 'Verificar',
  unknown: 'Não verificado',
};

function getAutomationMode(dir: DirectoryChannel): keyof typeof AUTOMATION_LABELS {
  const type = String(dir.submission_type || '').toLowerCase();
  if (type === 'email') return 'automatic';
  if (type === 'form') return dir.auto_submit_supported ? 'automatic' : 'assisted';
  if (type === 'api' || dir.api_available) return 'future';
  return 'manual';
}

function getSubmissionTypeLabel(value?: string | null) {
  return SUBMISSION_TYPE_LABELS[value || ''] || 'Email/Manual';
}

function getCheckStatusLabel(value?: string | null) {
  return CHECK_STATUS_LABELS[value || ''] || 'Não verificado';
}


const ChannelsStep = ({ formData, updateFormData }: ChannelsStepProps) => {
  const [businessType, setBusinessType] = useState<ChannelBusinessType>('general');
  const [directories, setDirectories] = useState<DirectoryChannel[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAllDirectories, setShowAllDirectories] = useState(false);
  const [autoDetectedType, setAutoDetectedType] = useState<ChannelBusinessType>('general');

  const selectedChannels = formData.channels || [];

  const categoryTerms = useMemo(() => {
    const primary = formData.categories?.gbpPrimary ? [formData.categories.gbpPrimary] : [];
    const additional = Array.isArray(formData.categories?.gbpAdditional) ? formData.categories.gbpAdditional : [];
    return [...primary, ...additional].filter(Boolean);
  }, [formData.categories?.gbpPrimary, formData.categories?.gbpAdditional]);

  useEffect(() => {
    fetchDirectories();
  }, []);

  useEffect(() => {
    const detected = detectBusinessTypeFromCategories(categoryTerms);
    setAutoDetectedType(detected);
    setBusinessType(detected);
  }, [categoryTerms]);

  useEffect(() => {
    if (directories.length === 0) return;

    const current = selectedChannels || [];
    const isEmpty = current.length === 0;
    const isDefaultOnly = current.every((code: string) => DEFAULT_SAFE_CHANNELS.includes(code));

    // Atualiza automaticamente quando o usuário ainda não personalizou a seleção.
    if (isEmpty || isDefaultOnly) {
      applyRecommendedChannels(businessType);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [businessType, directories]);

  const fetchDirectories = async () => {
    try {
      setLoading(true);
      const { data, error: fetchError } = await supabase
        .from('directory_channels')
        .select('*')
        .eq('is_active', true)
        .order('priority', { ascending: true, nullsFirst: false })
        .order('name');

      if (fetchError) throw fetchError;
      const propagationDirectories = (data || []).filter((dir) => !PROVIDER_ONLY_CHANNELS.includes(dir.code));
      setDirectories(propagationDirectories);
    } catch (err) {
      console.error('Error fetching directories:', err);
      setError('Erro ao carregar diretórios. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  const existingCodeSet = useMemo(
    () => new Set(directories.map((dir) => dir.code)),
    [directories]
  );

  const recommendedCodes = useMemo(() => {
    const explicit = getRecommendedChannelCodes(businessType, false).filter((code) => existingCodeSet.has(code));

    const byDirectoryCategory = directories
      .filter((dir) => dir.categories?.includes(businessType) || dir.categories?.includes('general'))
      .filter((dir) => !SPECIAL_CHANNELS.includes(dir.code))
      .map((dir) => dir.code);

    return Array.from(new Set([...explicit, ...byDirectoryCategory]));
  }, [businessType, directories, existingCodeSet]);


  const relevantDirs = useMemo(
    () => directories.filter((dir) => recommendedCodes.includes(dir.code)),
    [directories, recommendedCodes]
  );

  const otherDirs = useMemo(() => {
    const relevant = new Set([...recommendedCodes, ...SPECIAL_CHANNELS]);
    return directories.filter((dir) => !relevant.has(dir.code));
  }, [directories, recommendedCodes]);

  const applyRecommendedChannels = (type = businessType) => {
    const codes = getRecommendedChannelCodes(type, false).filter((code) => existingCodeSet.has(code));
    const fallback = DEFAULT_SAFE_CHANNELS.filter((code) => existingCodeSet.has(code));
    updateFormData('channels', codes.length > 0 ? codes : fallback);
  };

  const handleBusinessTypeChange = (value: string) => {
    const nextType = value as ChannelBusinessType;
    setBusinessType(nextType);
    applyRecommendedChannels(nextType);
  };

  const handleChannelToggle = (code: string, checked: boolean) => {
    if (checked) {
      updateFormData('channels', Array.from(new Set([...selectedChannels, code])));
    } else {
      updateFormData('channels', selectedChannels.filter((c: string) => c !== code));
    }
  };

  const handleSelectRecommended = () => {
    applyRecommendedChannels();
  };

  const handleSelectAllVisible = () => {
    const allCodes = Array.from(new Set(recommendedCodes));
    updateFormData('channels', allCodes);
  };

  const handleDeselectAll = () => {
    updateFormData('channels', []);
  };

  const renderDirectoryCard = (dir: DirectoryChannel, variant: 'recommended' | 'special' | 'other' = 'recommended') => {
    const selected = selectedChannels.includes(dir.code);
    const isSpecial = SPECIAL_CHANNELS.includes(dir.code);
    const methodLabel = getSubmissionTypeLabel(dir.submission_type);
    const checkLabel = getCheckStatusLabel(dir.last_check_status);
    const isApi = dir.submission_type === 'api';
    const isInactiveWarning = dir.last_check_status === 'warning';
    const automationMode = getAutomationMode(dir);
    const automationLabel = AUTOMATION_LABELS[automationMode];

    return (
      <div
        key={dir.code}
        className={`flex items-start space-x-3 p-4 rounded-lg border-2 transition-all ${
          selected
            ? 'border-primary bg-primary/5'
            : isSpecial
              ? 'border-amber-500/30 bg-amber-500/5 hover:border-amber-500/60'
              : 'border-border hover:border-muted-foreground'
        }`}
      >
        <Checkbox
          id={`${variant}-${dir.code}`}
          checked={selected}
          onCheckedChange={(checked) => handleChannelToggle(dir.code, checked as boolean)}
        />
        <div className="flex-1 space-y-2">
          <Label htmlFor={`${variant}-${dir.code}`} className="flex flex-wrap items-center gap-2 cursor-pointer font-medium text-foreground">
            <span className="text-xl">{dir.icon || '📍'}</span>
            {dir.name}
            <Badge variant="outline" className="text-xs">
              {dir.country || 'GLOBAL'}
            </Badge>
            <Badge variant={isApi ? 'default' : 'outline'} className="text-xs">
              {methodLabel}
            </Badge>
            <Badge variant="outline" className={`text-xs ${automationLabel.className}`}>
              {automationLabel.label}
            </Badge>
            {isSpecial && (
              <Badge variant="outline" className="text-xs border-amber-500/50 text-amber-300">
                Canal avançado
              </Badge>
            )}
            {dir.last_check_status && (
              <Badge variant="outline" className={`text-xs ${isInactiveWarning ? 'border-amber-500/50 text-amber-300' : ''}`}>
                {checkLabel}
              </Badge>
            )}
          </Label>

          {dir.description && <p className="text-sm text-muted-foreground">{dir.description}</p>}

          <div className="flex flex-wrap gap-2 text-[11px] text-muted-foreground">
            {dir.website_url && <span>Site: {dir.website_url.replace(/^https?:\/\//, '')}</span>}
            {dir.form_url && <span>• Tem formulário</span>}
            {dir.requires_login && <span>• Requer login</span>}
            {dir.requires_manual_review && <span>• Revisão manual</span>}
            {dir.requires_paid_plan && <span>• Pode exigir plano pago</span>}
            {dir.last_checked_at && <span>• Verificado: {new Date(dir.last_checked_at).toLocaleDateString('pt-BR')}</span>}
          </div>

        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <Card className="bg-card border-border">
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  const selectedBusinessTypeLabel = businessTypeOptions.find((o) => o.value === businessType)?.label;
  const detectedBusinessTypeLabel = businessTypeOptions.find((o) => o.value === autoDetectedType)?.label;

  return (
    <div className="space-y-6">
      <Alert className="bg-brand-purple/10 border-brand-purple/20">
        <Sparkles className="h-4 w-4" />
        <AlertDescription className="text-sm text-muted-foreground">
Tipo detectado pela categoria principal: <strong className="text-foreground">{detectedBusinessTypeLabel}</strong>. Os canais agora são classificados por tipo: automático seguro, assistido ou manual. Google e Facebook continuam como fontes de dados/IDs, não como diretórios de propagação.
        </AlertDescription>
      </Alert>

      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-foreground">Tipo do Negócio</CardTitle>
          <CardDescription>
            O tipo foi sugerido pela categoria principal, mas você pode trocar manualmente.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <RadioGroup value={businessType} onValueChange={handleBusinessTypeChange}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {businessTypeOptions.map((option) => (
                <div key={option.value} className="flex items-center space-x-2">
                  <RadioGroupItem value={option.value} id={option.value} />
                  <Label htmlFor={option.value} className="flex items-center gap-2 cursor-pointer text-foreground">
                    <span className="text-2xl">{option.icon}</span>
                    {option.label}
                  </Label>
                </div>
              ))}
            </div>
          </RadioGroup>
        </CardContent>
      </Card>

      <Card className="bg-card border-border">
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle className="text-foreground">Diretórios Recomendados</CardTitle>
              <CardDescription>
                Selecionados automaticamente para {selectedBusinessTypeLabel}. O sistema só automatiza o que é seguro; formulários com login/captcha viram tarefas assistidas para evitar bloqueios e erros.
              </CardDescription>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={handleSelectRecommended}>
                Aplicar recomendados
              </Button>
              <Button variant="outline" size="sm" onClick={handleSelectAllVisible}>
                Selecionar visíveis
              </Button>
              <Button variant="outline" size="sm" onClick={handleDeselectAll}>
                Limpar
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {relevantDirs.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {relevantDirs.map((dir) => renderDirectoryCard(dir, 'recommended'))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Nenhum diretório recomendado encontrado para este tipo. Use os demais diretórios abaixo.</p>
          )}
        </CardContent>
      </Card>


      {otherDirs.length > 0 && (
        <Card className="bg-card border-border">
          <CardHeader>
            <Button
              variant="ghost"
              className="w-full flex items-center justify-between p-0 hover:bg-transparent"
              onClick={() => setShowAllDirectories(!showAllDirectories)}
            >
              <div className="text-left">
                <CardTitle className="text-foreground">Outros Diretórios Disponíveis</CardTitle>
                <CardDescription>{otherDirs.length} diretórios adicionais</CardDescription>
              </div>
              {showAllDirectories ? <ChevronUp className="text-foreground" /> : <ChevronDown className="text-foreground" />}
            </Button>
          </CardHeader>

          {showAllDirectories && (
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {otherDirs.map((dir) => renderDirectoryCard(dir, 'other'))}
              </div>
            </CardContent>
          )}
        </Card>
      )}

      {selectedChannels.length > 0 && (
        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription className="flex items-center gap-2">
            <Badge variant="default">{selectedChannels.length}</Badge>
            {selectedChannels.length === 1 ? 'diretório selecionado' : 'diretórios selecionados'}
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
};

export default ChannelsStep;
