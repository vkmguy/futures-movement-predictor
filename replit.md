# Futures Movement Predictor

## Overview
A professional web-based application for predicting daily price movements of futures contracts (/NQ, /ES, /YM) based on weekly volatility analysis, latest prices, and open interest data.

## Purpose
Provides traders and analysts with data-driven predictions for Nasdaq 100 (/NQ), S&P 500 (/ES), and Dow Jones (/YM) futures contracts using statistical volatility models.

## Current State
✅ **Fully Functional MVP** - All core features implemented and tested
- Dashboard with real-time contract data and predictions
- Analytics page with volatility comparison and performance charts
- Predictions page with detailed movement forecasts
- Dark/light theme support
- Professional trading platform UI following design guidelines

## Project Architecture

### Data Model (`shared/schema.ts`)
- **FuturesContract**: Current prices, daily changes, volume, open interest, volatility metrics
- **HistoricalPrice**: OHLC data for price history charts
- **DailyPrediction**: Expected min/max ranges, confidence levels, trend indicators

### Backend (`server/`)
- **Storage**: In-memory database with mock futures data for /NQ, /ES, /YM
- **API Routes**: RESTful endpoints for contracts, predictions, and historical data
- **Volatility Engine**: Implements σ_daily = σ_weekly / √5 conversion formula

### Frontend (`client/src/`)
- **Pages**: Dashboard (`/`), Analytics (`/analytics`), Predictions (`/predictions`)
- **Components**: 
  - ContractCard: Live price display with changes and volume
  - VolatilityCard: Weekly/daily volatility analysis
  - PredictionCard: Expected price movement ranges
  - PriceChart: Historical data visualization with Recharts
- **Theme**: Dark mode default, professional financial design system
- **Navigation**: Sidebar with market overview and page links

## Recent Changes (October 11, 2025)
### Core Platform (Initial Implementation)
- Complete MVP with Dashboard, Analytics, Predictions pages
- Data models for contracts, prices, and predictions
- Backend API with volatility calculations (σ_daily = σ_weekly / √5)
- Sidebar navigation with market overview
- End-to-end testing of core features

### New Features (Latest Updates)
- **Data Export System**: CSV/JSON export for contracts, predictions, and historical data
- **Backtesting Module**: Accuracy tracking with historical comparison and performance metrics
- **Price Alerts**: Create/manage alerts for price targets and movement thresholds
- **Live Market Data**: WebSocket-based real-time price updates with market simulator
- **Advanced Volatility Models**: GARCH(1,1) and EWMA models with UI selector

## Key Features
1. **Real-time Contract Monitoring**: Live prices, daily changes, volume, and open interest
2. **Volatility Analysis**: Automatic conversion from weekly to daily volatility
3. **Daily Movement Predictions**: Expected min/max price ranges with confidence levels
4. **Historical Charts**: Interactive price history visualization
5. **Analytics Dashboard**: Market statistics and volatility comparisons
6. **Theme Support**: Dark/light mode with persistent preferences

## Technical Stack
- **Frontend**: React, Wouter (routing), TanStack Query, Tailwind CSS, Shadcn UI
- **Backend**: Express.js, Node.js, TypeScript
- **Charts**: Recharts for financial data visualization
- **Storage**: In-memory (MemStorage) - ready for PostgreSQL upgrade
- **Validation**: Zod schemas with Drizzle integration

## User Workflow
1. View dashboard with all three futures contracts (/NQ, /ES, /YM)
2. Filter by specific contract using selector dropdown
3. Analyze volatility metrics and daily predictions
4. Navigate to Analytics for market-wide statistics
5. Review detailed predictions with confidence levels and trends

## Design System
- **Colors**: Primary (green/bullish), Destructive (red/bearish), Chart colors for data viz
- **Typography**: Inter (UI), JetBrains Mono (prices/data)
- **Layout**: Sidebar navigation, responsive grid system, professional card-based design
- **Interactions**: Hover elevations, smooth transitions, loading skeletons

## Development Guidelines
- Follow `design_guidelines.md` for all UI implementations
- Use Shadcn components for consistency
- Maintain proper TypeScript typing from shared schema
- Keep API routes thin with storage layer handling logic
- Use TanStack Query for all data fetching with proper loading states

## Future Enhancements
- Live market data API integration (Tradovate, TradeStation)
- Backtesting module for prediction accuracy validation
- Automated alerts for significant predicted movements
- Export functionality for reports and analysis
- Advanced volatility models (GARCH, implied volatility)
- User authentication and personalized dashboards
