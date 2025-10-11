import { useQuery, useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Download, RefreshCw, TrendingUp, TrendingDown, CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { HistoricalDailyExpectedMoves, FuturesContract } from "@shared/schema";

export default function HistoricalDashboard() {
  const [selectedContract, setSelectedContract] = useState<string>("ALL");

  // Fetch contracts for filter
  const { data: contracts = [] } = useQuery<FuturesContract[]>({
    queryKey: ["/api/contracts"],
  });

  // Fetch historical daily moves
  const { data: historicalMoves = [], isLoading } = useQuery<HistoricalDailyExpectedMoves[]>({
    queryKey: selectedContract === "ALL" 
      ? ["/api/historical-daily-moves"]
      : ["/api/historical-daily-moves", selectedContract],
  });

  // Collect daily data mutation
  const collectDataMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest<{ message: string; data: HistoricalDailyExpectedMoves[] }>(
        "/api/collect-daily-data",
        { method: "POST", body: {} }
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/historical-daily-moves"] });
    },
  });

  const handleCollectData = () => {
    collectDataMutation.mutate();
  };

  const handleExport = () => {
    const dataToExport = selectedContract === "ALL" 
      ? historicalMoves 
      : historicalMoves;
    
    const csv = [
      ["Date", "Contract", "Last Price", "Previous Close", "Expected High", "Expected Low", "Actual Close", "Within Range", "Daily Vol %", "Weekly Vol %"].join(","),
      ...dataToExport.map(move => [
        new Date(move.date).toLocaleDateString(),
        move.contractSymbol,
        move.lastTradedPrice.toFixed(2),
        move.previousClose.toFixed(2),
        move.expectedHigh.toFixed(2),
        move.expectedLow.toFixed(2),
        move.actualClose?.toFixed(2) || "N/A",
        move.withinRange === 1 ? "Yes" : move.withinRange === 0 ? "No" : "N/A",
        (move.dailyVolatility * 100).toFixed(2) + "%",
        (move.weeklyVolatility * 100).toFixed(2) + "%",
      ].join(","))
    ].join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `historical-daily-moves-${selectedContract}-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  const getStatusBadge = (move: HistoricalDailyExpectedMoves) => {
    if (move.withinRange === null || move.actualClose === null) {
      return (
        <Badge variant="secondary" className="gap-1">
          <Loader2 className="h-3 w-3 animate-spin" />
          Pending
        </Badge>
      );
    }
    
    if (move.withinRange === 1) {
      return (
        <Badge variant="default" className="gap-1 bg-green-600 hover:bg-green-700">
          <CheckCircle2 className="h-3 w-3" />
          Within Range
        </Badge>
      );
    }
    
    return (
      <Badge variant="destructive" className="gap-1">
        <XCircle className="h-3 w-3" />
        Outside Range
      </Badge>
    );
  };

  const calculateAccuracy = () => {
    const withResults = historicalMoves.filter(m => m.withinRange !== null);
    const withinRange = withResults.filter(m => m.withinRange === 1).length;
    
    if (withResults.length === 0) return 0;
    return ((withinRange / withResults.length) * 100).toFixed(1);
  };

  return (
    <div className="h-full overflow-auto p-6 space-y-6" data-testid="page-historical-dashboard">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight" data-testid="text-title">
            Historical Dashboard
          </h1>
          <p className="text-muted-foreground mt-1" data-testid="text-subtitle">
            Daily expected moves accumulate here and are never deleted
          </p>
        </div>
        
        <div className="flex gap-2">
          <Button
            onClick={handleCollectData}
            disabled={collectDataMutation.isPending}
            data-testid="button-collect-data"
            className="gap-2"
          >
            {collectDataMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            Collect Daily Data
          </Button>
          
          <Button
            onClick={handleExport}
            variant="outline"
            data-testid="button-export"
            className="gap-2"
          >
            <Download className="h-4 w-4" />
            Export CSV
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card data-testid="card-total-records">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Records</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-total-records">
              {historicalMoves.length}
            </div>
          </CardContent>
        </Card>

        <Card data-testid="card-accuracy">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Accuracy Rate</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-accuracy">
              {calculateAccuracy()}%
            </div>
          </CardContent>
        </Card>

        <Card data-testid="card-pending">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-pending">
              {historicalMoves.filter(m => m.actualClose === null).length}
            </div>
          </CardContent>
        </Card>

        <Card data-testid="card-completed">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completed</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-completed">
              {historicalMoves.filter(m => m.actualClose !== null).length}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filter */}
      <Card>
        <CardHeader>
          <CardTitle>Filter by Contract</CardTitle>
        </CardHeader>
        <CardContent>
          <Select value={selectedContract} onValueChange={setSelectedContract}>
            <SelectTrigger className="w-64" data-testid="select-contract">
              <SelectValue placeholder="Select contract" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Contracts</SelectItem>
              {contracts.map((contract) => (
                <SelectItem key={contract.symbol} value={contract.symbol}>
                  {contract.symbol} - {contract.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {/* Historical Data Table */}
      <Card>
        <CardHeader>
          <CardTitle>Historical Daily Expected Moves</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : historicalMoves.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground" data-testid="text-no-data">
              No historical data yet. Click "Collect Daily Data" to start accumulating data.
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Contract</TableHead>
                    <TableHead className="text-right">Last Price</TableHead>
                    <TableHead className="text-right">Expected High</TableHead>
                    <TableHead className="text-right">Expected Low</TableHead>
                    <TableHead className="text-right">Actual Close</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Daily Vol %</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {historicalMoves.map((move) => (
                    <TableRow key={move.id} data-testid={`row-move-${move.id}`}>
                      <TableCell data-testid={`cell-date-${move.id}`}>
                        {new Date(move.date).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{move.contractSymbol}</Badge>
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {move.lastTradedPrice.toFixed(2)}
                      </TableCell>
                      <TableCell className="text-right font-mono text-green-600 dark:text-green-400">
                        {move.expectedHigh.toFixed(2)}
                      </TableCell>
                      <TableCell className="text-right font-mono text-red-600 dark:text-red-400">
                        {move.expectedLow.toFixed(2)}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {move.actualClose ? move.actualClose.toFixed(2) : "-"}
                      </TableCell>
                      <TableCell>
                        {getStatusBadge(move)}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {(move.dailyVolatility * 100).toFixed(2)}%
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
