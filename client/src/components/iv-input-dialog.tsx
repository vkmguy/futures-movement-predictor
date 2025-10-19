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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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

interface IVRecord {
  contractSymbol: string;
  dailyIv?: number;
  weeklyIv?: number;
  date: Date;
  lastUpdated: Date;
  source: string;
}

export function IVInputDialog({ contracts }: IVInputDialogProps) {
  const [open, setOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch latest daily IVs for all contracts
  const { data: dailyIVMap } = useQuery<Record<string, IVRecord>>({
    queryKey: ["/api/daily-iv", "all-contracts"],
    queryFn: async () => {
      const ivMap: Record<string, IVRecord> = {};
      
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
    enabled: open && contracts.length > 0,
  });

  // Fetch latest weekly IVs for all contracts
  const { data: weeklyIVMap } = useQuery<Record<string, IVRecord>>({
    queryKey: ["/api/weekly-iv", "all-contracts"],
    queryFn: async () => {
      const ivMap: Record<string, IVRecord> = {};
      
      await Promise.all(
        contracts.map(async (contract) => {
          try {
            const encodedSymbol = encodeURIComponent(contract.symbol);
            const response = await fetch(`/api/weekly-iv/${encodedSymbol}`);
            if (response.ok) {
              const data = await response.json();
              ivMap[contract.symbol] = data;
            }
          } catch (error) {
            console.log(`No weekly IV found for ${contract.symbol}`);
          }
        })
      );
      
      return ivMap;
    },
    enabled: open && contracts.length > 0,
  });

  // Daily IV form defaults
  const [dailyDefaults, setDailyDefaults] = useState<IVFormValues>({} as IVFormValues);
  
  useEffect(() => {
    const newDefaults = contracts.reduce((acc, contract) => {
      const dailyIV = dailyIVMap?.[contract.symbol];
      const value = dailyIV?.dailyIv 
        ? dailyIV.dailyIv * 100 
        : contract.weeklyVolatility * 100;
      acc[contract.symbol as keyof IVFormValues] = Number(value.toFixed(2));
      return acc;
    }, {} as IVFormValues);
    
    setDailyDefaults(newDefaults);
    dailyForm.reset(newDefaults);
  }, [dailyIVMap, open, contracts]);

  // Weekly IV form defaults
  const [weeklyDefaults, setWeeklyDefaults] = useState<IVFormValues>({} as IVFormValues);
  
  useEffect(() => {
    const newDefaults = contracts.reduce((acc, contract) => {
      const weeklyIV = weeklyIVMap?.[contract.symbol];
      const value = weeklyIV?.weeklyIv 
        ? weeklyIV.weeklyIv * 100 
        : contract.weeklyVolatility * 100;
      acc[contract.symbol as keyof IVFormValues] = Number(value.toFixed(2));
      return acc;
    }, {} as IVFormValues);
    
    setWeeklyDefaults(newDefaults);
    weeklyForm.reset(newDefaults);
  }, [weeklyIVMap, open, contracts]);

  const dailyForm = useForm<IVFormValues>({
    resolver: zodResolver(ivFormSchema),
    defaultValues: dailyDefaults,
  });

  const weeklyForm = useForm<IVFormValues>({
    resolver: zodResolver(ivFormSchema),
    defaultValues: weeklyDefaults,
  });

  const updateDailyIVMutation = useMutation({
    mutationFn: async (values: IVFormValues) => {
      const today = new Date();
      
      const updates = await Promise.all(
        Object.entries(values).map(async ([symbol, percentage]) => {
          const response = await apiRequest("POST", "/api/daily-iv", {
            contractSymbol: symbol,
            dailyIv: percentage / 100,
            date: today.toISOString(),
            source: 'manual',
          });
          return response.json();
        })
      );

      return updates;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/contracts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/predictions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/daily-iv"] });
      
      toast({
        title: "Daily IV Values Updated",
        description: "Successfully saved daily IV for tactical predictions.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Update Failed",
        description: error.message || "Failed to update daily IV values",
        variant: "destructive",
      });
    },
  });

  const updateWeeklyIVMutation = useMutation({
    mutationFn: async (values: IVFormValues) => {
      const today = new Date();
      
      const updates = await Promise.all(
        Object.entries(values).map(async ([symbol, percentage]) => {
          const response = await apiRequest("POST", "/api/weekly-iv", {
            contractSymbol: symbol,
            weeklyIv: percentage / 100,
            date: today.toISOString(),
            source: 'manual',
          });
          return response.json();
        })
      );

      return updates;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/contracts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/weekly-moves"] });
      queryClient.invalidateQueries({ queryKey: ["/api/weekly-iv"] });
      
      toast({
        title: "Weekly IV Values Updated",
        description: "Successfully saved weekly IV for strategic predictions.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Update Failed",
        description: error.message || "Failed to update weekly IV values",
        variant: "destructive",
      });
    },
  });

  const onSubmitDaily = (values: IVFormValues) => {
    updateDailyIVMutation.mutate(values);
  };

  const onSubmitWeekly = (values: IVFormValues) => {
    updateWeeklyIVMutation.mutate(values);
  };

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
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Update Implied Volatility Values</DialogTitle>
          <DialogDescription>
            Update daily IV for tactical trading or weekly IV for strategic predictions. Both are independent and can be updated anytime.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="daily" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="daily">Daily IV (Tactical)</TabsTrigger>
            <TabsTrigger value="weekly">Weekly IV (Strategic)</TabsTrigger>
          </TabsList>

          <TabsContent value="daily" className="space-y-4 mt-4">
            <div className="bg-muted/30 p-3 rounded-md border">
              <p className="text-sm text-muted-foreground">
                <strong className="text-foreground">Daily IV (Tactical):</strong> Used for dynamic daily predictions. Update this from your broker data anytime for precise intraday trading decisions.
              </p>
            </div>

            <Form {...dailyForm}>
              <form onSubmit={dailyForm.handleSubmit(onSubmitDaily)} className="space-y-4">
                <div className="grid grid-cols-1 gap-4">
                  {contracts.map((contract) => {
                    const dailyIV = dailyIVMap?.[contract.symbol];
                    
                    return (
                      <FormField
                        key={contract.symbol}
                        control={dailyForm.control}
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
                                  data-testid={`input-daily-iv-${contract.symbol}`}
                                />
                                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                                  %
                                </span>
                              </div>
                            </FormControl>
                            <FormDescription className="flex items-center gap-2">
                              <span className="font-medium">Current Daily IV:</span>
                              <span>
                                {dailyIV ? `${(dailyIV.dailyIv! * 100).toFixed(2)}%` : "Not set"}
                              </span>
                              {dailyIV && (
                                <span className="flex items-center gap-1 text-muted-foreground">
                                  <Clock className="h-3 w-3" />
                                  {getRelativeTime(dailyIV.lastUpdated)}
                                </span>
                              )}
                            </FormDescription>
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
                    Daily IVs persist and won't be reset by automated processes
                  </p>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setOpen(false)}
                      disabled={updateDailyIVMutation.isPending}
                      data-testid="button-cancel-daily-iv"
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      disabled={updateDailyIVMutation.isPending}
                      data-testid="button-submit-daily-iv"
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
          </TabsContent>

          <TabsContent value="weekly" className="space-y-4 mt-4">
            <div className="bg-muted/30 p-3 rounded-md border">
              <p className="text-sm text-muted-foreground">
                <strong className="text-foreground">Weekly IV (Strategic):</strong> Used for weekly tracker and strategic predictions. Update this anytime, especially if you forgot on Saturday or want to adjust from broker data.
              </p>
            </div>

            <Form {...weeklyForm}>
              <form onSubmit={weeklyForm.handleSubmit(onSubmitWeekly)} className="space-y-4">
                <div className="grid grid-cols-1 gap-4">
                  {contracts.map((contract) => {
                    const weeklyIV = weeklyIVMap?.[contract.symbol];
                    
                    return (
                      <FormField
                        key={contract.symbol}
                        control={weeklyForm.control}
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
                                  data-testid={`input-weekly-iv-${contract.symbol}`}
                                />
                                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                                  %
                                </span>
                              </div>
                            </FormControl>
                            <FormDescription className="flex items-center gap-2">
                              <span className="font-medium">Current Weekly IV:</span>
                              <span>
                                {weeklyIV ? `${(weeklyIV.weeklyIv! * 100).toFixed(2)}%` : "Not set"}
                              </span>
                              {weeklyIV && (
                                <span className="flex items-center gap-1 text-muted-foreground">
                                  <Clock className="h-3 w-3" />
                                  {getRelativeTime(weeklyIV.lastUpdated)}
                                </span>
                              )}
                            </FormDescription>
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
                    Weekly IVs can be updated anytime, not just on Saturday
                  </p>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setOpen(false)}
                      disabled={updateWeeklyIVMutation.isPending}
                      data-testid="button-cancel-weekly-iv"
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      disabled={updateWeeklyIVMutation.isPending}
                      data-testid="button-submit-weekly-iv"
                    >
                      {updateWeeklyIVMutation.isPending ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Saving...
                        </>
                      ) : (
                        "Save Weekly IV"
                      )}
                    </Button>
                  </div>
                </DialogFooter>
              </form>
            </Form>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
