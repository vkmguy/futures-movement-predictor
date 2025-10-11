import { 
  type FuturesContract, 
  type InsertFuturesContract,
  type HistoricalPrice,
  type InsertHistoricalPrice,
  type DailyPrediction,
  type InsertDailyPrediction,
  type PriceAlert,
  type InsertPriceAlert
} from "@shared/schema";
import { randomUUID } from "crypto";

export interface IStorage {
  // Futures Contracts
  getAllContracts(): Promise<FuturesContract[]>;
  getContractBySymbol(symbol: string): Promise<FuturesContract | undefined>;
  createContract(contract: InsertFuturesContract): Promise<FuturesContract>;
  updateContract(symbol: string, contract: Partial<InsertFuturesContract>): Promise<FuturesContract | undefined>;
  
  // Historical Prices
  getHistoricalPrices(symbol: string, limit?: number): Promise<HistoricalPrice[]>;
  createHistoricalPrice(price: InsertHistoricalPrice): Promise<HistoricalPrice>;
  
  // Daily Predictions
  getAllPredictions(): Promise<DailyPrediction[]>;
  getPredictionsBySymbol(symbol: string): Promise<DailyPrediction[]>;
  createPrediction(prediction: InsertDailyPrediction): Promise<DailyPrediction>;

  // Price Alerts
  getAllAlerts(): Promise<PriceAlert[]>;
  getActiveAlerts(): Promise<PriceAlert[]>;
  createAlert(alert: InsertPriceAlert): Promise<PriceAlert>;
  updateAlert(id: string, update: Partial<PriceAlert>): Promise<PriceAlert | undefined>;
  deleteAlert(id: string): Promise<boolean>;
}

export class MemStorage implements IStorage {
  private contracts: Map<string, FuturesContract>;
  private historicalPrices: Map<string, HistoricalPrice[]>;
  private predictions: Map<string, DailyPrediction>;
  private alerts: Map<string, PriceAlert>;

  constructor() {
    this.contracts = new Map();
    this.historicalPrices = new Map();
    this.predictions = new Map();
    this.alerts = new Map();
    this.initializeMockData();
  }

  private initializeMockData() {
    // Initialize with mock futures contracts
    const mockContracts: InsertFuturesContract[] = [
      {
        symbol: "/NQ",
        name: "Nasdaq 100",
        currentPrice: 16245.50,
        previousClose: 16180.25,
        dailyChange: 65.25,
        dailyChangePercent: 0.403,
        volume: 245678,
        openInterest: 187432,
        weeklyVolatility: 0.0348,
        dailyVolatility: 0.0156,
      },
      {
        symbol: "/ES",
        name: "S&P 500",
        currentPrice: 4587.25,
        previousClose: 4565.75,
        dailyChange: 21.50,
        dailyChangePercent: 0.471,
        volume: 1845321,
        openInterest: 2456789,
        weeklyVolatility: 0.0292,
        dailyVolatility: 0.0131,
      },
      {
        symbol: "/YM",
        name: "Dow Jones",
        currentPrice: 36842.75,
        previousClose: 36715.50,
        dailyChange: 127.25,
        dailyChangePercent: 0.347,
        volume: 89456,
        openInterest: 134567,
        weeklyVolatility: 0.0265,
        dailyVolatility: 0.0118,
      },
    ];

    mockContracts.forEach(contract => {
      const id = randomUUID();
      this.contracts.set(contract.symbol, {
        ...contract,
        id,
        updatedAt: new Date(),
      });

      // Generate historical prices for each contract
      const historicalData: HistoricalPrice[] = [];
      let basePrice = contract.currentPrice;
      
      for (let i = 20; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        
        const volatility = contract.dailyVolatility;
        const change = (Math.random() - 0.5) * 2 * basePrice * volatility;
        const open = basePrice;
        const close = basePrice + change;
        const high = Math.max(open, close) + Math.abs(change) * 0.3;
        const low = Math.min(open, close) - Math.abs(change) * 0.3;
        
        historicalData.push({
          id: randomUUID(),
          contractSymbol: contract.symbol,
          date,
          open,
          high,
          low,
          close,
          volume: Math.floor(contract.volume * (0.8 + Math.random() * 0.4)),
        });
        
        basePrice = close;
      }
      
      this.historicalPrices.set(contract.symbol, historicalData);

      // Generate predictions
      const dailyMove = contract.currentPrice * contract.dailyVolatility;
      const oiChange = (Math.random() - 0.5) * 0.1;
      const trend = oiChange > 0.02 ? "bullish" : oiChange < -0.02 ? "bearish" : "neutral";
      
      const prediction: DailyPrediction = {
        id: randomUUID(),
        contractSymbol: contract.symbol,
        date: new Date(),
        currentPrice: contract.currentPrice,
        predictedMin: contract.currentPrice - dailyMove,
        predictedMax: contract.currentPrice + dailyMove,
        dailyVolatility: contract.dailyVolatility,
        weeklyVolatility: contract.weeklyVolatility,
        confidence: 0.70 + Math.random() * 0.25,
        openInterestChange: oiChange,
        trend,
      };
      
      this.predictions.set(contract.symbol, prediction);
    });
  }

  async getAllContracts(): Promise<FuturesContract[]> {
    return Array.from(this.contracts.values());
  }

  async getContractBySymbol(symbol: string): Promise<FuturesContract | undefined> {
    return this.contracts.get(symbol);
  }

  async createContract(insertContract: InsertFuturesContract): Promise<FuturesContract> {
    const id = randomUUID();
    const contract: FuturesContract = {
      ...insertContract,
      id,
      updatedAt: new Date(),
    };
    this.contracts.set(contract.symbol, contract);
    return contract;
  }

  async updateContract(symbol: string, update: Partial<InsertFuturesContract>): Promise<FuturesContract | undefined> {
    const existing = this.contracts.get(symbol);
    if (!existing) return undefined;

    const updated: FuturesContract = {
      ...existing,
      ...update,
      updatedAt: new Date(),
    };
    this.contracts.set(symbol, updated);
    return updated;
  }

  async getHistoricalPrices(symbol: string, limit: number = 20): Promise<HistoricalPrice[]> {
    const prices = this.historicalPrices.get(symbol) || [];
    return prices.slice(-limit);
  }

  async createHistoricalPrice(insertPrice: InsertHistoricalPrice): Promise<HistoricalPrice> {
    const id = randomUUID();
    const price: HistoricalPrice = { ...insertPrice, id };
    
    const existing = this.historicalPrices.get(insertPrice.contractSymbol) || [];
    existing.push(price);
    this.historicalPrices.set(insertPrice.contractSymbol, existing);
    
    return price;
  }

  async getAllPredictions(): Promise<DailyPrediction[]> {
    return Array.from(this.predictions.values());
  }

  async getPredictionsBySymbol(symbol: string): Promise<DailyPrediction[]> {
    const prediction = this.predictions.get(symbol);
    return prediction ? [prediction] : [];
  }

  async createPrediction(insertPrediction: InsertDailyPrediction): Promise<DailyPrediction> {
    const id = randomUUID();
    const prediction: DailyPrediction = {
      ...insertPrediction,
      id,
      date: new Date(),
    };
    this.predictions.set(prediction.contractSymbol, prediction);
    return prediction;
  }

  async getAllAlerts(): Promise<PriceAlert[]> {
    return Array.from(this.alerts.values());
  }

  async getActiveAlerts(): Promise<PriceAlert[]> {
    return Array.from(this.alerts.values()).filter(alert => alert.isActive === 1 && alert.triggered === 0);
  }

  async createAlert(insertAlert: InsertPriceAlert): Promise<PriceAlert> {
    const id = randomUUID();
    const alert: PriceAlert = {
      ...insertAlert,
      id,
      isActive: 1,
      triggered: 0,
      createdAt: new Date(),
    };
    this.alerts.set(id, alert);
    return alert;
  }

  async updateAlert(id: string, update: Partial<PriceAlert>): Promise<PriceAlert | undefined> {
    const existing = this.alerts.get(id);
    if (!existing) return undefined;

    const updated: PriceAlert = {
      ...existing,
      ...update,
    };
    this.alerts.set(id, updated);
    return updated;
  }

  async deleteAlert(id: string): Promise<boolean> {
    return this.alerts.delete(id);
  }
}

export const storage = new MemStorage();
