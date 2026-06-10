import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface ContactStepProps {
  formData: any;
  updateFormData: (field: string, value: any) => void;
}

const ContactStep = ({ formData, updateFormData }: ContactStepProps) => {
  const formatPhone = (value: string) => {
    const numbers = value.replace(/\D/g, "");
    if (numbers.length <= 11) {
      return numbers.replace(/^(\d{2})(\d{5})(\d{4})$/, "+55 ($1) $2-$3");
    }
    return value;
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-2xl font-bold text-foreground mb-2">Contato</h3>
        <p className="text-muted-foreground">Informações de contato do estabelecimento</p>
      </div>

      <div className="space-y-4">
        <div>
          <Label htmlFor="primaryPhone">Telefone Principal *</Label>
          <Input
            id="primaryPhone"
            type="tel"
            placeholder="+55 (11) 99999-9999"
            value={formData.phones?.primary || ""}
            onChange={(e) => {
              const formatted = formatPhone(e.target.value);
              updateFormData("phones.primary", formatted);
            }}
            className="mt-1.5"
          />
        </div>

        <div>
          <Label htmlFor="whatsapp">WhatsApp</Label>
          <Input
            id="whatsapp"
            type="tel"
            placeholder="+55 (11) 99999-9999"
            value={formData.phones?.whatsapp || ""}
            onChange={(e) => {
              const formatted = formatPhone(e.target.value);
              updateFormData("phones.whatsapp", formatted);
            }}
            className="mt-1.5"
          />
          <p className="text-xs text-muted-foreground mt-1">Opcional</p>
        </div>

        <div>
          <Label htmlFor="website">Website</Label>
          <Input
            id="website"
            type="url"
            placeholder="https://pquadrado.com.br"
            value={formData.website || ""}
            onChange={(e) => updateFormData("website", e.target.value)}
            className="mt-1.5"
          />
          <p className="text-xs text-muted-foreground mt-1">Opcional</p>
        </div>

        <div>
          <Label htmlFor="facebookPageId">Facebook Page ID</Label>
          <Input
            id="facebookPageId"
            placeholder="Ex.: 123456789012345"
            value={formData.facebookPageId || ""}
            onChange={(e) => updateFormData("facebookPageId", e.target.value)}
            className="mt-1.5"
          />
          <p className="text-xs text-muted-foreground mt-1">
            Obrigatório somente se o canal Facebook for selecionado.
          </p>
        </div>
      </div>
    </div>
  );
};

export default ContactStep;
