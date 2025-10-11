import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Calendar, TrendingUp, TrendingDown, RefreshCw, Check } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { WeeklyExpectedMoves, FuturesContract } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";

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

  const generateMovesMutation = useMutation({
    mutationFn: async () => {
      if (!contracts) return;
      
      const promises = contracts.map(contract =>
        apiRequest('POST', '/api/weekly-moves/generate', {
          contractSymbol: contract.symbol,
          currentPrice: contract.currentPrice,
          weeklyVolatility: contract.weeklyVolatility || 0.20, // Use contract's weekly volatility
        })
      );
      
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

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold" data-testid="text-page-title">Weekly Expected Moves</h1>
          <p className="text-muted-foreground mt-1">
            Monday-Friday price movement tracking based on IV
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
              Click "Generate Moves" to calculate expected price movements for the week
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {weeklyMoves.map((moves) => (
            <Card key={moves.id} data-testid={`card-weekly-${moves.contractSymbol}`}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="font-mono text-2xl">{moves.contractSymbol}</CardTitle>
                    <p className="text-sm text-muted-foreground mt-1">
                      Week Starting: {new Date(moves.weekStartDate).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <Badge variant="outline" className="font-mono">
                      IV: {(moves.impliedVolatility * 100).toFixed(1)}%
                    </Badge>
                    <span className="text-sm text-muted-foreground">
                      Open: ${moves.weekOpenPrice.toFixed(2)}
                    </span>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
                  {DAYS.map((day) => {
                    const { dayCapitalized, expectedHigh, expectedLow, actualClose } = getDayData(moves, day);
                    const isCurrent = isCurrentDay(day);
                    const status = getDayStatus(expectedHigh, expectedLow, actualClose);
                    
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
                                ${expectedHigh.toFixed(2)}
                              </span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-xs text-muted-foreground">Low</span>
                              <span className="text-sm font-mono text-destructive">
                                ${expectedLow.toFixed(2)}
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
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground">Current Day:</span>
                      <span className="ml-2 font-medium capitalize">{moves.currentDayOfWeek}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Weekly Vol:</span>
                      <span className="ml-2 font-mono">{(moves.weeklyVolatility * 100).toFixed(2)}%</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Daily Vol:</span>
                      <span className="ml-2 font-mono">{(moves.weeklyVolatility / Math.sqrt(5) * 100).toFixed(2)}%</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Last Updated:</span>
                      <span className="ml-2">{new Date(moves.updatedAt).toLocaleTimeString()}</span>
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
