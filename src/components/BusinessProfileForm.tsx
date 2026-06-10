import { useState, useEffect } from "react";
import { useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import FormProgress from "./FormProgress";
import BasicInfoStep from "./form-steps/BasicInfoStep";
import AddressStep from "./form-steps/AddressStep";
import ContactStep from "./form-steps/ContactStep";
import HoursStep from "./form-steps/HoursStep";
import CategoriesStep from "./form-steps/CategoriesStep";
import ChannelsStep from "./form-steps/ChannelsStep";
import ReviewStep from "./form-steps/ReviewStep";
import { ArrowLeft, ArrowRight, Send, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { ResultsPanel } from "./ResultsPanel";
import { syncBusinessProfile, SyncError } from '@/services/sync-service';
import { saveSyncResults } from '@/services/database-service';
import type { SyncResponse, ChannelResult, BusinessProfile } from '@/types/business-profile';
import { ChannelProgress } from './ChannelProgress';
import type { GoogleLocation } from './GoogleImportModal';

const BusinessProfileForm = () => {
  const location = useLocation();
  const importedLocation = location.state?.importedLocation as GoogleLocation | undefined;
  
  const [currentStep, setCurrentStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'success' | 'error'>('idle');
  const [syncResponse, setSyncResponse] = useState<SyncResponse | null>(null);
  const [channelStatuses, setChannelStatuses] = useState<Record<string, ChannelResult['status']>>({});
  
  const [formData, setFormData] = useState<any>({
    channels: ["apontador", "bing", "yelp"],
    address: {
      complement: "N/A",
    },
    phones: {},
    hours: {},
    categories: { gbpAdditional: [] },
  });

  const totalSteps = 7;

  useEffect(() => {
    if (importedLocation) {
      // Extrair rua e número do address_full
      const addressMatch = importedLocation.address_full?.match(/^(.+?),\s*(\d+.*)?$/);
      const street = addressMatch ? addressMatch[1].trim() : importedLocation.address_full || '';
      const number = addressMatch && addressMatch[2] ? addressMatch[2].trim() : '';
      const fullAddress = importedLocation.address_full || '';
      let neighborhood = importedLocation.address_neighborhood || '';
      if (!neighborhood && fullAddress.includes(" - ")) {
        const parts = fullAddress
          .split(" - ")
          .map((part) => part.trim())
          .filter(Boolean);
        if (parts.length > 1) {
          neighborhood = parts[parts.length - 1];
        }
      }
      const complement =
        (importedLocation as { address_complement?: string }).address_complement?.trim() ||
        "N/A";

      // Mapear horários do GBP para o formato do formulário
      const mappedHours: Record<string, { open: string; close: string; closed: boolean }> = {};
      const weekDayKeys = [
        "MONDAY",
        "TUESDAY",
        "WEDNESDAY",
        "THURSDAY",
        "FRIDAY",
        "SATURDAY",
        "SUNDAY",
      ];

      weekDayKeys.forEach((day) => {
        mappedHours[day] = {
          open: "00:00",
          close: "00:00",
          closed: true,
        };
      });

      Object.entries(importedLocation.hours || {}).forEach(([day, time]) => {
        const normalizedDay = day.toUpperCase();
        mappedHours[normalizedDay] = {
          open: time.open,
          close: time.close,
          closed: false,
        };
      });

      const normalizedGoogleLocationId =
        importedLocation.google_location_id?.startsWith("locations/")
          ? importedLocation.google_location_id
          : importedLocation.google_location_id
            ? `locations/${importedLocation.google_location_id}`
            : "";

      // Preencher formData
      setFormData({
        channels: ["apontador", "bing", "yelp"],
        companyId: importedLocation.company_id,
        locationId: importedLocation.id,
        userId: importedLocation.user_id,
        googleLocationId: normalizedGoogleLocationId,
        googlePlaceId: importedLocation.google_place_id,
        externalId: normalizedGoogleLocationId || importedLocation.google_location_id,
        name: importedLocation.name,
        brand: importedLocation.name,
        description: importedLocation.description,
        website: importedLocation.website,
        
        address: {
          street: street,
          number: number,
          complement: complement,
          district: neighborhood,
          city: importedLocation.address_city,
          state: importedLocation.address_state,
          zip: importedLocation.address_postal_code,
          country: importedLocation.address_country
        },
        
        phones: {
          primary: importedLocation.phone_primary,
          whatsapp: importedLocation.phone_primary,
          additional: importedLocation.phone_additional || ''
        },
        
        hours: mappedHours,
        
        categories: {
          gbpPrimary: importedLocation.category_primary,
          gbpAdditional: importedLocation.categories_additional || []
        }
      });

      toast({
        title: "Dados importados!",
        description: `Perfil "${importedLocation.name}" carregado com sucesso.`,
      });
    }
  }, [importedLocation, toast]);

  const updateFormData = (field: string, value: any) => {
    setFormData((prev: any) => {
      const keys = field.split(".");
      if (keys.length === 1) {
        return { ...prev, [field]: value };
      }
      
      const newData = { ...prev };
      let current = newData;
      for (let i = 0; i < keys.length - 1; i++) {
        if (!current[keys[i]]) current[keys[i]] = {};
        current = current[keys[i]];
      }
      current[keys[keys.length - 1]] = value;
      return newData;
    });
  };

  const validateStep = () => {
    switch (currentStep) {
      case 1:
        if (!formData.externalId || formData.externalId.length < 5) {
          toast({ title: "ID Externo é obrigatório (mín. 5 caracteres)", variant: "destructive" });
          return false;
        }
        if (!formData.name || formData.name.length < 3) {
          toast({ title: "Nome do Negócio é obrigatório (mín. 3 caracteres)", variant: "destructive" });
          return false;
        }
        return true;
      case 2: {
        const { street, number, district, city, state, zip } = formData.address || {};
        if (!street || !number || !district || !city || !state || !zip) {
          toast({ title: "Preencha todos os campos obrigatórios do endereço", variant: "destructive" });
          return false;
        }
        return true;
      }
      case 3:
        if (!formData.phones?.primary) {
          toast({ title: "Telefone Principal é obrigatório", variant: "destructive" });
          return false;
        }
        return true;
      case 6:
        if (!formData.channels || formData.channels.length === 0) {
          toast({ title: "Selecione pelo menos um canal", variant: "destructive" });
          return false;
        }
        return true;
      default:
        return true;
    }
  };

  const handleNext = () => {
    if (validateStep()) {
      setCurrentStep((prev) => Math.min(prev + 1, totalSteps));
    }
  };

  const handlePrevious = () => {
    setCurrentStep((prev) => Math.max(prev - 1, 1));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateStep()) return;

    if (!formData.channels || formData.channels.length === 0) {
      toast({
        title: '⚠️ Nenhum canal selecionado',
        description: 'Selecione pelo menos um canal para sincronizar',
        variant: 'destructive'
      });
      return;
    }

    setIsSubmitting(true);
    setSyncStatus('syncing');

    const initialStatuses = formData.channels.reduce((acc: Record<string, ChannelResult['status']>, channel: string) => {
      acc[channel] = 'syncing';
      return acc;
    }, {});
    setChannelStatuses(initialStatuses);

    try {
      const normalizedGoogleLocationId =
        formData.googleLocationId ||
        (formData.externalId?.startsWith("locations/")
          ? formData.externalId
          : formData.externalId
            ? `locations/${formData.externalId}`
            : undefined);

      const payload: BusinessProfile = {
        ...(formData.companyId && { company_id: formData.companyId }),
        ...(formData.locationId && { location_id: formData.locationId }),
        ...(formData.userId && { user_id: formData.userId }),
        ...(normalizedGoogleLocationId && { google_location_id: normalizedGoogleLocationId }),
        ...(formData.googlePlaceId && { google_place_id: formData.googlePlaceId }),
        ...(formData.facebookPageId && { facebook_page_id: formData.facebookPageId }),
        name: formData.name,
        phone_primary: formData.phones?.primary,
        address_street: formData.address?.street,
        address_city: formData.address?.city,
        address_state: formData.address?.state,
        address_zip: formData.address?.zip,
        channels: formData.channels,
        ...(formData.phones?.whatsapp && { phone_whatsapp: formData.phones.whatsapp }),
        ...(formData.website && { website: formData.website }),
        ...(formData.email && { email: formData.email }),
        ...(formData.description && { description: formData.description }),
        ...(formData.hours && { business_hours: JSON.stringify(formData.hours) }),
        ...(formData.address?.number && { address_number: formData.address.number }),
        ...(formData.address?.complement && { address_complement: formData.address.complement }),
        ...(formData.address?.district && { address_neighborhood: formData.address.district }),
        ...(formData.categories && { categories: [formData.categories.gbpPrimary, ...formData.categories.gbpAdditional] }),
        ...(formData.externalId && { external_id: formData.externalId }),
      };

      const response = await syncBusinessProfile(payload);
      await saveSyncResults(payload, response);

      const finalStatuses = Object.entries(response.results).reduce((acc, [channel, result]) => {
        acc[channel] = result.status;
        return acc;
      }, {} as Record<string, ChannelResult['status']>);

      setChannelStatuses(finalStatuses);
      setSyncResponse(response);
      setSyncStatus('success');
      if (formData.externalId) {
        try {
          const cacheKey = "gbp_directory_status_v1";
          const raw = localStorage.getItem(cacheKey);
          const parsed = raw ? JSON.parse(raw) : {};
          parsed[formData.externalId] = {
            updatedAt: new Date().toISOString(),
            results: response.results,
          };
          localStorage.setItem(cacheKey, JSON.stringify(parsed));
        } catch (storageError) {
          console.warn("Failed to cache directory statuses", storageError);
        }
      }

      toast({
        title: response.success ? '🎉 Sincronização concluída!' : '⚠️ Sincronização parcial',
        description: `${Object.values(response.results).filter(r => ['success', 'sent', 'submitted', 'manual_required', 'pending_review'].includes(r.status)).length} de ${formData.channels.length} canais processados`
      });

    } catch (error) {
      setSyncStatus('error');

      if (error instanceof SyncError) {
        toast({
          title: '❌ Erro na sincronização',
          description: error.message,
          variant: 'destructive'
        });
        console.error('Sync Error:', { message: error.message, statusCode: error.statusCode, details: error.details });
      } else {
        toast({
          title: '❌ Erro inesperado',
          description: 'Ocorreu um erro desconhecido. Verifique o console.',
          variant: 'destructive'
        });
        console.error('Unknown error:', error);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleNewSync = () => {
    setSyncStatus('idle');
    setSyncResponse(null);
    setChannelStatuses({});
    setCurrentStep(1);
    setFormData({
      channels: [],
      address: {},
      phones: {},
      hours: {},
      categories: { gbpAdditional: [] },
    });
  };

  if (syncStatus === 'success' && syncResponse) {
    return <ResultsPanel response={syncResponse} onReset={handleNewSync} />;
  }

  return (
    <Card className="w-full max-w-4xl mx-auto p-8 bg-card shadow-purple">
      <FormProgress currentStep={currentStep} totalSteps={totalSteps} />

      <div className="mt-8">
        {currentStep === 1 && <BasicInfoStep formData={formData} updateFormData={updateFormData} />}
        {currentStep === 2 && <AddressStep formData={formData} updateFormData={updateFormData} />}
        {currentStep === 3 && <ContactStep formData={formData} updateFormData={updateFormData} />}
        {currentStep === 4 && <HoursStep formData={formData} updateFormData={updateFormData} />}
        {currentStep === 5 && <CategoriesStep formData={formData} updateFormData={updateFormData} />}
        {currentStep === 6 && <ChannelsStep formData={formData} updateFormData={updateFormData} />}
        {currentStep === 7 && <ReviewStep formData={formData} />}
      </div>

      <div className="flex justify-between mt-8 pt-6 border-t border-border">
        <Button
          variant="outline"
          onClick={handlePrevious}
          disabled={currentStep === 1 || isSubmitting || syncStatus === 'syncing'}
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Voltar
        </Button>

        {currentStep < totalSteps ? (
          <Button onClick={handleNext} className="bg-accent hover:bg-accent/90">
            Próximo
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        ) : (
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting || syncStatus === 'syncing'}
            className="bg-accent hover:bg-accent/90 shadow-glow"
          >
            {isSubmitting || syncStatus === 'syncing' ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Sincronizando...
              </>
            ) : (
              <>
                Sincronizar Agora
                <Send className="ml-2 h-4 w-4" />
              </>
            )}
          </Button>
        )}
      </div>

      {syncStatus === 'syncing' && (
        <Card className="mt-6 bg-card border-border">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-foreground">
              <Loader2 className="w-5 h-5 animate-spin" />
              Sincronizando...
            </CardTitle>
            <CardDescription>Aguarde enquanto sincronizamos com os canais selecionados</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {formData.channels.map((channel: string) => (
              <ChannelProgress
                key={channel}
                name={channel}
                status={channelStatuses[channel] || 'pending'}
              />
            ))}
          </CardContent>
        </Card>
      )}
    </Card>
  );
};

export default BusinessProfileForm;
