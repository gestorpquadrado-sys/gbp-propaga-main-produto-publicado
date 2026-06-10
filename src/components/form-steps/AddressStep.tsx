import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface AddressStepProps {
  formData: any;
  updateFormData: (field: string, value: any) => void;
}

const AddressStep = ({ formData, updateFormData }: AddressStepProps) => {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-2xl font-bold text-foreground mb-2">Endereço</h3>
        <p className="text-muted-foreground">Informe o endereço completo do estabelecimento</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="md:col-span-2">
          <Label htmlFor="street">Rua *</Label>
          <Input
            id="street"
            placeholder="Avenida Paulista"
            value={formData.address?.street || ""}
            onChange={(e) => updateFormData("address.street", e.target.value)}
            className="mt-1.5"
          />
        </div>

        <div>
          <Label htmlFor="number">Número *</Label>
          <Input
            id="number"
            placeholder="1000"
            value={formData.address?.number || ""}
            onChange={(e) => updateFormData("address.number", e.target.value)}
            className="mt-1.5"
          />
        </div>

        <div>
          <Label htmlFor="complement">Complemento</Label>
          <Input
            id="complement"
            placeholder="Sala 45"
            value={formData.address?.complement || ""}
            onChange={(e) => updateFormData("address.complement", e.target.value)}
            onBlur={(e) => {
              const value = e.target.value.trim();
              if (!value) {
                updateFormData("address.complement", "N/A");
              }
            }}
            className="mt-1.5"
          />
        </div>

        <div>
          <Label htmlFor="district">Bairro *</Label>
          <Input
            id="district"
            placeholder="Bela Vista"
            value={formData.address?.district || ""}
            onChange={(e) => updateFormData("address.district", e.target.value)}
            className="mt-1.5"
          />
        </div>

        <div>
          <Label htmlFor="city">Cidade *</Label>
          <Input
            id="city"
            placeholder="São Paulo"
            value={formData.address?.city || ""}
            onChange={(e) => updateFormData("address.city", e.target.value)}
            className="mt-1.5"
          />
        </div>

        <div>
          <Label htmlFor="state">Estado *</Label>
          <Input
            id="state"
            placeholder="São Paulo"
            value={formData.address?.state || ""}
            onChange={(e) => updateFormData("address.state", e.target.value)}
            className="mt-1.5"
          />
        </div>

        <div>
          <Label htmlFor="zip">CEP *</Label>
          <Input
            id="zip"
            placeholder="01311-100"
            value={formData.address?.zip || ""}
            onChange={(e) => {
              let value = e.target.value.replace(/\D/g, "");
              if (value.length > 5) {
                value = value.slice(0, 5) + "-" + value.slice(5, 8);
              }
              updateFormData("address.zip", value);
            }}
            className="mt-1.5"
            maxLength={9}
          />
        </div>
      </div>
    </div>
  );
};

export default AddressStep;
