# Futures Movement Predictor

A professional web-based application for predicting daily price movements of futures contracts using dynamic volatility analysis.

## Overview

This application predicts daily price movements for major futures contracts (/NQ, /ES, /YM, /RTY, /GC, /CL) based on weekly volatility analysis, latest prices, and open interest data. It provides traders and analysts with data-driven predictions using statistical volatility models.

## Features

- **Real-time Market Data**: Integration with Yahoo Finance for live price updates
- **Dynamic Volatility Models**: 
  - Daily Predictions: σ_daily = σ_weekly / √N (N = days to expiration)
  - Weekly Tracker: σ_daily = σ_weekly / √5 (standardized)
  - Advanced Models: GARCH(1,1) and EWMA support
- **Automated Nightly Calculations**: Scheduled updates after market close (5:30 PM ET)
- **Interactive Dashboard**: Real-time price tracking with WebSocket updates
- **Analytics & Backtesting**: Historical tracking and performance metrics
- **Price Alerts**: Customizable alerts for price targets and thresholds
- **Data Export**: CSV/JSON export functionality

## Supported Contracts

- **/NQ** - E-mini Nasdaq-100
- **/ES** - E-mini S&P 500
- **/YM** - E-mini Dow Jones
- **/RTY** - E-mini Russell 2000
- **/GC** - Gold Futures
- **/CL** - Crude Oil Futures

## Tech Stack

### Frontend
- React with TypeScript
- Tailwind CSS + Shadcn UI
- TanStack Query for state management
- Recharts for data visualization
- Wouter for routing

### Backend
- Node.js + Express
- TypeScript
- PostgreSQL with Drizzle ORM
- WebSocket for real-time updates
- Yahoo Finance 2 API

### Deployment
- Docker containerization
- Multi-service architecture (web, scheduler, database, migrations)
- Production-ready with health checks

## Getting Started

### Prerequisites
- Node.js 18+
- PostgreSQL database
- Docker (for containerized deployment)

### Installation

1. Clone the repository:
```bash
git clone https://github.com/vkmguy/futures-movement-predictor.git
cd futures-movement-predictor
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
```bash
cp .env.example .env
# Edit .env with your database credentials
```

4. Run database migrations:
```bash
npm run db:push
```

5. Start the development server:
```bash
npm run dev
```

The application will be available at `http://localhost:5000`

## Docker Deployment

### Build and run with Docker Compose:

```bash
docker-compose up -d
```

This starts:
- Web application (port 5000)
- Automated scheduler
- PostgreSQL database
- Database migrations

## Project Structure

```
├── client/               # React frontend
│   ├── src/
│   │   ├── components/  # Reusable UI components
│   │   ├── pages/       # Application pages
│   │   └── lib/         # Utilities and hooks
├── server/              # Express backend
│   ├── routes.ts        # API endpoints
│   ├── storage.ts       # Database interface
│   ├── expiration-calendar.ts  # Contract expiration logic
│   └── volatility-models.ts    # Prediction models
├── shared/              # Shared types and schemas
├── scripts/             # Utility scripts
├── Dockerfile           # Container configuration
└── docker-compose.yml   # Multi-service orchestration
```

## API Endpoints

- `GET /api/contracts` - Get all futures contracts
- `GET /api/predictions/:symbol` - Get predictions for a contract
- `GET /api/historical/:symbol` - Get historical data
- `GET /api/market/status` - Get market status
- `POST /api/refresh` - Manual data refresh
- `POST /api/alerts` - Create price alert
- `GET /api/export/csv` - Export data as CSV
- `GET /api/export/json` - Export data as JSON

## Prediction Models

### Daily Predictions (Dynamic √N Model)
Uses `σ_daily = σ_weekly / √N` where N is trading days remaining until expiration. Applied for short-term trading decisions.

### Weekly Expected Moves (Standard √5 Model)
Uses `σ_daily = σ_weekly / √5` for standardized weekly tracking with progressive daily ranges.

### Advanced Models
- **Standard Model**: Direct conversion (default)
- **GARCH(1,1)**: Time-weighted, adapts to volatility clusters
- **EWMA**: Exponential weighting for recent prices

## Expiration Calendar

Dynamically calculates trading days to expiration based on:
- **Equity Index Futures** (/NQ, /ES, /YM, /RTY): Third Friday of contract month
- **Gold Futures** (/GC): Third-to-last business day of contract month
- **Crude Oil** (/CL): Third business day before 25th of prior month

Excludes weekends and US market holidays.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT License - see LICENSE file for details

## Author

Built with ❤️ by the Replit community

## Acknowledgments

- Market data provided by Yahoo Finance
- Built on Replit platform
- UI components from Shadcn
