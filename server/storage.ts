import { 
  type FuturesContract, 
  type InsertFuturesContract,
  type HistoricalPrice,
  type InsertHistoricalPrice,
  type DailyPrediction,
  type InsertDailyPrediction,
  type PriceAlert,
  type InsertPriceAlert,
  type WeeklyExpectedMoves,
  type InsertWeeklyExpectedMoves
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

  // Weekly Expected Moves
  getWeeklyMoves(contractSymbol: string): Promise<WeeklyExpectedMoves | undefined>;
  getAllWeeklyMoves(): Promise<WeeklyExpectedMoves[]>;
  createWeeklyMoves(moves: InsertWeeklyExpectedMoves): Promise<WeeklyExpectedMoves>;
  updateWeeklyMoves(contractSymbol: string, update: Partial<WeeklyExpectedMoves>): Promise<WeeklyExpectedMoves | undefined>;
}

export class MemStorage implements IStorage {
  private contracts: Map<string, FuturesContract>;
  private historicalPrices: Map<string, HistoricalPrice[]>;
  private predictions: Map<string, DailyPrediction>;
  private alerts: Map<string, PriceAlert>;
  private weeklyMoves: Map<string, WeeklyExpectedMoves>;

  constructor() {
    this.contracts = new Map();
    this.historicalPrices = new Map();
    this.predictions = new Map();
    this.alerts = new Map();
    this.weeklyMoves = new Map();
    this.initializeMockData();
  }

  private initializeMockData() {
    // Initialize with mock E-mini futures contracts (realistic 2025 price levels)
    const mockContracts: InsertFuturesContract[] = [
      {
        symbol: "/NQ",
        name: "E-mini Nasdaq-100",
        currentPrice: 24726.75,
        previousClose: 24650.50,
        dailyChange: 76.25,
        dailyChangePercent: 0.309,
        volume: 345678,
        openInterest: 287432,
        weeklyVolatility: 0.0285,
        dailyVolatility: 0.0127,
      },
      {
        symbol: "/ES",
        name: "E-mini S&P 500",
        currentPrice: 6595.25,
        previousClose: 6774.00,
        dailyChange: -178.75,
        dailyChangePercent: -2.64,
        volume: 2145321,
        openInterest: 3256789,
        weeklyVolatility: 0.0245,
        dailyVolatility: 0.0110,
      },
      {
        symbol: "/YM",
        name: "E-mini Dow Jones",
        currentPrice: 45706.00,
        previousClose: 46593.00,
        dailyChange: -887.00,
        dailyChangePercent: -1.90,
        volume: 149700,
        openInterest: 184567,
        weeklyVolatility: 0.0235,
        dailyVolatility: 0.0105,
      },
      {
        symbol: "/RTY",
        name: "E-mini Russell 2000",
        currentPrice: 2234.20,
        previousClose: 2221.80,
        dailyChange: 12.40,
        dailyChangePercent: 0.56,
        volume: 15950,
        openInterest: 245678,
        weeklyVolatility: 0.0325,
        dailyVolatility: 0.0145,
      },
      {
        symbol: "/GC",
        name: "Gold Futures",
        currentPrice: 4000.40,
        previousClose: 3972.60,
        dailyChange: 27.80,
        dailyChangePercent: 0.70,
        volume: 352500,
        openInterest: 456789,
        weeklyVolatility: 0.0195,
        dailyVolatility: 0.0087,
      },
      {
        symbol: "/CL",
        name: "Crude Oil Futures",
        currentPrice: 58.90,
        previousClose: 61.51,
        dailyChange: -2.61,
        dailyChangePercent: -4.24,
        volume: 236000,
        openInterest: 789012,
        weeklyVolatility: 0.0415,
        dailyVolatility: 0.0186,
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
      targetPrice: insertAlert.targetPrice ?? null,
      percentage: insertAlert.percentage ?? null,
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

  async getWeeklyMoves(contractSymbol: string): Promise<WeeklyExpectedMoves | undefined> {
    return this.weeklyMoves.get(contractSymbol);
  }

  async getAllWeeklyMoves(): Promise<WeeklyExpectedMoves[]> {
    return Array.from(this.weeklyMoves.values());
  }

  async createWeeklyMoves(insertMoves: InsertWeeklyExpectedMoves): Promise<WeeklyExpectedMoves> {
    const id = randomUUID();
    const moves: WeeklyExpectedMoves = {
      ...insertMoves,
      id,
      mondayActualClose: insertMoves.mondayActualClose ?? null,
      tuesdayActualClose: insertMoves.tuesdayActualClose ?? null,
      wednesdayActualClose: insertMoves.wednesdayActualClose ?? null,
      thursdayActualClose: insertMoves.thursdayActualClose ?? null,
      fridayActualClose: insertMoves.fridayActualClose ?? null,
      updatedAt: new Date(),
    };
    this.weeklyMoves.set(moves.contractSymbol, moves);
    return moves;
  }

  async updateWeeklyMoves(contractSymbol: string, update: Partial<WeeklyExpectedMoves>): Promise<WeeklyExpectedMoves | undefined> {
    const existing = this.weeklyMoves.get(contractSymbol);
    if (!existing) return undefined;

    const updated: WeeklyExpectedMoves = {
      ...existing,
      ...update,
      updatedAt: new Date(),
    };
    this.weeklyMoves.set(contractSymbol, updated);
    return updated;
  }
}

export const storage = new MemStorage();
