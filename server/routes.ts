import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertFuturesContractSchema, insertHistoricalPriceSchema, insertDailyPredictionSchema, insertPriceAlertSchema } from "@shared/schema";
import { setupMarketSimulator } from "./market-simulator";
import { calculateVolatility } from "./volatility-models";

export async function registerRoutes(app: Express): Promise<Server> {
  // Get all futures contracts
  app.get("/api/contracts", async (req, res) => {
    try {
      const contracts = await storage.getAllContracts();
      res.json(contracts);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch contracts" });
    }
  });

  // Get contract by symbol
  app.get("/api/contracts/:symbol", async (req, res) => {
    try {
      const contract = await storage.getContractBySymbol(req.params.symbol);
      if (!contract) {
        return res.status(404).json({ error: "Contract not found" });
      }
      res.json(contract);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch contract" });
    }
  });

  // Create new contract
  app.post("/api/contracts", async (req, res) => {
    try {
      const validatedData = insertFuturesContractSchema.parse(req.body);
      const contract = await storage.createContract(validatedData);
      res.status(201).json(contract);
    } catch (error) {
      res.status(400).json({ error: "Invalid contract data" });
    }
  });

  // Update contract
  app.patch("/api/contracts/:symbol", async (req, res) => {
    try {
      const contract = await storage.updateContract(req.params.symbol, req.body);
      if (!contract) {
        return res.status(404).json({ error: "Contract not found" });
      }
      res.json(contract);
    } catch (error) {
      res.status(500).json({ error: "Failed to update contract" });
    }
  });

  // Get historical prices
  app.get("/api/historical/:symbol", async (req, res) => {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 20;
      
      if (req.params.symbol === "ALL") {
        // For ALL, get the first contract's historical data
        const contracts = await storage.getAllContracts();
        if (contracts.length > 0) {
          const prices = await storage.getHistoricalPrices(contracts[0].symbol, limit);
          return res.json(prices);
        }
        return res.json([]);
      }
      
      const prices = await storage.getHistoricalPrices(req.params.symbol, limit);
      res.json(prices);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch historical prices" });
    }
  });

  // Create historical price
  app.post("/api/historical", async (req, res) => {
    try {
      const validatedData = insertHistoricalPriceSchema.parse(req.body);
      const price = await storage.createHistoricalPrice(validatedData);
      res.status(201).json(price);
    } catch (error) {
      res.status(400).json({ error: "Invalid price data" });
    }
  });

  // Get all predictions
  app.get("/api/predictions/ALL", async (req, res) => {
    try {
      const predictions = await storage.getAllPredictions();
      res.json(predictions);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch predictions" });
    }
  });

  // Get predictions by symbol
  app.get("/api/predictions/:symbol", async (req, res) => {
    try {
      if (req.params.symbol === "ALL") {
        const predictions = await storage.getAllPredictions();
        return res.json(predictions);
      }
      const predictions = await storage.getPredictionsBySymbol(req.params.symbol);
      res.json(predictions);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch predictions" });
    }
  });

  // Create prediction
  app.post("/api/predictions", async (req, res) => {
    try {
      const validatedData = insertDailyPredictionSchema.parse(req.body);
      const prediction = await storage.createPrediction(validatedData);
      res.status(201).json(prediction);
    } catch (error) {
      res.status(400).json({ error: "Invalid prediction data" });
    }
  });

  // Calculate volatility endpoint - converts weekly to daily
  app.post("/api/calculate-volatility", async (req, res) => {
    try {
      const { weeklyVolatility } = req.body;
      if (typeof weeklyVolatility !== 'number') {
        return res.status(400).json({ error: "weeklyVolatility must be a number" });
      }
      
      // σ_daily = σ_weekly / √5
      const dailyVolatility = weeklyVolatility / Math.sqrt(5);
      
      res.json({
        weeklyVolatility,
        dailyVolatility,
        conversionFactor: Math.sqrt(5),
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to calculate volatility" });
    }
  });

  // Generate prediction based on current price and volatility
  app.post("/api/generate-prediction", async (req, res) => {
    try {
      const { contractSymbol, currentPrice, weeklyVolatility, openInterestChange, model = 'standard', recentPriceChange } = req.body;
      
      if (!contractSymbol || typeof currentPrice !== 'number' || typeof weeklyVolatility !== 'number') {
        return res.status(400).json({ error: "Invalid input parameters" });
      }

      // Use advanced volatility model
      const volResult = calculateVolatility(
        model as 'standard' | 'garch' | 'ewma',
        weeklyVolatility,
        recentPriceChange,
      );

      const dailyMove = currentPrice * volResult.dailyVolatility;
      
      const oiChange = openInterestChange || 0;
      const trend = oiChange > 0.02 ? "bullish" : oiChange < -0.02 ? "bearish" : "neutral";
      
      const prediction = await storage.createPrediction({
        contractSymbol,
        currentPrice,
        predictedMin: currentPrice - dailyMove,
        predictedMax: currentPrice + dailyMove,
        dailyVolatility: volResult.dailyVolatility,
        weeklyVolatility: volResult.weeklyVolatility || weeklyVolatility,
        confidence: volResult.confidence,
        openInterestChange: oiChange,
        trend,
      });

      res.status(201).json({ prediction, volResult });
    } catch (error) {
      res.status(500).json({ error: "Failed to generate prediction" });
    }
  });

  // Calculate volatility using advanced models
  app.post("/api/volatility/calculate", async (req, res) => {
    try {
      const { weeklyVolatility, model = 'standard', recentPriceChange, previousVolatility } = req.body;
      
      if (typeof weeklyVolatility !== 'number') {
        return res.status(400).json({ error: "weeklyVolatility must be a number" });
      }

      const result = calculateVolatility(
        model as 'standard' | 'garch' | 'ewma',
        weeklyVolatility,
        recentPriceChange,
        previousVolatility
      );

      res.json(result);
    } catch (error) {
      res.status(500).json({ error: "Failed to calculate volatility" });
    }
  });

  // Alert routes
  app.get("/api/alerts", async (req, res) => {
    try {
      const alerts = await storage.getAllAlerts();
      res.json(alerts);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch alerts" });
    }
  });

  app.get("/api/alerts/active", async (req, res) => {
    try {
      const alerts = await storage.getActiveAlerts();
      res.json(alerts);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch active alerts" });
    }
  });

  app.post("/api/alerts", async (req, res) => {
    try {
      const validatedData = insertPriceAlertSchema.parse(req.body);
      const alert = await storage.createAlert(validatedData);
      res.status(201).json(alert);
    } catch (error) {
      res.status(400).json({ error: "Invalid alert data" });
    }
  });

  app.patch("/api/alerts/:id", async (req, res) => {
    try {
      const alert = await storage.updateAlert(req.params.id, req.body);
      if (!alert) {
        return res.status(404).json({ error: "Alert not found" });
      }
      res.json(alert);
    } catch (error) {
      res.status(500).json({ error: "Failed to update alert" });
    }
  });

  app.delete("/api/alerts/:id", async (req, res) => {
    try {
      const deleted = await storage.deleteAlert(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Alert not found" });
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete alert" });
    }
  });

  const httpServer = createServer(app);
  
  // Setup WebSocket market simulator for live data
  setupMarketSimulator(httpServer);
  
  return httpServer;
}
