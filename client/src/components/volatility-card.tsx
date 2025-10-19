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
  // UPDATED METHODOLOGY: Calculate daily volatility on-the-fly to ensure it's always current
  // Formula: dailyVol = annualizedIV × √(days/252)
  // Uses 252 trading days per year (industry standard)
  const N = daysRemaining ?? 5; // Days remaining until expiration
  
  // Get annualized IV sources
  const annualizedIVTactical = dailyIV?.dailyIv;
  const annualizedIVStrategic = weeklyIV?.weeklyIv || weeklyVolatility;
  
  // Use tactical (daily) IV if available, otherwise strategic (weekly)
  const annualizedIV = annualizedIVTactical || annualizedIVStrategic;
  
  // Calculate daily volatility using new formula (252 trading days)
  const displayDailyVolatility = annualizedIV * Math.sqrt(N / 252);
  
  const volatilityLevel = displayDailyVolatility < 0.01 ? "Low" : displayDailyVolatility < 0.02 ? "Moderate" : "High";
  const progressValue = Math.min((displayDailyVolatility / 0.03) * 100, 100);
  
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
            <span className="text-sm text-muted-foreground font-medium">Daily Volatility ({N}d)</span>
            <span className="text-lg font-mono font-bold text-primary" data-testid={`text-daily-volatility-${symbol}`}>
              {(displayDailyVolatility * 100).toFixed(2)}%
            </span>
          </div>
          <Progress value={progressValue} className="h-2" />
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Level: {volatilityLevel}</span>
            <span className="text-xs text-muted-foreground font-mono">
              IV × √({N}/252)
            </span>
          </div>
        </div>
        
        <div className="grid grid-cols-2 gap-3 pt-3 border-t border-card-border">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-1">
              <span className="text-xs text-muted-foreground font-medium">Annualized IV</span>
              {dailyIV && (
                <Badge variant="default" className="text-xs">Manual</Badge>
              )}
            </div>
            <span className="text-sm font-mono font-semibold" data-testid={`text-annualized-iv-${symbol}`}>
              {annualizedIVTactical ? (annualizedIVTactical * 100).toFixed(2) : (annualizedIVStrategic * 100).toFixed(2)}%
            </span>
            {dailyIV && (
              <span className="text-xs text-muted-foreground">
                Updated {getRelativeTime(dailyIV.lastUpdated)}
              </span>
            )}
            {!dailyIV && weeklyIV && (
              <span className="text-xs text-muted-foreground">
                Updated {getRelativeTime(weeklyIV.lastUpdated)}
              </span>
            )}
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-xs text-muted-foreground font-medium">IV Source</span>
            <span className="text-sm font-mono font-medium">
              {dailyIV ? "Tactical" : "Strategic"}
            </span>
            <span className="text-xs text-muted-foreground">
              {dailyIV ? "Daily updates" : "Weekly lock"}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
