import { Activity } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

interface VolatilityCardProps {
  symbol: string;
  weeklyVolatility: number;
  dailyVolatility: number;
  daysRemaining?: number | null;
}

export function VolatilityCard({ symbol, weeklyVolatility, dailyVolatility, daysRemaining }: VolatilityCardProps) {
  const volatilityLevel = dailyVolatility < 0.01 ? "Low" : dailyVolatility < 0.02 ? "Moderate" : "High";
  const progressValue = Math.min((dailyVolatility / 0.03) * 100, 100);
  const N = daysRemaining ?? 5; // Default to 5 if not provided
  const scalingFactor = Math.sqrt(N);
  
  return (
    <Card data-testid={`card-volatility-${symbol}`}>
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-3">
        <CardTitle className="text-sm font-medium">Volatility Analysis</CardTitle>
        <Activity className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Daily σ</span>
            <span className="text-lg font-mono font-bold" data-testid={`text-daily-volatility-${symbol}`}>
              {(dailyVolatility * 100).toFixed(2)}%
            </span>
          </div>
          <Progress value={progressValue} className="h-2" />
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Level: {volatilityLevel}</span>
            <span className="text-xs text-muted-foreground font-mono">
              σ_daily = σ_weekly / √{N}
            </span>
          </div>
        </div>
        
        <div className="grid grid-cols-2 gap-3 pt-3 border-t border-card-border">
          <div className="flex flex-col">
            <span className="text-xs text-muted-foreground">Weekly σ</span>
            <span className="text-sm font-mono font-semibold" data-testid={`text-weekly-volatility-${symbol}`}>
              {(weeklyVolatility * 100).toFixed(2)}%
            </span>
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
