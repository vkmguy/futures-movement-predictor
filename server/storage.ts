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
  type InsertWeeklyExpectedMoves,
  type HistoricalDailyExpectedMoves,
  type InsertHistoricalDailyExpectedMoves,
  type IvUpdate,
  type InsertIvUpdate,
  weeklyExpectedMoves
} from "@shared/schema";
import { randomUUID } from "crypto";
import { db } from "./db";
import { eq, and, desc } from "drizzle-orm";

export interface IStorage {
  // Futures Contracts
  getAllContracts(): Promise<FuturesContract[]>;
  getContractBySymbol(symbol: string): Promise<FuturesContract | undefined>;
  createContract(contract: InsertFuturesContract): Promise<FuturesContract>;
  updateContract(symbol: string, contract: Partial<InsertFuturesContract>): Promise<FuturesContract | undefined>;
  batchUpdateVolatility(updates: { symbol: string; weeklyVolatility: number }[]): Promise<FuturesContract[]>;
  
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
  getWeeklyMovesByWeek(contractSymbol: string, weekStartDate: Date): Promise<WeeklyExpectedMoves | undefined>;
  createWeeklyMoves(moves: InsertWeeklyExpectedMoves): Promise<WeeklyExpectedMoves>;
  updateWeeklyMoves(contractSymbol: string, update: Partial<WeeklyExpectedMoves>): Promise<WeeklyExpectedMoves | undefined>;
  deleteWeeklyMoves(id: string): Promise<boolean>;

  // Historical Daily Expected Moves
  getAllHistoricalDailyMoves(): Promise<HistoricalDailyExpectedMoves[]>;
  getHistoricalDailyMovesBySymbol(contractSymbol: string, limit?: number): Promise<HistoricalDailyExpectedMoves[]>;
  getHistoricalDailyMovesByDate(contractSymbol: string, date: Date): Promise<HistoricalDailyExpectedMoves | undefined>;
  createHistoricalDailyMoves(moves: InsertHistoricalDailyExpectedMoves): Promise<HistoricalDailyExpectedMoves>;
  updateHistoricalDailyMoves(id: string, update: Partial<HistoricalDailyExpectedMoves>): Promise<HistoricalDailyExpectedMoves | undefined>;

  // IV Updates History
  getAllIvUpdates(): Promise<IvUpdate[]>;
  getIvUpdatesBySymbol(contractSymbol: string, limit?: number): Promise<IvUpdate[]>;
  getIvUpdateByDate(contractSymbol: string, date: Date): Promise<IvUpdate | undefined>;
  createIvUpdate(update: InsertIvUpdate): Promise<IvUpdate>;
  updateIvUpdate(id: string, update: Partial<IvUpdate>): Promise<IvUpdate | undefined>;
}

export class MemStorage implements IStorage {
  private contracts: Map<string, FuturesContract>;
  private historicalPrices: Map<string, HistoricalPrice[]>;
  private predictions: Map<string, DailyPrediction>;
  private alerts: Map<string, PriceAlert>;
  private weeklyMoves: Map<string, WeeklyExpectedMoves>;
  private historicalDailyMoves: Map<string, HistoricalDailyExpectedMoves[]>;
  private ivUpdates: Map<string, IvUpdate[]>;

  constructor() {
    this.contracts = new Map();
    this.historicalPrices = new Map();
    this.predictions = new Map();
    this.alerts = new Map();
    this.weeklyMoves = new Map();
    this.historicalDailyMoves = new Map();
    this.ivUpdates = new Map();
    this.initializeContractTemplates();
  }

  // Async initialization method to fetch real Yahoo Finance data
  async initializeWithRealData() {
    try {
      const { getAllLastTradedPrices } = await import('./yahoo-finance');
      const { getContractExpirationInfo, calculateDynamicDailyVolatility } = await import('./expiration-calendar');
      
      console.log("📡 Fetching real Yahoo Finance data for initialization...");
      const quotes = await getAllLastTradedPrices();
      
      if (quotes.length === 0) {
        console.warn("⚠️  No Yahoo Finance data available, using template data");
        return;
      }
      
      console.log(`✅ Received ${quotes.length} quotes from Yahoo Finance`);
      
      // Update contracts with real Yahoo Finance data
      for (const quote of quotes) {
        const contract = this.contracts.get(quote.symbol);
        if (contract) {
          const expirationInfo = getContractExpirationInfo(quote.symbol, new Date());
          const dailyVolatility = calculateDynamicDailyVolatility(
            contract.weeklyVolatility,
            expirationInfo.daysRemaining
          );
          
          contract.currentPrice = quote.regularMarketPrice;
          contract.previousClose = quote.regularMarketPreviousClose;
          contract.dailyChange = quote.regularMarketChange;
          contract.dailyChangePercent = quote.regularMarketChangePercent;
          contract.dailyVolatility = dailyVolatility;
          contract.contractType = expirationInfo.contractType;
          contract.expirationDate = expirationInfo.expirationDate;
          contract.daysRemaining = expirationInfo.daysRemaining;
          contract.isExpirationWeek = expirationInfo.isExpirationWeek ? 1 : 0;
          contract.updatedAt = new Date();
          
          console.log(`  📊 ${quote.symbol}: $${quote.regularMarketPrice.toFixed(2)} (${expirationInfo.daysRemaining} days to expiration)`);
        }
      }
      
      console.log("✅ Dashboard initialized with real Yahoo Finance data");
    } catch (error) {
      console.error("❌ Failed to initialize with real data:", error);
      console.log("⚠️  Using template data as fallback");
    }
  }

  private initializeContractTemplates() {
    // Initialize contract templates (will be updated with real Yahoo Finance data)
    const mockContracts: InsertFuturesContract[] = [
      {
        symbol: "/NQ",
        name: "E-mini Nasdaq-100",
        currentPrice: 24726.75,
        previousClose: 24650.50,
        dailyChange: 76.25,
        dailyChangePercent: 0.309,
        volume: 345678,
        weeklyVolatility: 0.0285,
        dailyVolatility: 0.0127,
        tickSize: 0.25,
        contractType: "equity_index",
        expirationDate: new Date("2025-12-19"),
        daysRemaining: 48,
        isExpirationWeek: 0,
      },
      {
        symbol: "/ES",
        name: "E-mini S&P 500",
        currentPrice: 6595.25,
        previousClose: 6774.00,
        dailyChange: -178.75,
        dailyChangePercent: -2.64,
        volume: 2145321,
        weeklyVolatility: 0.0245,
        dailyVolatility: 0.0110,
        tickSize: 0.25,
        contractType: "equity_index",
        expirationDate: new Date("2025-12-19"),
        daysRemaining: 48,
        isExpirationWeek: 0,
      },
      {
        symbol: "/YM",
        name: "E-mini Dow Jones",
        currentPrice: 45706.00,
        previousClose: 46593.00,
        dailyChange: -887.00,
        dailyChangePercent: -1.90,
        volume: 149700,
        weeklyVolatility: 0.0235,
        dailyVolatility: 0.0105,
        tickSize: 1.0,
        contractType: "equity_index",
        expirationDate: new Date("2025-12-19"),
        daysRemaining: 48,
        isExpirationWeek: 0,
      },
      {
        symbol: "/RTY",
        name: "E-mini Russell 2000",
        currentPrice: 2234.20,
        previousClose: 2221.80,
        dailyChange: 12.40,
        dailyChangePercent: 0.56,
        volume: 15950,
        weeklyVolatility: 0.0325,
        dailyVolatility: 0.0145,
        tickSize: 0.10,
        contractType: "equity_index",
        expirationDate: new Date("2025-12-19"),
        daysRemaining: 48,
        isExpirationWeek: 0,
      },
      {
        symbol: "/GC",
        name: "Gold Futures",
        currentPrice: 4000.40,
        previousClose: 3972.60,
        dailyChange: 27.80,
        dailyChangePercent: 0.70,
        volume: 352500,
        weeklyVolatility: 0.0195,
        dailyVolatility: 0.0087,
        tickSize: 0.10,
        contractType: "commodity",
        expirationDate: new Date("2025-10-29"),
        daysRemaining: 13,
        isExpirationWeek: 0,
      },
      {
        symbol: "/CL",
        name: "Crude Oil Futures",
        currentPrice: 58.90,
        previousClose: 61.51,
        dailyChange: -2.61,
        dailyChangePercent: -4.24,
        volume: 236000,
        weeklyVolatility: 0.0415,
        dailyVolatility: 0.0186,
        tickSize: 0.01,
        contractType: "commodity",
        expirationDate: new Date("2025-10-22"),
        daysRemaining: 7,
        isExpirationWeek: 0,
      },
    ];

    mockContracts.forEach(contract => {
      const id = randomUUID();
      const fullContract: FuturesContract = {
        ...contract,
        id,
        updatedAt: new Date(),
        contractType: contract.contractType || 'equity_index',
        expirationDate: contract.expirationDate || null,
        daysRemaining: contract.daysRemaining || null,
        isExpirationWeek: contract.isExpirationWeek ?? 0,
        tickSize: contract.tickSize ?? 0.01,
      };
      this.contracts.set(contract.symbol, fullContract);

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
      contractType: insertContract.contractType || 'equity_index',
      expirationDate: insertContract.expirationDate || null,
      daysRemaining: insertContract.daysRemaining || null,
      isExpirationWeek: insertContract.isExpirationWeek ?? 0,
      tickSize: insertContract.tickSize ?? 0.01,
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

  async batchUpdateVolatility(updates: { symbol: string; weeklyVolatility: number }[]): Promise<FuturesContract[]> {
    const updatedContracts: FuturesContract[] = [];
    
    for (const update of updates) {
      const existing = this.contracts.get(update.symbol);
      if (existing) {
        console.log(`📈 Updating ${update.symbol}: ${existing.weeklyVolatility} → ${update.weeklyVolatility}`);
        
        // Recalculate dailyVolatility when weeklyVolatility changes
        const { calculateDynamicDailyVolatility } = await import('./expiration-calendar');
        const dailyVolatility = calculateDynamicDailyVolatility(
          update.weeklyVolatility,
          existing.daysRemaining || 5
        );
        
        const updated: FuturesContract = {
          ...existing,
          weeklyVolatility: update.weeklyVolatility,
          dailyVolatility,
          updatedAt: new Date(),
        };
        this.contracts.set(update.symbol, updated);
        updatedContracts.push(updated);
        console.log(`✅ Updated ${update.symbol}: weeklyVol=${updated.weeklyVolatility}, dailyVol=${updated.dailyVolatility}`);
      } else {
        console.warn(`⚠️  Contract ${update.symbol} not found, skipping`);
      }
    }
    
    return updatedContracts;
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
    // Get the most recent weekly move for this contract
    const results = await db
      .select()
      .from(weeklyExpectedMoves)
      .where(eq(weeklyExpectedMoves.contractSymbol, contractSymbol))
      .orderBy(desc(weeklyExpectedMoves.weekStartDate))
      .limit(1);
    
    return results[0];
  }

  async getAllWeeklyMoves(): Promise<WeeklyExpectedMoves[]> {
    // Get all weekly moves, grouped by most recent per contract
    const results = await db
      .select()
      .from(weeklyExpectedMoves)
      .orderBy(desc(weeklyExpectedMoves.weekStartDate));
    
    // Filter to keep only the most recent entry per contract
    const latestByContract = new Map<string, WeeklyExpectedMoves>();
    for (const move of results) {
      if (!latestByContract.has(move.contractSymbol)) {
        latestByContract.set(move.contractSymbol, move);
      }
    }
    
    return Array.from(latestByContract.values());
  }

  async getWeeklyMovesByWeek(contractSymbol: string, weekStartDate: Date): Promise<WeeklyExpectedMoves | undefined> {
    const dateStr = weekStartDate.toISOString().split('T')[0];
    const results = await db
      .select()
      .from(weeklyExpectedMoves)
      .where(
        and(
          eq(weeklyExpectedMoves.contractSymbol, contractSymbol),
          eq(weeklyExpectedMoves.weekStartDate, weekStartDate)
        )
      )
      .limit(1);
    
    return results[0];
  }

  async createWeeklyMoves(insertMoves: InsertWeeklyExpectedMoves): Promise<WeeklyExpectedMoves> {
    const results = await db
      .insert(weeklyExpectedMoves)
      .values(insertMoves)
      .returning();
    
    return results[0];
  }

  async updateWeeklyMoves(contractSymbol: string, update: Partial<WeeklyExpectedMoves>): Promise<WeeklyExpectedMoves | undefined> {
    const existing = await this.getWeeklyMoves(contractSymbol);
    if (!existing) return undefined;

    const results = await db
      .update(weeklyExpectedMoves)
      .set({ ...update, updatedAt: new Date() })
      .where(eq(weeklyExpectedMoves.id, existing.id))
      .returning();
    
    return results[0];
  }

  async deleteWeeklyMoves(id: string): Promise<boolean> {
    const result = await db
      .delete(weeklyExpectedMoves)
      .where(eq(weeklyExpectedMoves.id, id))
      .returning();
    
    return result.length > 0;
  }

  async getAllHistoricalDailyMoves(): Promise<HistoricalDailyExpectedMoves[]> {
    const allMoves: HistoricalDailyExpectedMoves[] = [];
    for (const moves of Array.from(this.historicalDailyMoves.values())) {
      allMoves.push(...moves);
    }
    return allMoves.sort((a, b) => b.date.getTime() - a.date.getTime());
  }

  async getHistoricalDailyMovesBySymbol(contractSymbol: string, limit: number = 30): Promise<HistoricalDailyExpectedMoves[]> {
    const moves = this.historicalDailyMoves.get(contractSymbol) || [];
    return moves.slice(-limit).sort((a, b) => b.date.getTime() - a.date.getTime());
  }

  async getHistoricalDailyMovesByDate(contractSymbol: string, date: Date): Promise<HistoricalDailyExpectedMoves | undefined> {
    const moves = this.historicalDailyMoves.get(contractSymbol) || [];
    const dateStr = date.toISOString().split('T')[0];
    return moves.find(m => m.date.toISOString().split('T')[0] === dateStr);
  }

  async createHistoricalDailyMoves(insertMoves: InsertHistoricalDailyExpectedMoves): Promise<HistoricalDailyExpectedMoves> {
    const id = randomUUID();
    const moves: HistoricalDailyExpectedMoves = {
      ...insertMoves,
      id,
      actualClose: insertMoves.actualClose ?? null,
      withinRange: insertMoves.withinRange ?? null,
      createdAt: new Date(),
    };
    
    const existing = this.historicalDailyMoves.get(insertMoves.contractSymbol) || [];
    existing.push(moves);
    this.historicalDailyMoves.set(insertMoves.contractSymbol, existing);
    
    return moves;
  }

  async updateHistoricalDailyMoves(id: string, update: Partial<HistoricalDailyExpectedMoves>): Promise<HistoricalDailyExpectedMoves | undefined> {
    for (const [symbol, moves] of Array.from(this.historicalDailyMoves.entries())) {
      const index = moves.findIndex((m: HistoricalDailyExpectedMoves) => m.id === id);
      if (index !== -1) {
        const updated = { ...moves[index], ...update };
        moves[index] = updated;
        this.historicalDailyMoves.set(symbol, moves);
        return updated;
      }
    }
    return undefined;
  }

  // IV Updates History Methods
  async getAllIvUpdates(): Promise<IvUpdate[]> {
    const allUpdates: IvUpdate[] = [];
    for (const updates of Array.from(this.ivUpdates.values())) {
      allUpdates.push(...updates);
    }
    return allUpdates.sort((a, b) => b.updateDate.getTime() - a.updateDate.getTime());
  }

  async getIvUpdatesBySymbol(contractSymbol: string, limit: number = 30): Promise<IvUpdate[]> {
    const updates = this.ivUpdates.get(contractSymbol) || [];
    return updates.slice(-limit).sort((a, b) => b.updateDate.getTime() - a.updateDate.getTime());
  }

  async getIvUpdateByDate(contractSymbol: string, date: Date): Promise<IvUpdate | undefined> {
    const updates = this.ivUpdates.get(contractSymbol) || [];
    const dateStr = date.toISOString().split('T')[0];
    return updates.find(u => u.updateDate.toISOString().split('T')[0] === dateStr);
  }

  async createIvUpdate(insertUpdate: InsertIvUpdate): Promise<IvUpdate> {
    const id = randomUUID();
    const update: IvUpdate = {
      ...insertUpdate,
      id,
      source: insertUpdate.source ?? 'manual',
      createdAt: new Date(),
    };
    
    const existing = this.ivUpdates.get(insertUpdate.contractSymbol) || [];
    existing.push(update);
    this.ivUpdates.set(insertUpdate.contractSymbol, existing);
    
    return update;
  }

  async updateIvUpdate(id: string, updateData: Partial<IvUpdate>): Promise<IvUpdate | undefined> {
    for (const [symbol, updates] of Array.from(this.ivUpdates.entries())) {
      const index = updates.findIndex((u: IvUpdate) => u.id === id);
      if (index !== -1) {
        const updated = { ...updates[index], ...updateData };
        updates[index] = updated;
        this.ivUpdates.set(symbol, updates);
        return updated;
      }
    }
    return undefined;
  }
}

export const storage = new MemStorage();
