import { useEffect, useRef, useCallback, useState } from 'react';
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
  const [isConnected, setIsConnected] = useState(false);
  const [isEnabled, setIsEnabled] = useState(() => {
    // Load saved preference from localStorage (browser-only)
    if (typeof window !== 'undefined' && window.localStorage) {
      const saved = localStorage.getItem('marketDataEnabled');
      return saved !== null ? saved === 'true' : true; // Default to enabled
    }
    return true; // Default to enabled in non-browser environments
  });
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout>();

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setIsConnected(false);
  }, []);

  const connect = useCallback(() => {
    if (!isEnabled || wsRef.current?.readyState === WebSocket.OPEN) return;

    // WebSocket URL - use wss:// for HTTPS, ws:// for HTTP
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws/market`;

    try {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('Market data WebSocket connected');
        setIsConnected(true);
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
        setIsConnected(false);
        // Only attempt to reconnect if still enabled
        if (isEnabled) {
          reconnectTimeoutRef.current = setTimeout(() => {
            console.log('Attempting to reconnect...');
            connect();
          }, 5000);
        }
      };
    } catch (error) {
      console.error('Failed to create WebSocket connection:', error);
      setIsConnected(false);
    }
  }, [isEnabled]);

  const toggleConnection = useCallback(() => {
    const newState = !isEnabled;
    setIsEnabled(newState);
    
    // Save preference to localStorage (browser-only)
    if (typeof window !== 'undefined' && window.localStorage) {
      localStorage.setItem('marketDataEnabled', String(newState));
    }
    
    if (newState) {
      connect();
    } else {
      disconnect();
    }
  }, [isEnabled, connect, disconnect]);

  useEffect(() => {
    if (isEnabled) {
      connect();
    }

    return () => {
      disconnect();
    };
  }, [isEnabled, connect, disconnect]);

  return { isConnected, isEnabled, toggleConnection };
}
