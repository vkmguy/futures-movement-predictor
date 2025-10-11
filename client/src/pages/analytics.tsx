import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { Skeleton } from "@/components/ui/skeleton";
import { TrendingUp, Activity, DollarSign } from "lucide-react";
import { ExportMenu } from "@/components/export-menu";
import { exportToCSV, exportToJSON, prepareContractsForExport } from "@/lib/export-utils";
import type { FuturesContract } from "@shared/schema";

export default function Analytics() {
  const { data: contracts, isLoading } = useQuery<FuturesContract[]>({
    queryKey: ['/api/contracts'],
  });

  if (isLoading) {
    return (
      <div className="space-y-6 p-6">
        <Skeleton className="h-[400px]" />
      </div>
    );
  }

  const volatilityData = contracts?.map(c => ({
    name: c.symbol,
    weeklyVol: parseFloat((c.weeklyVolatility * 100).toFixed(2)),
    dailyVol: parseFloat((c.dailyVolatility * 100).toFixed(2)),
  })) || [];

  const performanceData = contracts?.map(c => ({
    name: c.symbol,
    change: parseFloat(c.dailyChangePercent.toFixed(2)),
  })) || [];

  const stats = [
    {
      title: "Average Volatility",
      value: `${((contracts?.reduce((acc, c) => acc + c.dailyVolatility, 0) || 0) / (contracts?.length || 1) * 100).toFixed(2)}%`,
      icon: Activity,
      description: "Daily average across all contracts",
    },
    {
      title: "Total Volume",
      value: (contracts?.reduce((acc, c) => acc + c.volume, 0) || 0).toLocaleString(),
      icon: TrendingUp,
      description: "Combined trading volume",
    },
    {
      title: "Market Value",
      value: `$${((contracts?.reduce((acc, c) => acc + c.currentPrice, 0) || 0) / 1000).toFixed(1)}K`,
      icon: DollarSign,
      description: "Total market value",
    },
  ];

  const handleExportCSV = () => {
    if (contracts && contracts.length > 0) {
      const data = prepareContractsForExport(contracts);
      exportToCSV(data, `analytics-${new Date().toISOString().split('T')[0]}.csv`);
    }
  };

  const handleExportJSON = () => {
    if (contracts && contracts.length > 0) {
      const data = prepareContractsForExport(contracts);
      exportToJSON(data, `analytics-${new Date().toISOString().split('T')[0]}.json`);
    }
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold" data-testid="text-page-title">Analytics</h1>
          <p className="text-muted-foreground mt-1">
            Market statistics and volatility analysis
          </p>
        </div>
        <ExportMenu 
          onExportCSV={handleExportCSV} 
          onExportJSON={handleExportJSON}
          disabled={!contracts || contracts.length === 0}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <Card key={stat.title} data-testid={`card-stat-${stat.title.toLowerCase().replace(/\s+/g, '-')}`}>
              <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
                <Icon className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold font-mono">{stat.value}</div>
                <p className="text-xs text-muted-foreground mt-1">{stat.description}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card data-testid="card-volatility-chart">
        <CardHeader>
          <CardTitle>Volatility Comparison</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={volatilityData} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" opacity={0.3} />
                <XAxis 
                  dataKey="name" 
                  tick={{ fontSize: 12 }}
                  className="text-muted-foreground"
                  stroke="hsl(var(--muted-foreground))"
                />
                <YAxis 
                  tick={{ fontSize: 12 }}
                  className="text-muted-foreground"
                  stroke="hsl(var(--muted-foreground))"
                  label={{ value: 'Volatility %', angle: -90, position: 'insideLeft' }}
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
                <Bar dataKey="weeklyVol" fill="hsl(var(--chart-2))" name="Weekly Volatility %" radius={[4, 4, 0, 0]} />
                <Bar dataKey="dailyVol" fill="hsl(var(--chart-1))" name="Daily Volatility %" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <Card data-testid="card-performance-chart">
        <CardHeader>
          <CardTitle>Daily Performance</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={performanceData} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" opacity={0.3} />
                <XAxis 
                  dataKey="name" 
                  tick={{ fontSize: 12 }}
                  className="text-muted-foreground"
                  stroke="hsl(var(--muted-foreground))"
                />
                <YAxis 
                  tick={{ fontSize: 12 }}
                  className="text-muted-foreground"
                  stroke="hsl(var(--muted-foreground))"
                  label={{ value: 'Change %', angle: -90, position: 'insideLeft' }}
                />
                <Tooltip 
                  contentStyle={{
                    backgroundColor: 'hsl(var(--popover))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '6px',
                    color: 'hsl(var(--popover-foreground))',
                  }}
                />
                <Bar 
                  dataKey="change" 
                  fill="hsl(var(--primary))" 
                  name="Daily Change %"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
