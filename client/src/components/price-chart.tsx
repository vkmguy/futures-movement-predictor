import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import type { HistoricalPrice } from "@shared/schema";

interface PriceChartProps {
  data: HistoricalPrice[] | any[];
  symbol: string;
}

// Color palette for each contract
const CONTRACT_COLORS: Record<string, string> = {
  "/NQ": "#3b82f6",   // Blue - Nasdaq
  "/ES": "#10b981",   // Green - S&P 500
  "/YM": "#8b5cf6",   // Purple - Dow Jones
  "/RTY": "#f97316",  // Orange - Russell
  "/GC": "#eab308",   // Gold - Gold futures
  "/CL": "#6b7280",   // Gray - Crude Oil
};

export function PriceChart({ data, symbol }: PriceChartProps) {
  if (!data || data.length === 0) {
    return null;
  }

  // Detect if this is single contract or multi-contract data
  const firstItem = data[0];
  const isSingleContract = 'close' in firstItem;

  if (isSingleContract) {
    // Single contract view
    const chartData = (data as HistoricalPrice[]).map(price => ({
      date: new Date(price.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
      price: price.close,
      high: price.high,
      low: price.low,
    }));

    return (
      <Card data-testid={`card-chart-${symbol}`}>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Price History - {symbol}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
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
                  domain={['dataMin - 100', 'dataMax + 100']}
                />
                <Tooltip 
                  contentStyle={{
                    backgroundColor: 'hsl(var(--popover))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '6px',
                    color: 'hsl(var(--popover-foreground))',
                  }}
                  labelStyle={{ color: 'hsl(var(--muted-foreground))' }}
                />
                <Line 
                  type="monotone" 
                  dataKey="price" 
                  stroke="hsl(var(--primary))" 
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4, fill: 'hsl(var(--primary))' }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Multi-contract view - all contracts on one chart
  const chartData = data.map(item => ({
    ...item, // Spread first to preserve contract prices
    date: new Date(item.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }), // Then override date
  }));

  // Extract contract symbols by scanning all records (not just first item)
  const contractSymbolsSet = new Set<string>();
  data.forEach(item => {
    Object.keys(item).forEach(key => {
      if (key !== 'date' && key !== 'dateKey' && key.startsWith('/')) {
        contractSymbolsSet.add(key);
      }
    });
  });
  const contractSymbols = Array.from(contractSymbolsSet).sort();

  return (
    <Card data-testid={`card-chart-${symbol}`}>
      <CardHeader>
        <CardTitle className="text-sm font-medium">Price History - {symbol}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[350px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" opacity={0.3} />
              <XAxis 
                dataKey="date" 
                tick={{ fontSize: 11 }}
                className="text-muted-foreground"
                stroke="hsl(var(--muted-foreground))"
              />
              <YAxis 
                tick={{ fontSize: 11 }}
                className="text-muted-foreground"
                stroke="hsl(var(--muted-foreground))"
                domain={['auto', 'auto']}
              />
              <Tooltip 
                contentStyle={{
                  backgroundColor: 'hsl(var(--popover))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '6px',
                  color: 'hsl(var(--popover-foreground))',
                }}
                labelStyle={{ color: 'hsl(var(--muted-foreground))' }}
                formatter={(value: any) => [`$${Number(value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, '']}
              />
              <Legend 
                wrapperStyle={{ 
                  fontSize: '12px',
                  paddingTop: '10px',
                }}
                iconType="line"
              />
              {contractSymbols.map((contractSymbol) => (
                <Line
                  key={contractSymbol}
                  type="monotone"
                  dataKey={contractSymbol}
                  name={contractSymbol}
                  stroke={CONTRACT_COLORS[contractSymbol] || '#94a3b8'}
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4 }}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
