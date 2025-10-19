import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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
import { TrendingUp, Loader2, Clock } from "lucide-react";
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

interface DailyIVRecord {
  contractSymbol: string;
  dailyIv: number;
  date: Date;
  lastUpdated: Date;
  source: string;
}

export function IVInputDialog({ contracts }: IVInputDialogProps) {
  const [open, setOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch latest daily IVs for all contracts in a single query
  const { data: dailyIVMap } = useQuery<Record<string, DailyIVRecord>>({
    queryKey: ["/api/daily-iv", "all-contracts"],
    queryFn: async () => {
      const ivMap: Record<string, DailyIVRecord> = {};
      
      // Fetch daily IV for each contract
      await Promise.all(
        contracts.map(async (contract) => {
          try {
            const encodedSymbol = encodeURIComponent(contract.symbol);
            const response = await fetch(`/api/daily-iv/${encodedSymbol}`);
            if (response.ok) {
              const data = await response.json();
              ivMap[contract.symbol] = data;
            }
          } catch (error) {
            console.log(`No daily IV found for ${contract.symbol}`);
          }
        })
      );
      
      return ivMap;
    },
    enabled: open && contracts.length > 0, // Only fetch when dialog is open
  });

  // Create default values from latest daily IVs or fallback to contract weekly volatility
  const [defaultValues, setDefaultValues] = useState<IVFormValues>({} as IVFormValues);

  useEffect(() => {
    const newDefaults = contracts.reduce((acc, contract) => {
      const dailyIV = dailyIVMap?.[contract.symbol];
      const value = dailyIV?.dailyIv 
        ? dailyIV.dailyIv * 100 
        : contract.weeklyVolatility * 100;
      acc[contract.symbol as keyof IVFormValues] = Number(value.toFixed(2));
      return acc;
    }, {} as IVFormValues);
    
    setDefaultValues(newDefaults);
    form.reset(newDefaults);
  }, [dailyIVMap, open, contracts]);

  const form = useForm<IVFormValues>({
    resolver: zodResolver(ivFormSchema),
    defaultValues,
  });

  const updateDailyIVMutation = useMutation({
    mutationFn: async (values: IVFormValues) => {
      const today = new Date();
      
      // Save each contract's daily IV
      const updates = await Promise.all(
        Object.entries(values).map(async ([symbol, percentage]) => {
          const response = await apiRequest("POST", "/api/daily-iv", {
            contractSymbol: symbol,
            dailyIv: percentage / 100, // Convert percentage to decimal
            date: today.toISOString(),
            source: 'manual',
          });
          return response.json();
        })
      );

      return updates;
    },
    onSuccess: () => {
      // Invalidate all relevant queries
      queryClient.invalidateQueries({ queryKey: ["/api/contracts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/predictions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/daily-iv"] });
      
      toast({
        title: "Daily IV Values Updated",
        description: "Successfully saved daily IV for all contracts.",
      });
      setOpen(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Update Failed",
        description: error.message || "Failed to update daily IV values",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (values: IVFormValues) => {
    updateDailyIVMutation.mutate(values);
  };

  // Format relative time (e.g., "2 hours ago")
  const getRelativeTime = (date: Date | undefined) => {
    if (!date) return "Never";
    const now = new Date();
    const diffMs = now.getTime() - new Date(date).getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
  };

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
          <DialogTitle>Update Daily IV Values</DialogTitle>
          <DialogDescription>
            Enter the daily IV percentages from Charles Schwab. These values are used for tactical daily predictions.
            Weekly IV (for strategic weekly predictions) is locked when generated on Saturday.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-1 gap-4">
              {contracts.map((contract) => {
                const dailyIV = dailyIVMap?.[contract.symbol];
                const weeklyIV = contract.weeklyVolatility;
                
                return (
                  <FormField
                    key={contract.symbol}
                    control={form.control}
                    name={contract.symbol as keyof IVFormValues}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center justify-between">
                          <span className="font-semibold">{contract.symbol}</span>
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
                        <div className="flex flex-col gap-1 text-xs">
                          <FormDescription className="flex items-center gap-2">
                            <span className="font-medium text-primary">Daily IV:</span>
                            <span>
                              {dailyIV ? `${(dailyIV.dailyIv * 100).toFixed(2)}%` : "Not set"}
                            </span>
                            {dailyIV && (
                              <span className="flex items-center gap-1 text-muted-foreground">
                                <Clock className="h-3 w-3" />
                                {getRelativeTime(dailyIV.lastUpdated)}
                              </span>
                            )}
                          </FormDescription>
                          <FormDescription className="flex items-center gap-2">
                            <span className="font-medium text-muted-foreground">Weekly IV:</span>
                            <span className="text-muted-foreground">
                              {(weeklyIV * 100).toFixed(2)}% (locked)
                            </span>
                          </FormDescription>
                        </div>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                );
              })}
            </div>

            <DialogFooter className="flex items-center justify-between pt-4 border-t">
              <p className="text-xs text-muted-foreground flex items-center gap-2">
                <Clock className="h-3 w-3" />
                Daily IVs update independently from weekly strategic predictions
              </p>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setOpen(false)}
                  disabled={updateDailyIVMutation.isPending}
                  data-testid="button-cancel-iv"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={updateDailyIVMutation.isPending}
                  data-testid="button-submit-iv"
                >
                  {updateDailyIVMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    "Save Daily IV"
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
