import { WebSocketServer, WebSocket } from 'ws';
import type { Server } from 'http';
import { storage } from './storage';
import { getMarketStatus } from './market-hours';

interface MarketUpdate {
  symbol: string;
  price: number;
  change: number;
  changePercent: number;
  volume: number;
  timestamp: string;
}

export function setupMarketSimulator(httpServer: Server) {
  const wss = new WebSocketServer({ 
    server: httpServer,
    path: '/ws/market'
  });

  const updateInterval = 3000; // Update every 3 seconds
  
  // Simulate market price movements
  const simulateMarketUpdate = async () => {
    // Check if markets are open before broadcasting updates
    const marketStatus = getMarketStatus();
    if (!marketStatus.isOpen) {
      // Don't broadcast updates when markets are closed
      return;
    }

    const contracts = await storage.getAllContracts();
    
    for (const contract of contracts) {
      // Generate realistic price movement (random walk with volatility)
      const volatility = contract.dailyVolatility || 0.01;
      const randomMove = (Math.random() - 0.5) * 2 * volatility;
      const newPrice = contract.currentPrice * (1 + randomMove);
      const change = newPrice - contract.currentPrice;
      const changePercent = (change / contract.currentPrice) * 100;
      
      // Update volume (simulate trading activity)
      const volumeChange = Math.floor(Math.random() * 1000) - 500;
      const newVolume = Math.max(0, contract.volume + volumeChange);
      
      // Update contract in storage
      await storage.updateContract(contract.symbol, {
        currentPrice: newPrice,
        dailyChange: change,
        dailyChangePercent: changePercent,
        volume: newVolume,
      });
      
      // Broadcast update to all connected clients
      const update: MarketUpdate = {
        symbol: contract.symbol,
        price: newPrice,
        change,
        changePercent,
        volume: newVolume,
        timestamp: new Date().toISOString(),
      };
      
      const message = JSON.stringify(update);
      wss.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(message);
        }
      });
    }
  };

  // Start simulation
  const interval = setInterval(simulateMarketUpdate, updateInterval);

  wss.on('connection', (ws) => {
    console.log('Market data WebSocket client connected');
    
    // Send initial data
    storage.getAllContracts().then(contracts => {
      contracts.forEach(contract => {
        const update: MarketUpdate = {
          symbol: contract.symbol,
          price: contract.currentPrice,
          change: contract.dailyChange,
          changePercent: contract.dailyChangePercent,
          volume: contract.volume,
          timestamp: new Date().toISOString(),
        };
        ws.send(JSON.stringify(update));
      });
    });

    ws.on('close', () => {
      console.log('Market data WebSocket client disconnected');
    });

    ws.on('error', (error) => {
      console.error('WebSocket error:', error);
    });
  });

  // Cleanup on server shutdown
  process.on('SIGTERM', () => {
    clearInterval(interval);
    wss.close();
  });

  console.log('Market simulator WebSocket started on /ws/market');
  return wss;
}
