import { Check } from "lucide-react";

interface FormProgressProps {
  currentStep: number;
  totalSteps: number;
}

const steps = [
  "Básico",
  "Endereço",
  "Contato",
  "Horários",
  "Categorias",
  "Canais",
  "Revisar"
];

const FormProgress = ({ currentStep, totalSteps }: FormProgressProps) => {
  return (
    <div className="mb-8">
      <div className="flex items-center justify-between mb-4">
        {steps.map((step, index) => {
          const stepNumber = index + 1;
          const isActive = stepNumber === currentStep;
          const isCompleted = stepNumber < currentStep;
          
          return (
            <div key={stepNumber} className="flex items-center flex-1">
              <div className="flex flex-col items-center relative">
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold transition-all ${
                    isCompleted
                      ? "bg-accent text-accent-foreground"
                      : isActive
                      ? "bg-brand-purple text-white ring-4 ring-brand-purple/20"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {isCompleted ? <Check className="h-5 w-5" /> : stepNumber}
                </div>
                <span className={`text-xs mt-2 hidden md:block ${isActive ? "text-foreground font-medium" : "text-muted-foreground"}`}>
                  {step}
                </span>
              </div>
              
              {stepNumber < totalSteps && (
                <div className="flex-1 h-0.5 mx-2 mb-6">
                  <div
                    className={`h-full transition-all ${
                      stepNumber < currentStep ? "bg-accent" : "bg-muted"
                    }`}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default FormProgress;
