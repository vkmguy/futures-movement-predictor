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
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [pendingValues, setPendingValues] = useState<IVFormValues | null>(null);
  const [existingUpdates, setExistingUpdates] = useState<any[]>([]);
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
    mutationFn: async ({ values, confirmOverwrite = false }: { values: IVFormValues; confirmOverwrite?: boolean }) => {
      const updates = Object.entries(values).map(([symbol, percentage]) => ({
        symbol,
        weeklyVolatility: percentage / 100, // Convert percentage to decimal
      }));

      try {
        const response = await apiRequest(
          "POST",
          "/api/contracts/batch-update-iv",
          { updates, confirmOverwrite }
        );
        
        return await response.json() as { success: boolean; updatedContracts: FuturesContract[]; message: string };
      } catch (error: any) {
        // Check if it's a 409 (Conflict) error requiring confirmation
        if (error.message && error.message.startsWith("409:")) {
          // Parse the 409 response body
          const errorBody = error.message.substring(5); // Remove "409: " prefix
          const data = JSON.parse(errorBody);
          return { requiresConfirmation: true, ...data };
        }
        // Re-throw other errors
        throw error;
      }
    },
    onSuccess: (data) => {
      if (data.requiresConfirmation) {
        // Show confirmation dialog
        setExistingUpdates(data.existingUpdates || []);
        setConfirmDialogOpen(true);
        return;
      }
      
      queryClient.invalidateQueries({ queryKey: ["/api/contracts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/predictions/ALL"] });
      toast({
        title: "IV Values Updated",
        description: data.message,
      });
      setOpen(false);
      setPendingValues(null);
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
    setPendingValues(values);
    updateIVMutation.mutate({ values });
  };

  const handleConfirmOverwrite = () => {
    if (pendingValues) {
      updateIVMutation.mutate({ values: pendingValues, confirmOverwrite: true });
      setConfirmDialogOpen(false);
    }
  };

  const handleCancelOverwrite = () => {
    setConfirmDialogOpen(false);
    setPendingValues(null);
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

      {/* Confirmation Dialog for Overwriting Same-Day Updates */}
      <Dialog open={confirmDialogOpen} onOpenChange={setConfirmDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Overwrite Today's IV Updates?</DialogTitle>
            <DialogDescription>
              You have already updated IV values today for {existingUpdates.length} contract{existingUpdates.length > 1 ? 's' : ''}. 
              Do you want to overwrite the existing values?
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-4">
            {existingUpdates.map((update: any) => (
              <div key={update.symbol} className="flex items-center justify-between p-3 border rounded-md">
                <div>
                  <p className="font-medium">{update.symbol}</p>
                  <p className="text-sm text-muted-foreground">
                    Current: {(update.currentValue * 100).toFixed(2)}% → New: {(update.newValue * 100).toFixed(2)}%
                  </p>
                </div>
                <p className="text-xs text-muted-foreground">
                  Last updated: {new Date(update.updatedAt).toLocaleTimeString()}
                </p>
              </div>
            ))}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={handleCancelOverwrite}
              disabled={updateIVMutation.isPending}
              data-testid="button-cancel-overwrite"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleConfirmOverwrite}
              disabled={updateIVMutation.isPending}
              data-testid="button-confirm-overwrite"
            >
              {updateIVMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Updating...
                </>
              ) : (
                "Yes, Overwrite"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Dialog>
  );
}
