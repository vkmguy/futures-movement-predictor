import { useQuery } from "@tanstack/react-query";

interface MarketStatus {
  isOpen: boolean;
  status: 'open' | 'closed' | 'pre-market' | 'after-hours';
  nextOpen?: Date;
  nextClose?: Date;
  message: string;
}

export function useMarketStatus() {
  return useQuery<MarketStatus>({
    queryKey: ['/api/market/status'],
    refetchInterval: 60000, // Refetch every minute to keep status current
  });
}
