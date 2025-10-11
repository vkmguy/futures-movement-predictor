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
import { TrendingUp, TrendingDown, Minus, Activity } from "lucide-react";
import { ExportMenu } from "@/components/export-menu";
import { exportToCSV, exportToJSON, preparePredictionsForExport } from "@/lib/export-utils";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { DailyPrediction, FuturesContract } from "@shared/schema";

export default function Predictions() {
  const [volatilityModel, setVolatilityModel] = useState<string>("standard");
  
  const { data: predictions, isLoading } = useQuery<DailyPrediction[]>({
    queryKey: ['/api/predictions', 'ALL'],
  });

  const { data: contracts } = useQuery<FuturesContract[]>({
    queryKey: ['/api/contracts'],
  });

  const regeneratePredictionsMutation = useMutation({
    mutationFn: async (model: string) => {
      if (!contracts) return;
      
      const promises = contracts.map(contract => 
        apiRequest('POST', '/api/generate-prediction', {
          contractSymbol: contract.symbol,
          currentPrice: contract.currentPrice,
          weeklyVolatility: contract.weeklyVolatility,
          openInterestChange: contract.openInterestChange,
          model: model,
          recentPriceChange: contract.dailyChangePercent,
        })
      );
      
      return await Promise.all(promises);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/predictions'] });
    },
  });

  // Regenerate predictions when volatility model changes
  useEffect(() => {
    if (contracts && contracts.length > 0) {
      regeneratePredictionsMutation.mutate(volatilityModel);
    }
  }, [volatilityModel]);

  if (isLoading || regeneratePredictionsMutation.isPending) {
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

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case "bullish": return TrendingUp;
      case "bearish": return TrendingDown;
      default: return Minus;
    }
  };

  const getTrendColor = (trend: string) => {
    switch (trend) {
      case "bullish": return "text-primary";
      case "bearish": return "text-destructive";
      default: return "text-muted-foreground";
    }
  };

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
            Daily expected price ranges based on volatility analysis
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
          const TrendIcon = getTrendIcon(prediction.trend);
          const trendColor = getTrendColor(prediction.trend);
          const range = prediction.predictedMax - prediction.predictedMin;
          const rangePercent = (range / prediction.currentPrice) * 100;

          return (
            <Card key={prediction.id} data-testid={`card-prediction-detail-${prediction.contractSymbol}`}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <TrendIcon className={`h-6 w-6 ${trendColor}`} />
                    <div>
                      <CardTitle className="font-mono">{prediction.contractSymbol}</CardTitle>
                      <p className="text-sm text-muted-foreground">
                        {new Date(prediction.date).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="font-mono">
                      {volatilityModel === 'standard' ? '√5' : volatilityModel.toUpperCase()}
                    </Badge>
                    <Badge variant={prediction.trend === "bullish" ? "default" : prediction.trend === "bearish" ? "destructive" : "secondary"} className="capitalize">
                      {prediction.trend}
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
                      ${prediction.predictedMin.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-xs text-muted-foreground">Max Expected</span>
                    <span className="text-lg font-mono font-semibold text-primary">
                      ${prediction.predictedMax.toFixed(2)}
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

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-2 border-t border-card-border">
                  <div className="flex flex-col gap-1">
                    <span className="text-xs text-muted-foreground">Daily Volatility</span>
                    <span className="text-sm font-mono font-medium">
                      {(prediction.dailyVolatility * 100).toFixed(2)}%
                    </span>
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-xs text-muted-foreground">Weekly Volatility</span>
                    <span className="text-sm font-mono font-medium">
                      {(prediction.weeklyVolatility * 100).toFixed(2)}%
                    </span>
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-xs text-muted-foreground">Confidence</span>
                    <span className="text-sm font-mono font-medium">
                      {(prediction.confidence * 100).toFixed(0)}%
                    </span>
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-xs text-muted-foreground">OI Change</span>
                    <span className={`text-sm font-mono font-medium ${prediction.openInterestChange >= 0 ? 'text-primary' : 'text-destructive'}`}>
                      {prediction.openInterestChange >= 0 ? '+' : ''}{(prediction.openInterestChange * 100).toFixed(1)}%
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
