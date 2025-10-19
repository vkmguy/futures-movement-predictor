import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Activity, Clock } from "lucide-react";
import { ExportMenu } from "@/components/export-menu";
import { exportToCSV, exportToJSON, preparePredictionsForExport } from "@/lib/export-utils";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { DailyPrediction, FuturesContract, DailyIvHistory, WeeklyIvOverride } from "@shared/schema";
import { roundToTick } from "@shared/utils";

export default function Predictions() {
  const [volatilityModel, setVolatilityModel] = useState<string>("standard");
  
  const { data: predictions, isLoading } = useQuery<DailyPrediction[]>({
    queryKey: ['/api/predictions', 'ALL'],
  });

  const { data: contracts } = useQuery<FuturesContract[]>({
    queryKey: ['/api/contracts'],
  });

  // Fetch daily IVs for all contracts
  const { data: dailyIVs, isLoading: isLoadingDailyIVs } = useQuery<Record<string, DailyIvHistory>>({
    queryKey: ['/api/daily-iv', 'all'],
    queryFn: async () => {
      if (!contracts) return {};
      
      const ivMap: Record<string, DailyIvHistory> = {};
      
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
            console.log(`No daily IV found for ${contract.symbol}, will use weekly volatility`);
          }
        })
      );
      
      return ivMap;
    },
    enabled: !!contracts && contracts.length > 0,
  });

  // Fetch weekly IVs for all contracts
  const { data: weeklyIVs } = useQuery<Record<string, WeeklyIvOverride>>({
    queryKey: ['/api/weekly-iv', 'all'],
    queryFn: async () => {
      if (!contracts) return {};
      
      const ivMap: Record<string, WeeklyIvOverride> = {};
      
      // Fetch weekly IV for each contract
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
    enabled: !!contracts && contracts.length > 0,
  });

  // Create contract lookup map for tick size access
  const contractsBySymbol = contracts?.reduce((map, contract) => {
    map[contract.symbol] = contract;
    return map;
  }, {} as Record<string, FuturesContract>) || {};

  const regeneratePredictionsMutation = useMutation({
    mutationFn: async (model: string) => {
      if (!contracts) return;
      
      const promises = contracts.map(contract => {
        // NEW METHODOLOGY: Use daily IV if available (tactical), otherwise fallback to weekly volatility
        const dailyIV = dailyIVs?.[contract.symbol];
        const annualizedIV = dailyIV?.dailyIv || contract.weeklyVolatility;
        
        return apiRequest('POST', '/api/generate-prediction', {
          contractSymbol: contract.symbol,
          currentPrice: contract.currentPrice,
          annualizedIV: annualizedIV, // NEW: Using annualized IV for predictions
          model: model,
          recentPriceChange: contract.dailyChangePercent,
        });
      });
      
      return await Promise.all(promises);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/predictions'] });
    },
  });

  // Regenerate predictions when volatility model changes or daily IVs update
  useEffect(() => {
    if (contracts && contracts.length > 0 && dailyIVs !== undefined) {
      regeneratePredictionsMutation.mutate(volatilityModel);
    }
  }, [volatilityModel, dailyIVs]);

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

  if (isLoading || isLoadingDailyIVs || regeneratePredictionsMutation.isPending) {
    return (
      <div className="space-y-6 p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold">Movement Predictions</h1>
            <p className="text-muted-foreground mt-1">
              {regeneratePredictionsMutation.isPending 
                ? `Calculating predictions using ${volatilityModel.toUpperCase()} model...`
                : "Loading predictions..."}
            </p>
          </div>
        </div>
        <Skeleton className="h-[200px]" />
      </div>
    );
  }


  const handleExportCSV = () => {
    if (predictions && predictions.length > 0) {
      const data = preparePredictionsForExport(predictions);
      exportToCSV(data, `predictions-${new Date().toISOString().split('T')[0]}.csv`);
    }
  };

  const handleExportJSON = () => {
    if (predictions && predictions.length > 0) {
      const data = preparePredictionsForExport(predictions);
      exportToJSON(data, `predictions-${new Date().toISOString().split('T')[0]}.json`);
    }
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold" data-testid="text-page-title">Movement Predictions</h1>
          <p className="text-muted-foreground mt-1">
            Daily tactical predictions using latest IV values
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-muted-foreground" />
            <Select value={volatilityModel} onValueChange={setVolatilityModel}>
              <SelectTrigger className="w-[160px]" data-testid="select-volatility-model">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="standard">Standard (√5)</SelectItem>
                <SelectItem value="garch">GARCH(1,1)</SelectItem>
                <SelectItem value="ewma">EWMA</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <ExportMenu 
            onExportCSV={handleExportCSV} 
            onExportJSON={handleExportJSON}
            disabled={!predictions || predictions.length === 0}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {predictions?.map((prediction) => {
          const contract = contractsBySymbol[prediction.contractSymbol];
          if (!contract) return null;
          
          // Get daily IV data for this contract
          const dailyIV = dailyIVs?.[prediction.contractSymbol];
          const usingDailyIV = !!dailyIV;
          
          // Round predicted prices to valid tick increments
          const predictedMin = roundToTick(prediction.predictedMin, contract.tickSize);
          const predictedMax = roundToTick(prediction.predictedMax, contract.tickSize);
          const range = predictedMax - predictedMin;
          const rangePercent = (range / prediction.currentPrice) * 100;

          return (
            <Card key={prediction.id} data-testid={`card-prediction-detail-${prediction.contractSymbol}`}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Activity className="h-6 w-6 text-muted-foreground" />
                    <div>
                      <CardTitle className="font-mono">{prediction.contractSymbol}</CardTitle>
                      <p className="text-sm text-muted-foreground">
                        {new Date(prediction.date).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {usingDailyIV && (
                      <Badge variant="outline" className="text-xs">
                        Daily IV
                      </Badge>
                    )}
                    <Badge variant="outline" className="font-mono">
                      {volatilityModel === 'standard' ? '√5' : volatilityModel.toUpperCase()}
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="flex flex-col gap-1">
                    <span className="text-xs text-muted-foreground">Current Price</span>
                    <span className="text-lg font-mono font-bold">
                      ${prediction.currentPrice.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-xs text-muted-foreground">Min Expected</span>
                    <span className="text-lg font-mono font-semibold text-destructive">
                      ${predictedMin.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-xs text-muted-foreground">Max Expected</span>
                    <span className="text-lg font-mono font-semibold text-primary">
                      ${predictedMax.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-xs text-muted-foreground">Range</span>
                    <span className="text-lg font-mono font-semibold">
                      ±{rangePercent.toFixed(2)}%
                    </span>
                  </div>
                </div>

                <div className="relative h-3 rounded-full bg-muted overflow-hidden">
                  <div 
                    className="absolute h-full bg-gradient-to-r from-destructive via-muted-foreground to-primary opacity-40"
                    style={{ width: '100%' }}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2 border-t border-card-border">
                  <div className="flex flex-col gap-1">
                    <span className="text-xs text-muted-foreground font-medium">
                      Annualized IV (Tactical)
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-mono font-semibold text-primary">
                        {dailyIV ? `${(dailyIV.dailyIv * 100).toFixed(2)}%` : "Not set"}
                      </span>
                      {dailyIV && (
                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          {getRelativeTime(dailyIV.lastUpdated)}
                        </span>
                      )}
                    </div>
                    {!dailyIV && (
                      <span className="text-xs text-muted-foreground italic">
                        Using weekly IV
                      </span>
                    )}
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-xs text-muted-foreground font-medium">
                      Annualized IV (Strategic)
                    </span>
                    {weeklyIVs?.[prediction.contractSymbol] ? (
                      <>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-mono font-semibold text-primary">
                            {(weeklyIVs[prediction.contractSymbol].weeklyIv * 100).toFixed(2)}%
                          </span>
                          <Badge variant="default" className="text-xs">Manual</Badge>
                        </div>
                        <span className="text-xs text-muted-foreground">
                          Updated {getRelativeTime(weeklyIVs[prediction.contractSymbol].lastUpdated)}
                        </span>
                      </>
                    ) : (
                      <>
                        <span className="text-sm font-mono font-medium text-muted-foreground">
                          {(contract.weeklyVolatility * 100).toFixed(2)}%
                        </span>
                        <span className="text-xs text-muted-foreground italic">
                          Locked (Saturday)
                        </span>
                      </>
                    )}
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-xs text-muted-foreground font-medium">
                      Daily Volatility ({contract.daysRemaining}d)
                    </span>
                    <span className="text-sm font-mono font-semibold text-primary">
                      {(prediction.dailyVolatility * 100).toFixed(2)}%
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {(prediction.confidence * 100).toFixed(0)}% confidence
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
