import { TrendingUp, AlertCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { DailyPrediction, FuturesContract } from "@shared/schema";
import { roundToTick } from "@shared/utils";

interface DailyIVRecord {
  contractSymbol: string;
  dailyIv: number;
  date: Date;
  lastUpdated: Date;
  source: string;
}

interface PredictionCardProps {
  prediction: DailyPrediction;
  contract: FuturesContract;
  dailyIV?: DailyIVRecord;
}

export function PredictionCard({ prediction, contract, dailyIV }: PredictionCardProps) {
  // Round predicted prices to valid tick increments
  const predictedMin = roundToTick(prediction.predictedMin, contract.tickSize);
  const predictedMax = roundToTick(prediction.predictedMax, contract.tickSize);
  
  const range = predictedMax - predictedMin;
  const rangePercent = (range / prediction.currentPrice) * 100;
  

  return (
    <Card data-testid={`card-prediction-${prediction.contractSymbol}`}>
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-3">
        <CardTitle className="text-sm font-medium">Daily Movement Prediction - {prediction.contractSymbol}</CardTitle>
        <TrendingUp className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Expected Range</span>
          </div>
          
          <div className="relative h-12 rounded-md bg-muted">
            <div 
              className="absolute h-full rounded-md bg-gradient-to-r from-destructive/20 via-muted-foreground/20 to-primary/20"
              style={{ width: '100%' }}
            />
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono font-medium" data-testid={`text-min-${prediction.contractSymbol}`}>
                  ${predictedMin.toFixed(2)}
                </span>
                <span className="text-xs text-muted-foreground">→</span>
                <span className="text-xs font-mono font-medium" data-testid={`text-max-${prediction.contractSymbol}`}>
                  ${predictedMax.toFixed(2)}
                </span>
              </div>
            </div>
          </div>
          
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Range: ${range.toFixed(2)}</span>
            <span className="text-xs font-mono font-medium" data-testid={`text-range-percent-${prediction.contractSymbol}`}>
              ±{rangePercent.toFixed(2)}%
            </span>
          </div>
        </div>

        <div className="pt-3 border-t border-card-border">
          <div className="flex flex-col">
            <span className="text-xs text-muted-foreground">Confidence</span>
            <span className="text-sm font-mono font-semibold" data-testid={`text-confidence-${prediction.contractSymbol}`}>
              {(prediction.confidence * 100).toFixed(0)}%
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 pt-2 border-t border-card-border">
          <AlertCircle className="h-3 w-3 text-muted-foreground" />
          <span className="text-xs text-muted-foreground">
            Based on {(prediction.dailyVolatility * 100).toFixed(2)}% daily volatility
          </span>
          {dailyIV && (
            <Badge variant="default" className="text-xs ml-auto">
              Daily IV
            </Badge>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
