# Futures Price Movement Predictor

## Overview

A professional web-based futures trading analytics platform that provides daily price movement predictions for major futures contracts (/NQ, /ES, /YM). The application calculates expected daily price ranges based on weekly volatility analysis and open interest data, designed with a focus on data clarity and rapid information scanning for traders.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture

**Framework & Build System:**
- React 18 with TypeScript for type safety and component-based UI
- Vite as the build tool and development server for fast HMR and optimized production builds
- Wouter for lightweight client-side routing (Dashboard, Analytics, Predictions pages)

**UI Component System:**
- shadcn/ui component library built on Radix UI primitives for accessible, customizable components
- Tailwind CSS for utility-first styling with custom design tokens
- CVA (class-variance-authority) for type-safe component variants
- Dark mode by default with light mode support via ThemeProvider context

**Design System:**
- Professional trading platform aesthetic inspired by TradingView and Bloomberg Terminal
- Custom color palette optimized for financial data visualization (bullish green, bearish red)
- Typography: Inter for UI, JetBrains Mono for numerical data and prices
- Responsive layout with mobile-first considerations

**State Management:**
- TanStack Query (React Query) for server state management, caching, and automatic refetching
- React Context for theme state
- Local component state for UI interactions

**Data Visualization:**
- Recharts library for price charts and volatility visualizations
- Custom chart components with themed styling for consistent appearance

### Backend Architecture

**Server Framework:**
- Express.js with TypeScript running on Node.js
- RESTful API design pattern for all data endpoints

**API Structure:**
- `/api/contracts` - Futures contract CRUD operations
- `/api/contracts/:symbol` - Individual contract data
- `/api/historical/:symbol` - Historical price data
- `/api/predictions` - Daily price movement predictions
- `/api/predictions/:symbol` - Symbol-specific predictions

**Data Layer:**
- Storage abstraction interface (IStorage) allows for pluggable storage implementations
- Current implementation uses in-memory storage (MemStorage) with mock data
- Designed to support database integration (Drizzle ORM schema defined for PostgreSQL)

**Business Logic:**
- Volatility calculation: Daily volatility derived from weekly using σ_daily = σ_weekly / √5
- Price movement prediction based on current price × daily volatility
- Open interest trend analysis for market sentiment indicators

**Validation:**
- Zod schemas for runtime type validation
- Drizzle-zod integration for database schema validation
- Input validation on all API endpoints

### Database Schema (Designed for PostgreSQL)

**Tables:**

1. **futures_contracts** - Core contract information
   - Current and previous prices with daily change tracking
   - Volume and open interest metrics
   - Weekly and daily volatility calculations
   - Auto-updating timestamps

2. **historical_prices** - OHLC price data
   - Date-indexed price records
   - Volume data for each period
   - Linked to contracts via symbol

3. **daily_predictions** - Generated movement predictions
   - Predicted min/max price ranges
   - Confidence levels and trend indicators (bullish/bearish/neutral)
   - Open interest change tracking
   - Timestamp for prediction generation

**Schema Management:**
- Drizzle ORM with Drizzle Kit for migrations
- Type-safe database queries with full TypeScript integration
- Schema validation using drizzle-zod

### Development Workflow

**Development Server:**
- Vite middleware mode integrated with Express for unified development experience
- Hot module replacement for instant client-side updates
- Automatic server restart on backend changes (via tsx watch mode)

**Build Process:**
- Client: Vite bundles React app to `dist/public`
- Server: esbuild bundles Express app to `dist` with ESM output
- Static asset serving in production via Express

**Type Safety:**
- Shared TypeScript types between client and server via `@shared` alias
- Path aliases configured for clean imports (@/, @shared/, @assets/)
- Strict TypeScript configuration with no-emit for type checking

## External Dependencies

**Core Libraries:**
- **@neondatabase/serverless** - Neon PostgreSQL serverless driver for database connectivity
- **drizzle-orm** - Type-safe ORM for database operations
- **drizzle-kit** - Database migrations and schema management

**UI Framework:**
- **@radix-ui/** - Comprehensive suite of unstyled, accessible UI primitives (30+ components)
- **tailwindcss** - Utility-first CSS framework
- **lucide-react** - Icon library for UI elements

**Data & Forms:**
- **@tanstack/react-query** - Server state management and caching
- **react-hook-form** - Performant form handling
- **@hookform/resolvers** - Validation resolver integration
- **zod** - Runtime type validation and schema definition

**Visualization:**
- **recharts** - Composable charting library built on D3
- **embla-carousel-react** - Carousel/slider functionality

**Developer Experience:**
- **vite** - Next-generation frontend build tool
- **tsx** - TypeScript execution engine for Node.js
- **esbuild** - Fast JavaScript bundler for production builds
- **@replit/** plugins - Replit-specific development tooling (error overlay, cartographer, dev banner)

**Utilities:**
- **date-fns** - Modern date utility library
- **clsx** & **tailwind-merge** - Conditional className utilities
- **nanoid** - Unique ID generation
- **cmdk** - Command menu component

**Future Integration Ready:**
- Market data APIs (designed for Tradovate, TradeStation, or similar futures data providers)
- WebSocket connections for real-time price updates
- User authentication system (session management infrastructure present with connect-pg-simple)