import { useEffect, useRef, useCallback } from 'react';
import { queryClient } from '@/lib/queryClient';

interface MarketUpdate {
  symbol: string;
  price: number;
  change: number;
  changePercent: number;
  volume: number;
  timestamp: string;
}

export function useMarketData() {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout>();

  const connect = useCallback(() => {
    // WebSocket URL - use wss:// for HTTPS, ws:// for HTTP
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws/market`;

    try {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('Market data WebSocket connected');
      };

      ws.onmessage = (event) => {
        try {
          const update: MarketUpdate = JSON.parse(event.data);
          
          // Update the contracts query cache with new data
          queryClient.setQueryData(['/api/contracts'], (oldData: any) => {
            if (!oldData) return oldData;
            
            return oldData.map((contract: any) => {
              if (contract.symbol === update.symbol) {
                return {
                  ...contract,
                  currentPrice: update.price,
                  dailyChange: update.change,
                  dailyChangePercent: update.changePercent,
                  volume: update.volume,
                  updatedAt: new Date(update.timestamp),
                };
              }
              return contract;
            });
          });

          // Also invalidate to ensure fresh data on next fetch
          queryClient.invalidateQueries({ 
            queryKey: ['/api/contracts'],
            refetchType: 'none' // Don't refetch immediately, use the updated cache
          });
        } catch (error) {
          console.error('Error parsing market update:', error);
        }
      };

      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
      };

      ws.onclose = () => {
        console.log('Market data WebSocket disconnected');
        // Attempt to reconnect after 5 seconds
        reconnectTimeoutRef.current = setTimeout(() => {
          console.log('Attempting to reconnect...');
          connect();
        }, 5000);
      };
    } catch (error) {
      console.error('Failed to create WebSocket connection:', error);
    }
  }, []);

  useEffect(() => {
    connect();

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [connect]);

  return null;
}
