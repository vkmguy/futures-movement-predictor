import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { CheckCircle2, XCircle, TrendingUp, Target } from "lucide-react";
import { ContractSelector } from "@/components/contract-selector";
import type { HistoricalPrice, DailyPrediction } from "@shared/schema";

interface BacktestResult {
  date: string;
  predictedMin: number;
  predictedMax: number;
  actualPrice: number;
  withinRange: boolean;
  accuracy: number;
}

export default function Backtesting() {
  const [selectedContract, setSelectedContract] = useState<string>("/NQ");
  const [backtestResults, setBacktestResults] = useState<BacktestResult[]>([]);
  const [metrics, setMetrics] = useState<{
    totalPredictions: number;
    accurateCount: number;
    accuracyRate: number;
    avgError: number;
  } | null>(null);

  const { data: historical } = useQuery<HistoricalPrice[]>({
    queryKey: ['/api/historical', selectedContract],
  });

  const { data: predictions } = useQuery<DailyPrediction[]>({
    queryKey: ['/api/predictions', selectedContract],
  });

  const runBacktest = () => {
    if (!historical || !predictions || historical.length === 0) return;

    const results: BacktestResult[] = [];
    let totalError = 0;
    let accurateCount = 0;

    // Simulate backtesting by comparing predictions with historical data
    historical.slice(-10).forEach((price, index) => {
      const prediction = predictions[0]; // In real scenario, match by date
      if (prediction) {
        const withinRange = price.close >= prediction.predictedMin && price.close <= prediction.predictedMax;
        const error = Math.abs(price.close - prediction.currentPrice);
        const accuracy = 100 - (error / prediction.currentPrice) * 100;

        if (withinRange) accurateCount++;
        totalError += error;

        results.push({
          date: new Date(price.date).toLocaleDateString(),
          predictedMin: prediction.predictedMin,
          predictedMax: prediction.predictedMax,
          actualPrice: price.close,
          withinRange,
          accuracy: Math.max(0, accuracy),
        });
      }
    });

    setBacktestResults(results);
    setMetrics({
      totalPredictions: results.length,
      accurateCount,
      accuracyRate: (accurateCount / results.length) * 100,
      avgError: totalError / results.length,
    });
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold" data-testid="text-page-title">Backtesting</h1>
          <p className="text-muted-foreground mt-1">
            Validate prediction accuracy against historical data
          </p>
        </div>
        <div className="flex items-center gap-3">
          <ContractSelector value={selectedContract} onValueChange={setSelectedContract} />
          <Button onClick={runBacktest} disabled={!historical || historical.length === 0} data-testid="button-run-backtest">
            <Target className="h-4 w-4 mr-2" />
            Run Backtest
          </Button>
        </div>
      </div>

      {metrics && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card data-testid="card-metric-total">
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Predictions</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold font-mono">{metrics.totalPredictions}</div>
            </CardContent>
          </Card>

          <Card data-testid="card-metric-accurate">
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Accurate</CardTitle>
              <CheckCircle2 className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold font-mono text-primary">{metrics.accurateCount}</div>
            </CardContent>
          </Card>

          <Card data-testid="card-metric-rate">
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Accuracy Rate</CardTitle>
              <Target className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold font-mono">{metrics.accuracyRate.toFixed(1)}%</div>
            </CardContent>
          </Card>

          <Card data-testid="card-metric-error">
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Avg Error</CardTitle>
              <XCircle className="h-4 w-4 text-destructive" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold font-mono">${metrics.avgError.toFixed(2)}</div>
            </CardContent>
          </Card>
        </div>
      )}

      {backtestResults.length > 0 && (
        <>
          <Card data-testid="card-backtest-chart">
            <CardHeader>
              <CardTitle>Prediction vs Actual Performance</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={backtestResults} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" opacity={0.3} />
                    <XAxis 
                      dataKey="date" 
                      tick={{ fontSize: 12 }}
                      className="text-muted-foreground"
                      stroke="hsl(var(--muted-foreground))"
                    />
                    <YAxis 
                      tick={{ fontSize: 12 }}
                      className="text-muted-foreground"
                      stroke="hsl(var(--muted-foreground))"
                    />
                    <Tooltip 
                      contentStyle={{
                        backgroundColor: 'hsl(var(--popover))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '6px',
                        color: 'hsl(var(--popover-foreground))',
                      }}
                    />
                    <Legend />
                    <Line type="monotone" dataKey="predictedMin" stroke="hsl(var(--destructive))" name="Predicted Min" dot={false} />
                    <Line type="monotone" dataKey="predictedMax" stroke="hsl(var(--primary))" name="Predicted Max" dot={false} />
                    <Line type="monotone" dataKey="actualPrice" stroke="hsl(var(--chart-2))" strokeWidth={2} name="Actual Price" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <Card data-testid="card-backtest-results">
            <CardHeader>
              <CardTitle>Detailed Results</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {backtestResults.map((result, index) => (
                  <div key={index} className="flex items-center justify-between p-3 rounded-lg border border-card-border" data-testid={`result-row-${index}`}>
                    <div className="flex items-center gap-3">
                      {result.withinRange ? (
                        <CheckCircle2 className="h-5 w-5 text-primary" />
                      ) : (
                        <XCircle className="h-5 w-5 text-destructive" />
                      )}
                      <div className="flex flex-col">
                        <span className="text-sm font-medium">{result.date}</span>
                        <span className="text-xs text-muted-foreground">
                          Range: ${result.predictedMin.toFixed(2)} - ${result.predictedMax.toFixed(2)}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="flex flex-col items-end">
                        <span className="text-sm font-mono font-medium">
                          ${result.actualPrice.toFixed(2)}
                        </span>
                        <span className="text-xs text-muted-foreground">Actual Price</span>
                      </div>
                      <Badge variant={result.withinRange ? "default" : "destructive"}>
                        {result.accuracy.toFixed(1)}%
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {!backtestResults.length && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Target className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Backtest Results</h3>
            <p className="text-sm text-muted-foreground text-center max-w-md">
              Select a contract and click "Run Backtest" to validate prediction accuracy against historical data.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
