import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Building, MapPin, Phone, Clock, Tag, Share2 } from "lucide-react";

interface ReviewStepProps {
  formData: any;
}

const ReviewStep = ({ formData }: ReviewStepProps) => {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-2xl font-bold text-foreground mb-2">Revisar & Enviar</h3>
        <p className="text-muted-foreground">Revise todos os dados antes de sincronizar</p>
      </div>

      <div className="space-y-4">
        <Card className="p-6">
          <div className="flex items-start gap-3 mb-4">
            <Building className="h-5 w-5 text-brand-purple mt-0.5" />
            <div className="flex-1">
              <h4 className="font-semibold text-foreground mb-3">Informações Básicas</h4>
              <dl className="space-y-2 text-sm">
                <div className="flex gap-2">
                  <dt className="text-muted-foreground w-24">ID:</dt>
                  <dd className="text-foreground font-medium">{formData.externalId || "—"}</dd>
                </div>
                <div className="flex gap-2">
                  <dt className="text-muted-foreground w-24">Nome:</dt>
                  <dd className="text-foreground">{formData.name || "—"}</dd>
                </div>
                {formData.brand && (
                  <div className="flex gap-2">
                    <dt className="text-muted-foreground w-24">Marca:</dt>
                    <dd className="text-foreground">{formData.brand}</dd>
                  </div>
                )}
                {formData.description && (
                  <div className="flex gap-2">
                    <dt className="text-muted-foreground w-24">Descrição:</dt>
                    <dd className="text-foreground">{formData.description}</dd>
                  </div>
                )}
              </dl>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-start gap-3 mb-4">
            <MapPin className="h-5 w-5 text-brand-green mt-0.5" />
            <div className="flex-1">
              <h4 className="font-semibold text-foreground mb-3">Endereço</h4>
              <p className="text-sm text-foreground">
                {formData.address?.street} {formData.address?.number}
                {formData.address?.complement && `, ${formData.address.complement}`}
                <br />
                {formData.address?.district}, {formData.address?.city} - {formData.address?.state}
                <br />
                CEP: {formData.address?.zip}
              </p>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-start gap-3 mb-4">
            <Phone className="h-5 w-5 text-brand-magenta mt-0.5" />
            <div className="flex-1">
              <h4 className="font-semibold text-foreground mb-3">Contato</h4>
              <dl className="space-y-2 text-sm">
                <div className="flex gap-2">
                  <dt className="text-muted-foreground w-24">Telefone:</dt>
                  <dd className="text-foreground">{formData.phones?.primary || "—"}</dd>
                </div>
                {formData.phones?.whatsapp && (
                  <div className="flex gap-2">
                    <dt className="text-muted-foreground w-24">WhatsApp:</dt>
                    <dd className="text-foreground">{formData.phones.whatsapp}</dd>
                  </div>
                )}
                {formData.website && (
                  <div className="flex gap-2">
                    <dt className="text-muted-foreground w-24">Website:</dt>
                    <dd className="text-foreground">{formData.website}</dd>
                  </div>
                )}
              </dl>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-start gap-3 mb-4">
            <Clock className="h-5 w-5 text-accent mt-0.5" />
            <div className="flex-1">
              <h4 className="font-semibold text-foreground mb-3">Horários</h4>
              <div className="text-sm text-muted-foreground">
                {Object.keys(formData.hours || {}).length > 0 ? "Configurado" : "Não configurado"}
              </div>
            </div>
          </div>
        </Card>

        {formData.categories?.gbpPrimary && (
          <Card className="p-6">
            <div className="flex items-start gap-3 mb-4">
              <Tag className="h-5 w-5 text-brand-purple mt-0.5" />
              <div className="flex-1">
                <h4 className="font-semibold text-foreground mb-3">Categorias</h4>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="secondary">{formData.categories.gbpPrimary}</Badge>
                  {formData.categories.gbpAdditional?.map((cat: string) => (
                    <Badge key={cat} variant="outline">
                      {cat}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>
          </Card>
        )}

        <Card className="p-6">
          <div className="flex items-start gap-3 mb-4">
            <Share2 className="h-5 w-5 text-accent mt-0.5" />
            <div className="flex-1">
              <h4 className="font-semibold text-foreground mb-3">Canais Selecionados</h4>
              <div className="flex flex-wrap gap-2">
                {formData.channels?.map((channel: string) => (
                  <Badge key={channel} className="bg-accent text-accent-foreground">
                    {channel.toUpperCase()}
                  </Badge>
                ))}
              </div>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default ReviewStep;
