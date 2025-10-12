import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertFuturesContractSchema, insertHistoricalPriceSchema, insertDailyPredictionSchema, insertPriceAlertSchema, insertWeeklyExpectedMovesSchema, insertHistoricalDailyExpectedMovesSchema } from "@shared/schema";
import { setupMarketSimulator } from "./market-simulator";
import { calculateVolatility } from "./volatility-models";
import { calculateWeeklyExpectedMoves, getCurrentDayOfWeek, getWeekStartDate } from "./weekly-calculator";
import { getMarketStatus } from "./market-hours";
import { getLastTradedPrice, getAllLastTradedPrices } from "./yahoo-finance";
import { runNightlyCalculation } from "./nightly-scheduler";

export async function registerRoutes(app: Express): Promise<Server> {
  // Health check endpoint for Docker/Kubernetes
  app.get("/health", async (req, res) => {
    res.status(200).json({ 
      status: "healthy", 
      timestamp: new Date().toISOString(),
      service: "futures-predictor"
    });
  });

  // Get market status
  app.get("/api/market/status", async (req, res) => {
    try {
      const status = getMarketStatus();
      res.json(status);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch market status" });
    }
  });

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

  // Get IV update history
  app.get("/api/iv-updates", async (req, res) => {
    try {
      const { symbol } = req.query;
      
      if (symbol && typeof symbol === 'string') {
        const updates = await storage.getIvUpdatesBySymbol(symbol);
        return res.json(updates);
      }
      
      const allUpdates = await storage.getAllIvUpdates();
      res.json(allUpdates);
    } catch (error) {
      console.error("Error fetching IV updates:", error);
      res.status(500).json({ error: "Failed to fetch IV updates" });
    }
  });

  // Batch update IV (weekly volatility) values
  app.post("/api/contracts/batch-update-iv", async (req, res) => {
    try {
      const { ivBatchUpdateSchema, insertIvUpdateSchema } = await import("@shared/schema");
      
      console.log("📊 Received batch IV update request:", JSON.stringify(req.body, null, 2));
      
      // Validate request body with Zod schema
      const validationResult = ivBatchUpdateSchema.safeParse(req.body);
      
      if (!validationResult.success) {
        console.error("❌ Validation failed:", validationResult.error.errors);
        return res.status(400).json({ 
          error: "Validation failed", 
          details: validationResult.error.errors 
        });
      }
      
      const { updates } = validationResult.data;
      const confirmOverwrite = req.body.confirmOverwrite === true;
      console.log("✅ Validated updates:", updates, "Confirm:", confirmOverwrite);
      
      // Check for existing IV updates today (unless user confirmed overwrite)
      if (!confirmOverwrite) {
        const today = new Date();
        const existingUpdates: any[] = [];
        
        for (const update of updates) {
          const existing = await storage.getIvUpdateByDate(update.symbol, today);
          if (existing) {
            existingUpdates.push({
              symbol: update.symbol,
              currentValue: existing.weeklyVolatility,
              newValue: update.weeklyVolatility,
              updatedAt: existing.createdAt,
            });
          }
        }
        
        // If there are existing updates for today, ask for confirmation
        if (existingUpdates.length > 0) {
          console.log("⚠️  Found existing IV updates for today:", existingUpdates);
          return res.status(409).json({ 
            requiresConfirmation: true,
            existingUpdates,
            message: `IV values were already updated today for ${existingUpdates.length} contract${existingUpdates.length > 1 ? 's' : ''}. Do you want to overwrite?`
          });
        }
      }
      
      // Perform batch update
      const updatedContracts = await storage.batchUpdateVolatility(updates);
      
      // Ensure at least one contract was updated
      if (updatedContracts.length === 0) {
        return res.status(400).json({ 
          error: "No contracts were updated",
          details: "All provided symbols may be invalid or not found in the system"
        });
      }
      
      // Store IV update history
      const today = new Date();
      const ivUpdatePromises = updates.map(async (update) => {
        // Check if update exists for today
        const existing = await storage.getIvUpdateByDate(update.symbol, today);
        
        if (existing && confirmOverwrite) {
          // Update existing record
          return await storage.updateIvUpdate(existing.id, {
            weeklyVolatility: update.weeklyVolatility,
          });
        } else if (!existing) {
          // Create new record
          const ivUpdate = insertIvUpdateSchema.parse({
            contractSymbol: update.symbol,
            weeklyVolatility: update.weeklyVolatility,
            updateDate: today,
            source: 'manual',
          });
          return await storage.createIvUpdate(ivUpdate);
        }
      });
      
      await Promise.all(ivUpdatePromises);
      
      // Regenerate predictions for all updated contracts (replace, not accumulate)
      for (const contract of updatedContracts) {
        const dailyMove = contract.currentPrice * contract.dailyVolatility;
        
        // Create/replace prediction (storage.createPrediction overwrites by symbol in MemStorage)
        await storage.createPrediction({
          contractSymbol: contract.symbol,
          currentPrice: contract.currentPrice,
          predictedMin: contract.currentPrice - dailyMove,
          predictedMax: contract.currentPrice + dailyMove,
          dailyVolatility: contract.dailyVolatility,
          weeklyVolatility: contract.weeklyVolatility,
          confidence: 0.85,
          openInterestChange: 0,
          trend: "neutral",
        });
      }
      
      res.json({ 
        success: true, 
        updatedContracts,
        message: `Successfully updated IV for ${updatedContracts.length} contract${updatedContracts.length > 1 ? 's' : ''}: ${updatedContracts.map(c => c.symbol).join(', ')}` 
      });
    } catch (error: any) {
      console.error("Batch IV update error:", error);
      res.status(500).json({ error: error.message || "Failed to batch update IV" });
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

      // Get contract to check days remaining
      const contract = await storage.getContractBySymbol(contractSymbol);
      const daysRemaining = contract?.daysRemaining ?? undefined;

      // Use advanced volatility model with dynamic scaling
      const volResult = calculateVolatility(
        model as 'standard' | 'garch' | 'ewma',
        weeklyVolatility,
        recentPriceChange,
        undefined, // previousVolatility
        daysRemaining
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

  // Weekly Expected Moves routes
  app.get("/api/weekly-moves", async (req, res) => {
    try {
      const moves = await storage.getAllWeeklyMoves();
      res.json(moves);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch weekly moves" });
    }
  });

  app.get("/api/weekly-moves/:symbol", async (req, res) => {
    try {
      const moves = await storage.getWeeklyMoves(req.params.symbol);
      if (!moves) {
        return res.status(404).json({ error: "Weekly moves not found" });
      }
      res.json(moves);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch weekly moves" });
    }
  });

  app.post("/api/weekly-moves/generate", async (req, res) => {
    try {
      const { contractSymbol, currentPrice, weeklyVolatility } = req.body;
      
      if (!contractSymbol || typeof currentPrice !== 'number' || typeof weeklyVolatility !== 'number') {
        return res.status(400).json({ error: "Invalid input parameters" });
      }

      const weekStartDate = getWeekStartDate();
      const currentDay = getCurrentDayOfWeek();

      // Check if weekly moves already exist for this contract
      const existing = await storage.getWeeklyMoves(contractSymbol);
      
      // If data exists and it's for the same week, return existing data (don't regenerate)
      if (existing && existing.weekStartDate.toISOString().split('T')[0] === weekStartDate.toISOString().split('T')[0]) {
        console.log(`📅 Weekly moves already exist for ${contractSymbol} (week of ${weekStartDate.toISOString().split('T')[0]}), using existing data`);
        return res.status(200).json(existing);
      }
      
      // If it's a new week or no existing data, generate new moves
      const weekOpenPrice = currentPrice; // New week always starts with current price
      
      const calculatedMoves = calculateWeeklyExpectedMoves(
        contractSymbol,
        weekOpenPrice,
        weeklyVolatility,
        weekStartDate,
        currentDay
      );

      let result;
      
      if (existing && existing.weekStartDate.toISOString().split('T')[0] !== weekStartDate.toISOString().split('T')[0]) {
        // New week - create fresh moves (replaces old week's data)
        console.log(`🔄 New week detected for ${contractSymbol}, creating fresh weekly moves`);
        result = await storage.createWeeklyMoves(calculatedMoves);
      } else {
        // No existing data - create new
        console.log(`✨ Creating new weekly moves for ${contractSymbol}`);
        result = await storage.createWeeklyMoves(calculatedMoves);
      }

      res.status(201).json(result);
    } catch (error) {
      console.error("Error generating weekly moves:", error);
      res.status(500).json({ error: "Failed to generate weekly moves" });
    }
  });

  app.patch("/api/weekly-moves/:symbol/update-actual", async (req, res) => {
    try {
      const { day, actualClose } = req.body;
      
      if (!day || typeof actualClose !== 'number') {
        return res.status(400).json({ error: "Invalid input parameters" });
      }

      const existing = await storage.getWeeklyMoves(req.params.symbol);
      if (!existing) {
        return res.status(404).json({ error: "Weekly moves not found" });
      }

      const updateKey = `${day}ActualClose` as keyof typeof existing;
      const update = { [updateKey]: actualClose };

      const result = await storage.updateWeeklyMoves(req.params.symbol, update);
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: "Failed to update actual close" });
    }
  });

  // Historical Daily Expected Moves Routes
  
  // Get all historical daily moves
  app.get("/api/historical-daily-moves", async (req, res) => {
    try {
      const moves = await storage.getAllHistoricalDailyMoves();
      res.json(moves);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch historical daily moves" });
    }
  });

  // Get historical daily moves by symbol
  app.get("/api/historical-daily-moves/:symbol", async (req, res) => {
    try {
      const symbol = decodeURIComponent(req.params.symbol);
      
      // Handle "ALL" as a special case to get all moves
      if (symbol === "ALL") {
        const moves = await storage.getAllHistoricalDailyMoves();
        res.json(moves);
        return;
      }
      
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 30;
      const moves = await storage.getHistoricalDailyMovesBySymbol(symbol, limit);
      res.json(moves);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch historical daily moves" });
    }
  });

  // Collect daily data from Yahoo Finance and create historical expected moves
  app.post("/api/collect-daily-data", async (req, res) => {
    try {
      const quotes = await getAllLastTradedPrices();
      const results = [];
      const skipped = [];
      const today = new Date();

      for (const quote of quotes) {
        // Check if data for today already exists
        const existing = await storage.getHistoricalDailyMovesByDate(quote.symbol, today);
        if (existing) {
          console.log(`📅 Historical data already exists for ${quote.symbol} on ${today.toISOString().split('T')[0]}, skipping`);
          skipped.push(quote.symbol);
          continue;
        }

        // Get contract to retrieve volatility data
        const contract = await storage.getContractBySymbol(quote.symbol);
        if (!contract) {
          console.error(`Contract not found for symbol: ${quote.symbol}`);
          continue;
        }

        // Calculate daily volatility: σ_daily = σ_weekly / √5
        const dailyVolatility = contract.weeklyVolatility / Math.sqrt(5);

        // Calculate expected move ranges
        const expectedHigh = quote.regularMarketPrice + (quote.regularMarketPrice * dailyVolatility);
        const expectedLow = quote.regularMarketPrice - (quote.regularMarketPrice * dailyVolatility);

        // Create historical daily expected moves record
        const movesData: typeof insertHistoricalDailyExpectedMovesSchema._type = {
          contractSymbol: quote.symbol,
          date: today,
          lastTradedPrice: quote.regularMarketPrice,
          previousClose: quote.regularMarketPreviousClose,
          weeklyVolatility: contract.weeklyVolatility,
          dailyVolatility,
          expectedHigh,
          expectedLow,
          actualClose: null,
          withinRange: null,
        };

        const validatedData = insertHistoricalDailyExpectedMovesSchema.parse(movesData);
        const created = await storage.createHistoricalDailyMoves(validatedData);
        results.push(created);
        console.log(`✨ Created historical data for ${quote.symbol}`);
      }

      const message = skipped.length > 0 
        ? `Collected daily data for ${results.length} contracts (skipped ${skipped.length} duplicates: ${skipped.join(', ')})`
        : `Collected daily data for ${results.length} contracts`;

      res.status(201).json({ 
        message,
        data: results,
        skipped 
      });
    } catch (error) {
      console.error("Error collecting daily data:", error);
      res.status(500).json({ error: "Failed to collect daily data" });
    }
  });

  // Update historical daily moves with actual close price
  app.patch("/api/historical-daily-moves/:id/actual-close", async (req, res) => {
    try {
      const { actualClose } = req.body;
      
      if (typeof actualClose !== 'number') {
        return res.status(400).json({ error: "Invalid actual close price" });
      }

      // Get the move to check if it's within range
      const allMoves = await storage.getAllHistoricalDailyMoves();
      const move = allMoves.find(m => m.id === req.params.id);
      
      if (!move) {
        return res.status(404).json({ error: "Historical move not found" });
      }

      // Check if actualClose is within expected range
      const withinRange = actualClose >= move.expectedLow && actualClose <= move.expectedHigh ? 1 : 0;

      const result = await storage.updateHistoricalDailyMoves(req.params.id, {
        actualClose,
        withinRange,
      });

      res.json(result);
    } catch (error) {
      res.status(500).json({ error: "Failed to update actual close" });
    }
  });

  // Sync all contracts with Yahoo Finance data
  app.post("/api/sync-yahoo-finance", async (req, res) => {
    try {
      const quotes = await getAllLastTradedPrices();
      const updatedContracts = [];

      for (const quote of quotes) {
        const contract = await storage.getContractBySymbol(quote.symbol);
        if (!contract) {
          console.error(`Contract not found: ${quote.symbol}`);
          continue;
        }

        const updated = await storage.updateContract(quote.symbol, {
          currentPrice: quote.regularMarketPrice,
          previousClose: quote.regularMarketPreviousClose,
          dailyChange: quote.regularMarketChange,
          dailyChangePercent: quote.regularMarketChangePercent,
        });

        if (updated) {
          updatedContracts.push(updated);
        }
      }

      res.status(200).json({
        message: `Synced ${updatedContracts.length} contracts with Yahoo Finance`,
        data: updatedContracts,
      });
    } catch (error) {
      console.error("Error syncing Yahoo Finance data:", error);
      res.status(500).json({ error: "Failed to sync Yahoo Finance data" });
    }
  });

  // Manual trigger for nightly calculation (for testing)
  app.post("/api/run-nightly-calculation", async (req, res) => {
    try {
      const results = await runNightlyCalculation();
      res.status(200).json({
        message: "Nightly calculation completed successfully",
        data: results,
      });
    } catch (error) {
      console.error("Error running nightly calculation:", error);
      res.status(500).json({ error: "Failed to run nightly calculation" });
    }
  });

  const httpServer = createServer(app);
  
  // Setup WebSocket market simulator for live data
  setupMarketSimulator(httpServer);
  
  return httpServer;
}
