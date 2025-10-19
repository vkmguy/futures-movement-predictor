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
-   **Data Model**: Includes `FuturesContract` (prices, changes, volume, open interest, volatility), `HistoricalPrice` (OHLC data), `DailyPrediction` (min/max, confidence, trend), `HistoricalDailyExpectedMoves`, `WeeklyExpectedMoves` (with database persistence), and `PriceAlert`.
-   **Prediction Models**:
    1.  **Daily Predictions (Dynamic √N Model)**: Uses `σ_daily = σ_weekly / √N` where N is trading days remaining until expiration. This model is applied for short-term trading decisions and is dynamic, changing daily based on contract-specific expiration rules for equity indices and commodities.
    2.  **Weekly Expected Moves (Forward-Looking Strategic Model)**: 
        - **Strategic Predictions**: Forward-looking predictions for the UPCOMING week (next Monday-Friday)
        - **Generation Timing**: Only generated on Saturday after the trading week closes
        - **Data Source**: Uses Friday's closing IV and price data to forecast next week's movements
        - **Calculation**: Uses `σ_daily = σ_weekly / √5` for standardized weekly tracking
        - **Persistence**: Fully database-backed with automatic deduplication (one record per contract per week)
        - **Stability**: Locked once generated - doesn't change during the week (unlike dynamic daily predictions)
        - **Week Start Date**: Always stores next Monday as the week_start reference date
    3.  **Advanced Volatility Models**: Supports user-selectable **Standard Model** (default, direct conversion), **GARCH(1,1)** (time-weighted, adapts to recent volatility clusters), and **EWMA** (recent prices weighted more heavily) models. All apply dynamic √N expiration-based scaling for daily predictions.
-   **Expiration Calendar System**: Dynamically calculates trading days remaining until expiration, excluding weekends and US market holidays, based on specific rules for Equity Index, Gold, and Crude Oil futures.
-   **Nightly Scheduler**: 
    - **Daily Calculations**: Runs after market close (5:30 PM ET) to sync Yahoo Finance prices, update contract data, and calculate daily expected moves, storing historical data in PostgreSQL
    - **Weekly Generation**: Runs on Saturday to generate forward-looking weekly predictions for the upcoming week using Friday's closing data
-   **Live Market Data**: WebSocket-based real-time price updates with a market simulator, including market hours detection and a WebSocket connection control toggle.
-   **Data Export System**: CSV/JSON export functionality for contracts, predictions, and historical data.
-   **Backtesting Module**: Tracks accuracy with historical comparison and performance metrics.
-   **Price Alerts**: Allows users to create and manage alerts for price targets and movement thresholds.

### System Design Choices
-   **Backend**: Express.js, Node.js, TypeScript.
-   **Frontend**: React, Wouter (routing), TanStack Query, Tailwind CSS, Shadcn UI.
-   **Storage**: PostgreSQL database with Drizzle ORM for persistent storage. **Weekly Expected Moves** are now fully database-backed with automatic deduplication (one record per contract per week) and user-controlled deletion.
-   **API Routes**: RESTful endpoints for contracts, predictions, historical data, and weekly moves (GET, POST, PATCH, DELETE).
-   **Database Drivers**: Environment-aware database connection system that automatically selects the appropriate PostgreSQL driver:
    -   **Replit/Neon Environment**: Uses `@neondatabase/serverless` with WebSocket-based connections for Neon cloud database
    -   **Local Docker Environment**: Uses standard `postgres` package with TCP connections for local PostgreSQL containers
    -   **Auto-detection**: Checks DATABASE_URL for "neon.tech" or "neon.database" to determine which driver to use
-   **Deployment**: Docker containerization for production, supporting a multi-stage Dockerfile and a 4-service `docker-compose` stack (`web`, `scheduler`, `postgres`, `migrations`) for isolated, secure, and scalable deployment.

## External Dependencies
-   **Market Data**: Yahoo Finance 2 (for free daily closing prices).
-   **Charting**: Recharts (for financial data visualization).
-   **Validation**: Zod (for schema validation with Drizzle integration).