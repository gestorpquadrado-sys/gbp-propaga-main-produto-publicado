import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface BasicInfoStepProps {
  formData: any;
  updateFormData: (field: string, value: any) => void;
}

const BasicInfoStep = ({ formData, updateFormData }: BasicInfoStepProps) => {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-2xl font-bold text-foreground mb-2">Informações Básicas</h3>
        <p className="text-muted-foreground">Preencha os dados principais do seu negócio</p>
      </div>

      <div className="space-y-4">
        <div>
          <Label htmlFor="externalId">ID Externo *</Label>
          <Input
            id="externalId"
            placeholder="BR-SAO_PAULO-001"
            value={formData.externalId || ""}
            onChange={(e) => updateFormData("externalId", e.target.value)}
            className="mt-1.5"
          />
          <p className="text-xs text-muted-foreground mt-1">Identificador único, alfanumérico (mín. 5 caracteres)</p>
        </div>

        <div>
          <Label htmlFor="name">Nome do Negócio *</Label>
          <Input
            id="name"
            placeholder="P² São Paulo"
            value={formData.name || ""}
            onChange={(e) => updateFormData("name", e.target.value)}
            className="mt-1.5"
          />
        </div>

        <div>
          <Label htmlFor="brand">Marca</Label>
          <Input
            id="brand"
            placeholder="PQuadrado"
            value={formData.brand || ""}
            onChange={(e) => updateFormData("brand", e.target.value)}
            className="mt-1.5"
          />
          <p className="text-xs text-muted-foreground mt-1">Opcional</p>
        </div>

        <div>
          <Label htmlFor="description">Descrição</Label>
          <Textarea
            id="description"
            placeholder="Agência de marketing digital especializada em SEO local..."
            value={formData.description || ""}
            onChange={(e) => updateFormData("description", e.target.value)}
            className="mt-1.5"
            rows={4}
            maxLength={750}
          />
          <p className="text-xs text-muted-foreground mt-1">
            {formData.description?.length || 0}/750 caracteres
          </p>
        </div>
      </div>
    </div>
  );
};

export default BasicInfoStep;
