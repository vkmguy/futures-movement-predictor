import { Activity, Clock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import type { DailyIvHistory, WeeklyIvOverride } from "@shared/schema";

interface VolatilityCardProps {
  symbol: string;
  weeklyVolatility: number;
  dailyVolatility: number;
  daysRemaining?: number | null;
  dailyIV?: DailyIvHistory;
  weeklyIV?: WeeklyIvOverride;
}

export function VolatilityCard({ symbol, weeklyVolatility, dailyVolatility, daysRemaining, dailyIV, weeklyIV }: VolatilityCardProps) {
  const volatilityLevel = dailyVolatility < 0.01 ? "Low" : dailyVolatility < 0.02 ? "Moderate" : "High";
  const progressValue = Math.min((dailyVolatility / 0.03) * 100, 100);
  const N = daysRemaining ?? 5; // Default to 5 if not provided
  const scalingFactor = Math.sqrt(N);
  
  const getRelativeTime = (date: Date | undefined) => {
    if (!date) return "Never";
    const diffMs = Date.now() - new Date(date).getTime();
    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    return hours < 24 ? `${hours}h ago` : `${Math.floor(hours / 24)}d ago`;
  };
  
  return (
    <Card data-testid={`card-volatility-${symbol}`}>
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-3">
        <CardTitle className="text-sm font-medium">Volatility Analysis - {symbol}</CardTitle>
        <Activity className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Daily σ</span>
              {dailyIV && (
                <Badge variant="default" className="text-xs">Manual Daily IV</Badge>
              )}
            </div>
            <span className="text-lg font-mono font-bold" data-testid={`text-daily-volatility-${symbol}`}>
              {(dailyVolatility * 100).toFixed(2)}%
            </span>
          </div>
          {dailyIV && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Clock className="h-3 w-3" />
              <span>Updated {getRelativeTime(dailyIV.lastUpdated)}</span>
            </div>
          )}
          <Progress value={progressValue} className="h-2" />
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Level: {volatilityLevel}</span>
            <span className="text-xs text-muted-foreground font-mono">
              σ_daily = σ_weekly / √{N}
            </span>
          </div>
        </div>
        
        <div className="grid grid-cols-2 gap-3 pt-3 border-t border-card-border">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-1">
              <span className="text-xs text-muted-foreground">Weekly σ</span>
              {weeklyIV && (
                <Badge variant="default" className="text-xs">Manual</Badge>
              )}
            </div>
            <span className="text-sm font-mono font-semibold" data-testid={`text-weekly-volatility-${symbol}`}>
              {(weeklyVolatility * 100).toFixed(2)}%
            </span>
            {weeklyIV && (
              <span className="text-xs text-muted-foreground">
                Updated {getRelativeTime(weeklyIV.lastUpdated)}
              </span>
            )}
          </div>
          <div className="flex flex-col">
            <span className="text-xs text-muted-foreground">Scaling Factor</span>
            <span className="text-sm font-mono font-semibold">÷ {scalingFactor.toFixed(3)}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
