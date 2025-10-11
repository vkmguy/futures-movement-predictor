import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface ContractSelectorProps {
  value: string;
  onValueChange: (value: string) => void;
}

const contracts = [
  { value: "ALL", label: "All Contracts" },
  { value: "/NQ", label: "/NQ - Nasdaq 100" },
  { value: "/ES", label: "/ES - S&P 500" },
  { value: "/YM", label: "/YM - Dow Jones" },
  { value: "/RTY", label: "/RTY - Russell 2000" },
  { value: "/GC", label: "/GC - Gold" },
  { value: "/CL", label: "/CL - Crude Oil" },
];

export function ContractSelector({ value, onValueChange }: ContractSelectorProps) {
  return (
    <Select value={value} onValueChange={onValueChange}>
      <SelectTrigger className="w-[200px]" data-testid="select-contract">
        <SelectValue placeholder="Select contract" />
      </SelectTrigger>
      <SelectContent>
        {contracts.map((contract) => (
          <SelectItem key={contract.value} value={contract.value} data-testid={`option-${contract.value}`}>
            {contract.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
