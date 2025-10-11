import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import type { HistoricalPrice } from "@shared/schema";

interface PriceChartProps {
  data: HistoricalPrice[];
  symbol: string;
}

export function PriceChart({ data, symbol }: PriceChartProps) {
  const chartData = data.map(price => ({
    date: new Date(price.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
    price: price.close,
    high: price.high,
    low: price.low,
  })).reverse();

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
