import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { TrendingUp, Loader2 } from "lucide-react";
import type { FuturesContract } from "@shared/schema";

const ivFormSchema = z.object({
  "/NQ": z.number().min(0).max(100),
  "/ES": z.number().min(0).max(100),
  "/YM": z.number().min(0).max(100),
  "/RTY": z.number().min(0).max(100),
  "/GC": z.number().min(0).max(100),
  "/CL": z.number().min(0).max(100),
});

type IVFormValues = z.infer<typeof ivFormSchema>;

interface IVInputDialogProps {
  contracts: FuturesContract[];
}

export function IVInputDialog({ contracts }: IVInputDialogProps) {
  const [open, setOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Create default values from current contracts
  const defaultValues = contracts.reduce((acc, contract) => {
    acc[contract.symbol as keyof IVFormValues] = Number((contract.weeklyVolatility * 100).toFixed(2));
    return acc;
  }, {} as IVFormValues);

  const form = useForm<IVFormValues>({
    resolver: zodResolver(ivFormSchema),
    defaultValues,
  });

  const updateIVMutation = useMutation({
    mutationFn: async (values: IVFormValues) => {
      const updates = Object.entries(values).map(([symbol, percentage]) => ({
        symbol,
        weeklyVolatility: percentage / 100, // Convert percentage to decimal
      }));

      const response = await apiRequest(
        "POST",
        "/api/contracts/batch-update-iv",
        { updates }
      );
      
      return await response.json() as { success: boolean; updatedContracts: FuturesContract[]; message: string };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/contracts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/predictions/ALL"] });
      toast({
        title: "IV Values Updated",
        description: data.message,
      });
      setOpen(false);
      form.reset(form.getValues()); // Reset with new values
    },
    onError: (error: Error) => {
      toast({
        title: "Update Failed",
        description: error.message || "Failed to update IV values",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (values: IVFormValues) => {
    updateIVMutation.mutate(values);
  };

  // Get the latest update time from contracts
  const lastUpdated = contracts.reduce((latest, contract) => {
    const contractDate = new Date(contract.updatedAt);
    return contractDate > latest ? contractDate : latest;
  }, new Date(0));

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="default" data-testid="button-update-iv">
          <TrendingUp className="h-4 w-4 mr-2" />
          Update IV
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Update Implied Volatility Values</DialogTitle>
          <DialogDescription>
            Enter the daily IV percentages from Charles Schwab for each futures contract.
            The app will automatically recalculate all predictions.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {contracts.map((contract) => (
                <FormField
                  key={contract.symbol}
                  control={form.control}
                  name={contract.symbol as keyof IVFormValues}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center justify-between">
                        <span>{contract.symbol}</span>
                        <span className="text-xs text-muted-foreground font-normal">
                          {contract.name}
                        </span>
                      </FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Input
                            type="number"
                            step="0.01"
                            placeholder="0.00"
                            {...field}
                            onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                            className="pr-8"
                            data-testid={`input-iv-${contract.symbol}`}
                          />
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                            %
                          </span>
                        </div>
                      </FormControl>
                      <FormDescription className="text-xs">
                        Current: {(contract.weeklyVolatility * 100).toFixed(2)}%
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              ))}
            </div>

            <DialogFooter className="flex items-center justify-between pt-4 border-t">
              <p className="text-xs text-muted-foreground">
                Last updated: {lastUpdated.toLocaleString()}
              </p>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setOpen(false)}
                  disabled={updateIVMutation.isPending}
                  data-testid="button-cancel-iv"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={updateIVMutation.isPending}
                  data-testid="button-submit-iv"
                >
                  {updateIVMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Updating...
                    </>
                  ) : (
                    "Update All"
                  )}
                </Button>
              </div>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
