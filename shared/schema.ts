import { sql } from "drizzle-orm";
import { pgTable, text, varchar, real, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const futuresContracts = pgTable("futures_contracts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  symbol: text("symbol").notNull().unique(),
  name: text("name").notNull(),
  currentPrice: real("current_price").notNull(),
  previousClose: real("previous_close").notNull(),
  dailyChange: real("daily_change").notNull(),
  dailyChangePercent: real("daily_change_percent").notNull(),
  volume: integer("volume").notNull(),
  weeklyVolatility: real("weekly_volatility").notNull(),
  dailyVolatility: real("daily_volatility").notNull(), // σ_daily = σ_weekly / √N (N = days remaining)
  tickSize: real("tick_size").notNull().default(0.01), // Minimum price increment for the contract
  
  // Expiration tracking fields
  contractType: text("contract_type").notNull().default('equity_index'), // 'equity_index' or 'commodity'
  expirationDate: timestamp("expiration_date"), // Last trading day
  daysRemaining: integer("days_remaining"), // Trading days until expiration
  isExpirationWeek: integer("is_expiration_week").notNull().default(0), // 1 if ≤5 days remaining
  
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const historicalPrices = pgTable("historical_prices", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  contractSymbol: text("contract_symbol").notNull(),
  date: timestamp("date").notNull(),
  open: real("open").notNull(),
  high: real("high").notNull(),
  low: real("low").notNull(),
  close: real("close").notNull(),
  volume: integer("volume").notNull(),
});

export const dailyPredictions = pgTable("daily_predictions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  contractSymbol: text("contract_symbol").notNull(),
  date: timestamp("date").notNull().defaultNow(),
  currentPrice: real("current_price").notNull(),
  predictedMin: real("predicted_min").notNull(),
  predictedMax: real("predicted_max").notNull(),
  dailyVolatility: real("daily_volatility").notNull(),
  weeklyVolatility: real("weekly_volatility").notNull(),
  confidence: real("confidence").notNull(),
});

export const insertFuturesContractSchema = createInsertSchema(futuresContracts).omit({
  id: true,
  updatedAt: true,
});

export const insertHistoricalPriceSchema = createInsertSchema(historicalPrices).omit({
  id: true,
});

export const insertDailyPredictionSchema = createInsertSchema(dailyPredictions).omit({
  id: true,
  date: true,
});

export type InsertFuturesContract = z.infer<typeof insertFuturesContractSchema>;
export type FuturesContract = typeof futuresContracts.$inferSelect;

export type InsertHistoricalPrice = z.infer<typeof insertHistoricalPriceSchema>;
export type HistoricalPrice = typeof historicalPrices.$inferSelect;

export type InsertDailyPrediction = z.infer<typeof insertDailyPredictionSchema>;
export type DailyPrediction = typeof dailyPredictions.$inferSelect;

export const priceAlerts = pgTable("price_alerts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  contractSymbol: text("contract_symbol").notNull(),
  alertType: text("alert_type").notNull(), // "price_above", "price_below", "movement_exceeded"
  targetPrice: real("target_price"),
  percentage: real("percentage"),
  isActive: integer("is_active").notNull().default(1),
  triggered: integer("triggered").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertPriceAlertSchema = createInsertSchema(priceAlerts).omit({
  id: true,
  createdAt: true,
});

export type InsertPriceAlert = z.infer<typeof insertPriceAlertSchema>;
export type PriceAlert = typeof priceAlerts.$inferSelect;

export const weeklyExpectedMoves = pgTable("weekly_expected_moves", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  contractSymbol: text("contract_symbol").notNull(),
  weekStartDate: timestamp("week_start_date").notNull(),
  currentDayOfWeek: text("current_day_of_week").notNull(), // "monday", "tuesday", etc.
  
  // Opening price for the week (Monday open)
  weekOpenPrice: real("week_open_price").notNull(),
  
  // Daily expected moves based on IV
  mondayExpectedHigh: real("monday_expected_high").notNull(),
  mondayExpectedLow: real("monday_expected_low").notNull(),
  mondayActualClose: real("monday_actual_close"),
  
  tuesdayExpectedHigh: real("tuesday_expected_high").notNull(),
  tuesdayExpectedLow: real("tuesday_expected_low").notNull(),
  tuesdayActualClose: real("tuesday_actual_close"),
  
  wednesdayExpectedHigh: real("wednesday_expected_high").notNull(),
  wednesdayExpectedLow: real("wednesday_expected_low").notNull(),
  wednesdayActualClose: real("wednesday_actual_close"),
  
  thursdayExpectedHigh: real("thursday_expected_high").notNull(),
  thursdayExpectedLow: real("thursday_expected_low").notNull(),
  thursdayActualClose: real("thursday_actual_close"),
  
  fridayExpectedHigh: real("friday_expected_high").notNull(),
  fridayExpectedLow: real("friday_expected_low").notNull(),
  fridayActualClose: real("friday_actual_close"),
  
  // Weekly IV and volatility
  impliedVolatility: real("implied_volatility").notNull(),
  weeklyVolatility: real("weekly_volatility").notNull(),
  
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertWeeklyExpectedMovesSchema = createInsertSchema(weeklyExpectedMoves).omit({
  id: true,
  updatedAt: true,
});

export type InsertWeeklyExpectedMoves = z.infer<typeof insertWeeklyExpectedMovesSchema>;
export type WeeklyExpectedMoves = typeof weeklyExpectedMoves.$inferSelect;

// Historical Daily Expected Moves - accumulates daily, never deleted
export const historicalDailyExpectedMoves = pgTable("historical_daily_expected_moves", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  contractSymbol: text("contract_symbol").notNull(),
  date: timestamp("date").notNull(), // Trading date
  
  // Yahoo Finance last traded price data
  lastTradedPrice: real("last_traded_price").notNull(),
  previousClose: real("previous_close").notNull(),
  
  // Volatility data
  weeklyVolatility: real("weekly_volatility").notNull(),
  dailyVolatility: real("daily_volatility").notNull(), // σ_daily = σ_weekly / √5
  
  // Expected move ranges
  expectedHigh: real("expected_high").notNull(), // lastPrice + dailyVolatility
  expectedLow: real("expected_low").notNull(), // lastPrice - dailyVolatility
  
  // Actual price for validation (filled at end of day)
  actualClose: real("actual_close"),
  withinRange: integer("within_range"), // 1 if actualClose within range, 0 if not, null if not yet closed
  
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertHistoricalDailyExpectedMovesSchema = createInsertSchema(historicalDailyExpectedMoves).omit({
  id: true,
  createdAt: true,
});

export type InsertHistoricalDailyExpectedMoves = z.infer<typeof insertHistoricalDailyExpectedMovesSchema>;
export type HistoricalDailyExpectedMoves = typeof historicalDailyExpectedMoves.$inferSelect;

// IV Updates History - tracks all manual IV updates with dates
export const ivUpdates = pgTable("iv_updates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  contractSymbol: text("contract_symbol").notNull(),
  weeklyVolatility: real("weekly_volatility").notNull(), // IV as decimal (e.g., 0.042 for 4.2%)
  updateDate: timestamp("update_date").notNull(), // Date of the update
  source: text("source").notNull().default('manual'), // 'manual', 'system', etc.
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertIvUpdateSchema = createInsertSchema(ivUpdates).omit({
  id: true,
  createdAt: true,
});

export type InsertIvUpdate = z.infer<typeof insertIvUpdateSchema>;
export type IvUpdate = typeof ivUpdates.$inferSelect;

// IV Batch Update Schema
const VALID_CONTRACT_SYMBOLS = ["/NQ", "/ES", "/YM", "/RTY", "/GC", "/CL"] as const;

export const ivBatchUpdateSchema = z.object({
  updates: z.array(
    z.object({
      symbol: z.enum(VALID_CONTRACT_SYMBOLS, {
        errorMap: () => ({ message: "Symbol must be one of: /NQ, /ES, /YM, /RTY, /GC, /CL" })
      }),
      weeklyVolatility: z.number()
        .min(0, "Weekly volatility must be at least 0")
        .max(1, "Weekly volatility must be at most 1")
    })
  )
    .min(1, "At least one update is required")
    .refine(
      (updates) => {
        const symbols = updates.map(u => u.symbol);
        return symbols.length === new Set(symbols).size;
      },
      { message: "Duplicate symbols are not allowed" }
    )
});

export type IVBatchUpdate = z.infer<typeof ivBatchUpdateSchema>;
