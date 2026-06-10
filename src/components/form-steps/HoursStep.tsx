import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";

interface HoursStepProps {
  formData: any;
  updateFormData: (field: string, value: any) => void;
}

const weekDays = [
  { key: "MONDAY", label: "Segunda-feira" },
  { key: "TUESDAY", label: "Terça-feira" },
  { key: "WEDNESDAY", label: "Quarta-feira" },
  { key: "THURSDAY", label: "Quinta-feira" },
  { key: "FRIDAY", label: "Sexta-feira" },
  { key: "SATURDAY", label: "Sábado" },
  { key: "SUNDAY", label: "Domingo" },
];

const HoursStep = ({ formData, updateFormData }: HoursStepProps) => {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-2xl font-bold text-foreground mb-2">Horários de Funcionamento</h3>
        <p className="text-muted-foreground">Configure os horários para cada dia da semana</p>
      </div>

      <div className="space-y-3">
        {weekDays.map(({ key, label }) => {
          const isClosed = formData.hours?.[key]?.closed;
          
          return (
            <div key={key} className="flex items-center gap-4 p-4 rounded-lg bg-muted/30 border border-border">
              <div className="w-32">
                <Label className="text-sm font-medium">{label}</Label>
              </div>
              
              <div className="flex items-center gap-3 flex-1">
                <div className="flex items-center gap-2">
                  <Input
                    type="time"
                    disabled={isClosed}
                    value={formData.hours?.[key]?.open || "09:00"}
                    onChange={(e) => updateFormData(`hours.${key}.open`, e.target.value)}
                    className="w-32"
                  />
                  <span className="text-muted-foreground">às</span>
                  <Input
                    type="time"
                    disabled={isClosed}
                    value={formData.hours?.[key]?.close || "18:00"}
                    onChange={(e) => updateFormData(`hours.${key}.close`, e.target.value)}
                    className="w-32"
                  />
                </div>
                
                <div className="flex items-center gap-2">
                  <Checkbox
                    id={`closed-${key}`}
                    checked={isClosed}
                    onCheckedChange={(checked) => updateFormData(`hours.${key}.closed`, checked)}
                  />
                  <Label htmlFor={`closed-${key}`} className="text-sm cursor-pointer">
                    Fechado
                  </Label>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default HoursStep;
