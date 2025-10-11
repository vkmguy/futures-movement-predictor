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
  openInterest: integer("open_interest").notNull(),
  weeklyVolatility: real("weekly_volatility").notNull(),
  dailyVolatility: real("daily_volatility").notNull(),
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
  openInterestChange: real("open_interest_change").notNull(),
  trend: text("trend").notNull(),
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
