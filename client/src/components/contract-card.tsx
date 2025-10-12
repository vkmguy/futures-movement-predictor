import { TrendingDown, TrendingUp, Calendar, AlertTriangle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { FuturesContract } from "@shared/schema";

interface ContractCardProps {
  contract: FuturesContract;
}

export function ContractCard({ contract }: ContractCardProps) {
  const isPositive = contract.dailyChange >= 0;
  const changeColor = isPositive ? "text-primary" : "text-destructive";
  const TrendIcon = isPositive ? TrendingUp : TrendingDown;
  const isExpirationWeek = contract.isExpirationWeek === 1;
  const daysRemaining = contract.daysRemaining ?? 0;

  return (
    <Card 
      data-testid={`card-contract-${contract.symbol}`} 
      className={`hover-elevate ${isExpirationWeek ? 'border-destructive' : ''}`}
    >
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-3">
        <div className="flex flex-col gap-1">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            {contract.name}
          </CardTitle>
          <div className="flex items-center gap-2">
            <span className="text-lg font-mono font-semibold">{contract.symbol}</span>
            {contract.contractType && (
              <Badge variant="outline" className="text-xs">
                {contract.contractType === 'equity_index' ? 'Index' : 'Commodity'}
              </Badge>
            )}
          </div>
        </div>
        <Badge variant={isPositive ? "default" : "destructive"} className="gap-1">
          <TrendIcon className="h-3 w-3" />
          {isPositive ? "+" : ""}{contract.dailyChangePercent.toFixed(2)}%
        </Badge>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-baseline gap-2">
          <span className="text-3xl font-mono font-bold" data-testid={`text-price-${contract.symbol}`}>
            ${contract.currentPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
          <span className={`text-sm font-mono font-medium ${changeColor}`} data-testid={`text-change-${contract.symbol}`}>
            {isPositive ? "+" : ""}{contract.dailyChange.toFixed(2)}
          </span>
        </div>
        
        <div className="grid grid-cols-2 gap-3 pt-2 border-t border-card-border">
          <div className="flex flex-col">
            <span className="text-xs text-muted-foreground">Volume</span>
            <span className="text-sm font-mono font-medium" data-testid={`text-volume-${contract.symbol}`}>
              {contract.volume.toLocaleString()}
            </span>
          </div>
          <div className="flex flex-col">
            <span className="text-xs text-muted-foreground">Open Interest</span>
            <span className="text-sm font-mono font-medium" data-testid={`text-oi-${contract.symbol}`}>
              {contract.openInterest.toLocaleString()}
            </span>
          </div>
        </div>

        {/* Expiration Information */}
        {daysRemaining > 0 && (
          <div className="flex items-center justify-between pt-2 border-t border-card-border">
            <div className="flex items-center gap-1.5">
              {isExpirationWeek ? (
                <AlertTriangle className="h-3.5 w-3.5 text-destructive" />
              ) : (
                <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
              )}
              <span className="text-xs text-muted-foreground">Days to Expiration</span>
            </div>
            <Badge 
              variant={isExpirationWeek ? "destructive" : "secondary"}
              className="text-xs"
              data-testid={`badge-expiration-${contract.symbol}`}
            >
              {daysRemaining} {daysRemaining === 1 ? 'day' : 'days'}
            </Badge>
          </div>
        )}
        
        <div className="flex items-center justify-between pt-2 border-t border-card-border">
          <span className="text-xs text-muted-foreground">Updated</span>
          <span className="text-xs font-medium">
            {new Date(contract.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
