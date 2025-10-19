import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { ContractCard } from "@/components/contract-card";
import { VolatilityCard } from "@/components/volatility-card";
import { PredictionCard } from "@/components/prediction-card";
import { PriceChart } from "@/components/price-chart";
import { ContractSelector } from "@/components/contract-selector";
import { ExportMenu } from "@/components/export-menu";
import { IVInputDialog } from "@/components/iv-input-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { AlertCircle, RefreshCw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { exportToCSV, exportToJSON, prepareContractsForExport, preparePredictionsForExport, prepareHistoricalForExport } from "@/lib/export-utils";
import type { FuturesContract, DailyPrediction, HistoricalPrice } from "@shared/schema";

interface DailyIVRecord {
  contractSymbol: string;
  dailyIv: number;
  date: Date;
  lastUpdated: Date;
  source: string;
}

interface WeeklyIVRecord {
  contractSymbol: string;
  weeklyIv: number;
  date: Date;
  lastUpdated: Date;
  source: string;
}

export default function Dashboard() {
  const [selectedContract, setSelectedContract] = useState<string>("ALL");
  const { toast } = useToast();

  const { data: contracts, isLoading: contractsLoading } = useQuery<FuturesContract[]>({
    queryKey: ['/api/contracts'],
  });

  const { data: predictions, isLoading: predictionsLoading } = useQuery<DailyPrediction[]>({
    queryKey: [`/api/predictions/${encodeURIComponent(selectedContract)}`],
  });

  const { data: historicalData, isLoading: historicalLoading } = useQuery<HistoricalPrice[]>({
    queryKey: [`/api/historical/${encodeURIComponent(selectedContract)}`],
  });

  // Fetch daily IVs for all contracts
  const { data: dailyIVs } = useQuery<Record<string, DailyIVRecord>>({
    queryKey: ['/api/daily-iv', 'all-dashboard'],
    queryFn: async () => {
      if (!contracts) return {};
      
      const ivMap: Record<string, DailyIVRecord> = {};
      
      await Promise.all(
        contracts.map(async (contract) => {
          try {
            const encodedSymbol = encodeURIComponent(contract.symbol);
            const response = await fetch(`/api/daily-iv/${encodedSymbol}`);
            if (response.ok) {
              const data = await response.json();
              ivMap[contract.symbol] = data;
            }
          } catch (error) {
            console.log(`No daily IV found for ${contract.symbol}`);
          }
        })
      );
      
      return ivMap;
    },
    enabled: !!contracts && contracts.length > 0,
  });

  // Fetch weekly IVs for all contracts
  const { data: weeklyIVs } = useQuery<Record<string, WeeklyIVRecord>>({
    queryKey: ['/api/weekly-iv', 'all-dashboard'],
    queryFn: async () => {
      if (!contracts) return {};
      
      const ivMap: Record<string, WeeklyIVRecord> = {};
      
      await Promise.all(
        contracts.map(async (contract) => {
          try {
            const encodedSymbol = encodeURIComponent(contract.symbol);
            const response = await fetch(`/api/weekly-iv/${encodedSymbol}`);
            if (response.ok) {
              const data = await response.json();
              ivMap[contract.symbol] = data;
            }
          } catch (error) {
            console.log(`No weekly IV found for ${contract.symbol}`);
          }
        })
      );
      
      return ivMap;
    },
    enabled: !!contracts && contracts.length > 0,
  });

  const syncMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/sync-yahoo-finance', {
        method: 'POST',
      });
      if (!response.ok) {
        throw new Error('Failed to sync Yahoo Finance data');
      }
      return await response.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['/api/contracts'] });
      queryClient.invalidateQueries({ queryKey: ['/api/predictions'] });
      toast({
        title: "Data Refreshed",
        description: `Successfully synced ${data.data?.length || 0} contracts with Yahoo Finance`,
      });
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Refresh Failed",
        description: error.message || "Failed to sync Yahoo Finance data",
      });
    },
  });

  const filteredContracts = selectedContract === "ALL" 
    ? contracts 
    : contracts?.filter(c => c.symbol === selectedContract);

  // No need for client-side filtering - backend returns filtered predictions
  const filteredPredictions = predictions;
  
  // Create contract lookup map for tick size access
  const contractsBySymbol = contracts?.reduce((map, contract) => {
    map[contract.symbol] = contract;
    return map;
  }, {} as Record<string, FuturesContract>) || {};

  if (contractsLoading) {
    return (
      <div className="space-y-6 p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-[240px]" />
          ))}
        </div>
      </div>
    );
  }

  if (!contracts || contracts.length === 0) {
    return (
      <div className="p-6">
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            No futures contracts data available. Please check back later.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const handleExportCSV = () => {
    if (filteredContracts && filteredContracts.length > 0) {
      const data = prepareContractsForExport(filteredContracts);
      exportToCSV(data, `futures-contracts-${selectedContract}-${new Date().toISOString().split('T')[0]}.csv`);
    }
  };

  const handleExportJSON = () => {
    if (filteredContracts && filteredContracts.length > 0) {
      const data = prepareContractsForExport(filteredContracts);
      exportToJSON(data, `futures-contracts-${selectedContract}-${new Date().toISOString().split('T')[0]}.json`);
    }
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold" data-testid="text-page-title">Futures Dashboard</h1>
          <p className="text-muted-foreground mt-1">
            Live Yahoo Finance data with automated nightly updates
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="default"
            onClick={() => syncMutation.mutate()}
            disabled={syncMutation.isPending}
            data-testid="button-refresh-data"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${syncMutation.isPending ? 'animate-spin' : ''}`} />
            {syncMutation.isPending ? 'Syncing...' : 'Refresh Data'}
          </Button>
          <IVInputDialog contracts={contracts} />
          <ContractSelector value={selectedContract} onValueChange={setSelectedContract} />
          <ExportMenu 
            onExportCSV={handleExportCSV} 
            onExportJSON={handleExportJSON}
            disabled={!contracts || contracts.length === 0}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredContracts?.map((contract) => (
          <ContractCard key={contract.id} contract={contract} />
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {filteredContracts?.map((contract) => (
          <VolatilityCard
            key={`vol-${contract.id}`}
            symbol={contract.symbol}
            weeklyVolatility={contract.weeklyVolatility}
            dailyVolatility={contract.dailyVolatility}
            daysRemaining={contract.daysRemaining}
            dailyIV={dailyIVs?.[contract.symbol]}
            weeklyIV={weeklyIVs?.[contract.symbol]}
          />
        ))}
      </div>

      {predictionsLoading ? (
        <Skeleton className="h-[200px]" />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredPredictions?.map((prediction) => {
            const contract = contractsBySymbol[prediction.contractSymbol];
            const dailyIV = dailyIVs?.[prediction.contractSymbol];
            return contract ? (
              <PredictionCard 
                key={prediction.id} 
                prediction={prediction} 
                contract={contract}
                dailyIV={dailyIV}
              />
            ) : null;
          })}
        </div>
      )}

      {historicalLoading ? (
        <Skeleton className="h-[350px]" />
      ) : historicalData && historicalData.length > 0 ? (
        <PriceChart 
          data={historicalData} 
          symbol={selectedContract === "ALL" ? "All Contracts" : selectedContract}
        />
      ) : null}
    </div>
  );
}
