import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Calendar, TrendingUp, TrendingDown, RefreshCw, Check, Trash2, Clock } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { WeeklyExpectedMoves, FuturesContract, WeeklyIvOverride } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { roundToTick } from "@shared/utils";

const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'] as const;
type DayOfWeek = typeof DAYS[number];

export default function WeeklyTracker() {
  const { toast } = useToast();

  const { data: weeklyMoves, isLoading } = useQuery<WeeklyExpectedMoves[]>({
    queryKey: ['/api/weekly-moves'],
  });

  const { data: contracts } = useQuery<FuturesContract[]>({
    queryKey: ['/api/contracts'],
  });

  // Fetch manual weekly IV overrides for all contracts
  const { data: weeklyIVMap } = useQuery<Record<string, WeeklyIvOverride>>({
    queryKey: ["/api/weekly-iv", "all-contracts"],
    queryFn: async () => {
      if (!contracts) return {};
      
      const ivMap: Record<string, WeeklyIvOverride> = {};
      
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
            console.log(`No manual weekly IV found for ${contract.symbol}`);
          }
        })
      );
      
      return ivMap;
    },
    enabled: !!contracts && contracts.length > 0,
  });

  // Create contract lookup map for tick size access
  const contractsBySymbol = contracts?.reduce((map, contract) => {
    map[contract.symbol] = contract;
    return map;
  }, {} as Record<string, FuturesContract>) || {};

  const generateMovesMutation = useMutation({
    mutationFn: async () => {
      if (!contracts) return;
      
      const promises = contracts.map(contract => {
        // NEW METHODOLOGY: Prioritize manual weekly IV over contract's weekly volatility
        const weeklyIV = weeklyIVMap?.[contract.symbol];
        const annualizedIV = weeklyIV ? weeklyIV.weeklyIv : contract.weeklyVolatility || 0.20;
        
        return apiRequest('POST', '/api/weekly-moves/generate', {
          contractSymbol: contract.symbol,
          currentPrice: contract.currentPrice,
          annualizedIV, // NEW: Using annualized IV parameter
        });
      });
      
      return await Promise.all(promises);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/weekly-moves'] });
      toast({
        title: "Weekly Moves Generated",
        description: "Expected moves calculated for all contracts",
      });
    },
  });

  const updateActualCloseMutation = useMutation({
    mutationFn: async ({ symbol, day, price }: { symbol: string; day: string; price: number }) => {
      return await apiRequest('PATCH', `/api/weekly-moves/${symbol}/update-actual`, {
        day,
        actualClose: price,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/weekly-moves'] });
      toast({
        title: "Actual Close Updated",
        description: "Price recorded successfully",
      });
    },
  });

  const deleteWeeklyMovesMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest('DELETE', `/api/weekly-moves/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/weekly-moves'] });
      toast({
        title: "Weekly Data Deleted",
        description: "Successfully removed weekly moves",
      });
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-6 p-6">
        <Skeleton className="h-[200px]" />
      </div>
    );
  }

  const getDayData = (moves: WeeklyExpectedMoves, day: DayOfWeek) => {
    const dayCapitalized = day.charAt(0).toUpperCase() + day.slice(1);
    const expectedHigh = moves[`${day}ExpectedHigh` as keyof WeeklyExpectedMoves] as number;
    const expectedLow = moves[`${day}ExpectedLow` as keyof WeeklyExpectedMoves] as number;
    const actualClose = moves[`${day}ActualClose` as keyof WeeklyExpectedMoves] as number | null;
    
    return { dayCapitalized, expectedHigh, expectedLow, actualClose };
  };

  const isCurrentDay = (day: DayOfWeek): boolean => {
    const today = new Date().toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
    return day === today;
  };

  const getDayStatus = (expectedHigh: number, expectedLow: number, actualClose: number | null) => {
    if (!actualClose) return null;
    
    if (actualClose > expectedHigh) return 'above';
    if (actualClose < expectedLow) return 'below';
    return 'within';
  };

  const getRelativeTime = (date: Date | undefined) => {
    if (!date) return "Never";
    const diffMs = Date.now() - new Date(date).getTime();
    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    return hours < 24 ? `${hours}h ago` : `${Math.floor(hours / 24)}d ago`;
  };

  // NEW FEATURE: Get only remaining trading days in the week
  // Monday → shows Mon-Fri, Tuesday → shows Tue-Fri, Wednesday → shows Wed-Fri, etc.
  const getRemainingDays = (): DayOfWeek[] => {
    const today = new Date().getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
    
    // Weekend: Show all days for upcoming week
    if (today === 0 || today === 6) {
      return [...DAYS];
    }
    
    // Weekday: Show only remaining days (including today)
    // Monday (1) → all 5 days, Tuesday (2) → 4 days, ..., Friday (5) → 1 day
    const remainingDaysCount = 6 - today; // Monday=5, Tuesday=4, ..., Friday=1
    return DAYS.slice(5 - remainingDaysCount); // Slice from appropriate start index
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold" data-testid="text-page-title">Weekly Expected Moves</h1>
          <p className="text-muted-foreground mt-1">
            Forward-looking predictions for upcoming week (generated Saturday after market close)
          </p>
        </div>
        <Button 
          onClick={() => generateMovesMutation.mutate()}
          disabled={generateMovesMutation.isPending || !contracts}
          data-testid="button-generate-moves"
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${generateMovesMutation.isPending ? 'animate-spin' : ''}`} />
          {generateMovesMutation.isPending ? 'Generating...' : 'Generate Moves'}
        </Button>
      </div>

      {(!weeklyMoves || weeklyMoves.length === 0) ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Calendar className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Weekly Data</h3>
            <p className="text-sm text-muted-foreground text-center max-w-md mb-4">
              Weekly moves predict the upcoming week's expected price movements. These strategic predictions
              are calculated on Saturday (after the trading week closes) using Friday's closing IV data
              to forecast next Monday-Friday ranges. Click "Generate Moves" to create predictions for next week.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {weeklyMoves.map((moves) => (
            <Card key={moves.id} data-testid={`card-weekly-${moves.contractSymbol}`}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <CardTitle className="font-mono text-2xl">{moves.contractSymbol}</CardTitle>
                    <p className="text-sm text-muted-foreground mt-1">
                      Week Starting: {new Date(moves.weekStartDate).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="flex flex-col items-end gap-2">
                      <div className="flex items-center gap-2">
                        <Badge 
                          variant={weeklyIVMap?.[moves.contractSymbol] ? "default" : "outline"} 
                          className="font-mono"
                        >
                          IV: {weeklyIVMap?.[moves.contractSymbol] 
                            ? (weeklyIVMap[moves.contractSymbol].weeklyIv * 100).toFixed(1) 
                            : (moves.impliedVolatility * 100).toFixed(1)}%
                        </Badge>
                        {weeklyIVMap?.[moves.contractSymbol] && (
                          <Badge variant="default" className="text-xs">
                            Manual
                          </Badge>
                        )}
                      </div>
                      {weeklyIVMap?.[moves.contractSymbol] && (
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          <span>Updated {getRelativeTime(weeklyIVMap[moves.contractSymbol].lastUpdated)}</span>
                        </div>
                      )}
                      <span className="text-sm text-muted-foreground">
                        Open: ${moves.weekOpenPrice.toFixed(2)}
                      </span>
                    </div>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => deleteWeeklyMovesMutation.mutate(moves.id)}
                      disabled={deleteWeeklyMovesMutation.isPending}
                      data-testid={`button-delete-weekly-${moves.contractSymbol}`}
                      className="text-destructive hover:text-destructive hover:bg-destructive/10"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
                  {/* NEW FEATURE: Only show remaining days in the week */}
                  {getRemainingDays().map((day) => {
                    const { dayCapitalized, expectedHigh, expectedLow, actualClose } = getDayData(moves, day);
                    const contract = contractsBySymbol[moves.contractSymbol];
                    const tickSize = contract?.tickSize || 0.01;
                    
                    // Round expected prices to valid tick increments
                    const roundedExpectedHigh = roundToTick(expectedHigh, tickSize);
                    const roundedExpectedLow = roundToTick(expectedLow, tickSize);
                    
                    const isCurrent = isCurrentDay(day);
                    const status = getDayStatus(roundedExpectedHigh, roundedExpectedLow, actualClose);
                    
                    return (
                      <div 
                        key={day}
                        className={`relative p-4 rounded-md border ${isCurrent ? 'border-primary bg-primary/5' : 'border-border'}`}
                        data-testid={`day-${day}`}
                      >
                        {isCurrent && (
                          <div className="absolute -top-2 left-2">
                            <Badge variant="default" className="text-xs">Today</Badge>
                          </div>
                        )}
                        
                        <div className="space-y-2">
                          <h4 className="font-semibold text-sm">{dayCapitalized}</h4>
                          
                          <div className="space-y-1">
                            <div className="flex items-center justify-between">
                              <span className="text-xs text-muted-foreground">High</span>
                              <span className="text-sm font-mono text-primary">
                                ${roundedExpectedHigh.toFixed(2)}
                              </span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-xs text-muted-foreground">Low</span>
                              <span className="text-sm font-mono text-destructive">
                                ${roundedExpectedLow.toFixed(2)}
                              </span>
                            </div>
                          </div>

                          {actualClose !== null && (
                            <div className="pt-2 border-t border-border">
                              <div className="flex items-center justify-between">
                                <span className="text-xs text-muted-foreground">Actual</span>
                                <div className="flex items-center gap-1">
                                  {status === 'above' && <TrendingUp className="h-3 w-3 text-primary" />}
                                  {status === 'below' && <TrendingDown className="h-3 w-3 text-destructive" />}
                                  <span className={`text-sm font-mono font-semibold ${
                                    status === 'above' ? 'text-primary' :
                                    status === 'below' ? 'text-destructive' :
                                    'text-foreground'
                                  }`}>
                                    ${actualClose.toFixed(2)}
                                  </span>
                                </div>
                              </div>
                              <div className="mt-1">
                                <Badge 
                                  variant={status === 'within' ? 'default' : 'destructive'} 
                                  className="w-full justify-center text-xs"
                                >
                                  {status === 'within' ? 'Within Range' : 
                                   status === 'above' ? 'Above Range' : 'Below Range'}
                                </Badge>
                              </div>
                            </div>
                          )}

                          {isCurrent && actualClose === null && contracts && (
                            <div className="pt-2">
                              <Button
                                size="sm"
                                variant="outline"
                                className="w-full text-xs"
                                onClick={() => {
                                  const contract = contracts.find(c => c.symbol === moves.contractSymbol);
                                  if (contract) {
                                    updateActualCloseMutation.mutate({
                                      symbol: moves.contractSymbol,
                                      day,
                                      price: contract.currentPrice,
                                    });
                                  }
                                }}
                                disabled={updateActualCloseMutation.isPending}
                                data-testid={`button-record-close-${day}`}
                              >
                                <Check className="h-3 w-3 mr-1" />
                                Record Close
                              </Button>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="mt-4 pt-4 border-t border-border">
                  <div className="space-y-4">
                    {/* Manual Weekly IV Override (if available) */}
                    {weeklyIVMap?.[moves.contractSymbol] && (
                      <div className="bg-primary/5 p-3 rounded-md border border-primary/20">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold text-primary">Manual Weekly IV (Active)</span>
                            <Badge variant="default" className="text-xs">
                              User Override
                            </Badge>
                          </div>
                          <span className="text-xs text-muted-foreground">
                            Updated: {new Date(weeklyIVMap[moves.contractSymbol].lastUpdated).toLocaleDateString()} {new Date(weeklyIVMap[moves.contractSymbol].lastUpdated).toLocaleTimeString()}
                          </span>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                          <div>
                            <span className="text-muted-foreground">Weekly IV:</span>
                            <span className="ml-2 font-mono font-semibold text-primary">{(weeklyIVMap[moves.contractSymbol].weeklyIv * 100).toFixed(2)}%</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Source:</span>
                            <span className="ml-2 font-medium capitalize">{weeklyIVMap[moves.contractSymbol].source}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Date:</span>
                            <span className="ml-2">{new Date(weeklyIVMap[moves.contractSymbol].date).toLocaleDateString()}</span>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Locked Strategic IV from Saturday Generation */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold">Locked Strategic IV (Saturday Gen)</span>
                          <Badge variant="outline" className="text-xs">
                            Week of {new Date(moves.weekStartDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                          </Badge>
                        </div>
                        <span className="text-xs text-muted-foreground">
                          Generated: {new Date(moves.updatedAt).toLocaleDateString()} {new Date(moves.updatedAt).toLocaleTimeString()}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div>
                          <span className="text-muted-foreground">Current Day:</span>
                          <span className="ml-2 font-medium capitalize">{moves.currentDayOfWeek}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Weekly IV:</span>
                          <span className="ml-2 font-mono font-semibold">{(moves.impliedVolatility * 100).toFixed(2)}%</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Weekly Vol:</span>
                          <span className="ml-2 font-mono">{(moves.weeklyVolatility * 100).toFixed(2)}%</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Daily Vol:</span>
                          <span className="ml-2 font-mono">{(moves.weeklyVolatility / Math.sqrt(5) * 100).toFixed(2)}%</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
