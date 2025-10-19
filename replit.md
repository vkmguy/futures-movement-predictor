# Futures Movement Predictor

## Overview
A professional web-based application designed for predicting daily price movements of futures contracts (/NQ, /ES, /YM) based on weekly volatility analysis, latest prices, and open interest data. Its purpose is to provide traders and analysts with data-driven predictions for Nasdaq 100 (/NQ), S&P 500 (/ES), and Dow Jones (/YM) futures contracts using statistical volatility models. The project is a fully functional MVP with core features like a dashboard, analytics, and predictions pages.

## User Preferences
I prefer detailed explanations and iterative development. Ask before making major changes. I prefer that you do not make changes to the folder `Z` or the file `Y`.

## System Architecture

### UI/UX Decisions
-   **Theme**: Dark mode default with professional financial design system.
-   **Typography**: Inter for UI elements, JetBrains Mono for prices and data.
-   **Layout**: Sidebar navigation, responsive grid system, and a professional card-based design.
-   **Colors**: Primary (green/bullish), Destructive (red/bearish), and specific chart colors for data visualization.
-   **Interactions**: Hover elevations, smooth transitions, and loading skeletons.
-   **Navigation**: Sidebar with market overview and page links.

### Technical Implementations
-   **Data Model**: Includes `FuturesContract` (prices, changes, volume, open interest, volatility), `HistoricalPrice` (OHLC data), `DailyPrediction` (min/max, confidence, trend), `HistoricalDailyExpectedMoves`, `WeeklyExpectedMoves` (with database persistence), `DailyIvHistory` (tactical IV tracking with timestamps), and `PriceAlert`.
-   **Dual-IV Tracking System** (October 2025):
    - **Daily IV (Tactical)**: Manually updated implied volatility stored in `daily_iv_history` table with date-based tracking and timestamps. Users update these values from real-time broker data for precise intraday trading decisions. Persists across nightly calculations and never gets reset.
    - **Weekly IV (Strategic)**: Manually updateable implied volatility stored in `weekly_iv_overrides` table with full historical tracking. Provides flexible strategic IV updates at any time (not just on Saturday). Can be updated independently from daily IV.
    - **Separation**: Daily predictions use latest daily IV (with weekly fallback), weekly tracker displays manual weekly IV when available. Nightly scheduler consumes but never modifies manual IV updates.
    - **IV Source Transparency** (October 2025): Complete transparency across all pages showing which IV values are driving predictions:
      - **Dashboard**: VolatilityCard displays "Manual Daily IV" badge with timestamp when daily IV exists, "Manual" badge with timestamp for weekly IV. PredictionCard shows "Daily IV" badge when using manual daily IV for calculations.
      - **Predictions Page**: Shows Daily IV (Tactical) with manual badge and timestamp, Weekly IV (Strategic) with manual badge and timestamp, clearly indicating which IV source is active for each prediction.
      - **Weekly Tracker**: Displays "Manual" badge with timestamp next to IV value when manual weekly IV override exists, providing full provenance for weekly predictions.
      - **Type Safety**: All pages use centralized `DailyIvHistory` and `WeeklyIvOverride` types from `@shared/schema`, eliminating interface duplication and ensuring type consistency.
      - **Timestamp Format**: Relative time display (e.g., "Updated 2h ago" or "Updated 1d ago") with clock icon for quick reference.
-   **Prediction Models** (October 2025 - NEW ANNUALIZED METHODOLOGY):
    1.  **Daily Predictions (Annualized Dynamic Model)**: 
        - **Formula**: `Expected Move = Current Price × Annualized IV × √(Days to Expiration / 365)`
        - **Time Decay**: Properly adjusts volatility based on remaining trading days using annualized conversion
        - **Example**: For /NQ at $24,986.50 with 2.85% IV and 43 days to expiration:
          - Daily Volatility = 2.85% × √(43/365) = 0.9782%
          - Expected Daily Move = $24,986.50 × 0.009782 = $244.42
        - **Source**: Uses manual daily IV (tactical) if available, otherwise falls back to weekly IV
        - **Dynamic**: Recalculates nightly as days to expiration decreases
    2.  **Weekly Expected Moves (Annualized Strategic Model)**: 
        - **Formula**: `Weekly Move = Last Price × Annualized IV × √(5 / 365)` ≈ Last Price × IV × 0.117
        - **Strategic Predictions**: Forward-looking predictions for the UPCOMING week (next Monday-Friday)
        - **Generation Timing**: Only generated on Saturday after the trading week closes
        - **Data Source**: Uses Friday's closing IV and price data to forecast next week's movements
        - **Example**: For /NQ at $24,986.50 with 2.85% IV:
          - Weekly Move = $24,986.50 × 0.0285 × √(5/365) = $83.35
        - **Persistence**: Fully database-backed with automatic deduplication (one record per contract per week)
        - **Stability**: Locked once generated - doesn't change during the week (unlike dynamic daily predictions)
        - **Week Start Date**: Always stores next Monday as the week_start reference date
        - **Dynamic Display**: Shows only remaining days in the current week (Mon-Fri → Tue-Fri → Wed-Fri as week progresses)
    3.  **Advanced Volatility Models**: Supports user-selectable **Standard Model** (default, direct conversion), **GARCH(1,1)** (time-weighted, adapts to recent volatility clusters), and **EWMA** (recent prices weighted more heavily) models. All apply annualized √(Days/365) expiration-based scaling for daily predictions.
-   **Expiration Calendar System**: Dynamically calculates trading days remaining until expiration, excluding weekends and US market holidays, based on specific rules for Equity Index, Gold, and Crude Oil futures.
-   **Nightly Scheduler**: 
    - **Daily Calculations**: Runs after market close (5:30 PM ET) to sync Yahoo Finance prices, update contract data, and calculate daily expected moves using latest daily IV (if available) or weekly volatility (fallback), storing historical data in PostgreSQL. Does NOT modify or overwrite manual daily IV updates.
    - **Weekly Generation**: Runs on Saturday to generate forward-looking weekly predictions for the upcoming week using Friday's closing data, capturing and locking IV for strategic tracking
-   **Live Market Data**: WebSocket-based real-time price updates with a market simulator, including market hours detection and a WebSocket connection control toggle.
-   **Data Export System**: CSV/JSON export functionality for contracts, predictions, and historical data.
-   **Backtesting Module**: Tracks accuracy with historical comparison and performance metrics.
-   **Price Alerts**: Allows users to create and manage alerts for price targets and movement thresholds.

### System Design Choices
-   **Backend**: Express.js, Node.js, TypeScript.
-   **Frontend**: React, Wouter (routing), TanStack Query, Tailwind CSS, Shadcn UI.
-   **Storage**: PostgreSQL database with Drizzle ORM for persistent storage. **Weekly Expected Moves** are fully database-backed with automatic deduplication (one record per contract per week). **Daily IV History** is stored in dedicated table with date-based upsert logic, preserving all manual updates with timestamps.
-   **API Routes**: RESTful endpoints for contracts, predictions, historical data, weekly moves, and daily IV tracking (GET, POST, PATCH, DELETE). Daily IV endpoints properly handle URL-encoded symbols (e.g., "/NQ" → "%2FNQ").
-   **Database Drivers**: Environment-aware database connection system that automatically selects the appropriate PostgreSQL driver:
    -   **Replit/Neon Environment**: Uses `@neondatabase/serverless` with WebSocket-based connections for Neon cloud database
    -   **Local Docker Environment**: Uses standard `postgres` package with TCP connections for local PostgreSQL containers
    -   **Auto-detection**: Checks DATABASE_URL for "neon.tech" or "neon.database" to determine which driver to use
-   **Deployment**: Docker containerization for production, supporting a multi-stage Dockerfile and a 4-service `docker-compose` stack (`web`, `scheduler`, `postgres`, `migrations`) for isolated, secure, and scalable deployment.

## External Dependencies
-   **Market Data**: Yahoo Finance 2 (for free daily closing prices).
-   **Charting**: Recharts (for financial data visualization).
-   **Validation**: Zod (for schema validation with Drizzle integration).