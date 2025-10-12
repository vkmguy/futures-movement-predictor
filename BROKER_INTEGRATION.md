# Broker Integration Guide

## Current Data Status

### Real Market Data Integration ✅
The application uses **Yahoo Finance** for all futures contract pricing:
- **Data Source**: Yahoo Finance API via yahoo-finance2 package (FREE)
- **Price Updates**: 
  - Automatic: Nightly scheduler runs after market close (5:30 PM ET)
  - Manual: Refresh button on dashboard for immediate updates
  - On-demand: User-triggered sync from Historical Dashboard
- **WebSocket**: Simulates real-time price movements for visualization (not connected to live feeds)
- **All 6 Contracts Supported**: /NQ, /ES, /YM, /RTY, /GC, /CL

### Current Contract Data Sources

| Symbol | Contract | Yahoo Symbol | Data Source | Update Frequency |
|--------|----------|--------------|-------------|------------------|
| /NQ | E-mini Nasdaq-100 | NQ=F | **Yahoo Finance** | Nightly + On-demand |
| /ES | E-mini S&P 500 | ES=F | **Yahoo Finance** | Nightly + On-demand |
| /YM | E-mini Dow Jones | YM=F | **Yahoo Finance** | Nightly + On-demand |
| /RTY | E-mini Russell 2000 | RTY=F | **Yahoo Finance** | Nightly + On-demand |
| /GC | Gold Futures | GC=F | **Yahoo Finance** | Nightly + On-demand |
| /CL | Crude Oil Futures | CL=F | **Yahoo Finance** | Nightly + On-demand |

**Note**: Yahoo Finance provides delayed quotes (15-20 minutes). Prices may differ from real-time feeds due to:
- Quote delays (15-20 min behind market)
- Different contract months (Dec 2025 vs front month)
- Bid/Ask vs Last traded price

---

## Broker API Options for Real Market Data

### ✅ Recommended Brokers for Futures Data

#### 1. **Tradovate** (Best for Futures)
- **Pros**:
  - Dedicated futures trading platform
  - Excellent WebSocket API for real-time data
  - Commission-free data with funded account
  - Modern REST + WebSocket API
- **Cons**:
  - Requires funded trading account for live data
  - Market data fees apply without account
- **API Documentation**: https://api.tradovate.com/
- **Data Feeds**: Real-time Level 1 quotes, order book, historical data
- **Cost**: Free with funded account, otherwise $85/month for CME data

#### 2. **Interactive Brokers (IBKR)**
- **Pros**:
  - Access to global futures markets
  - Professional-grade data feeds
  - TWS API and Client Portal API
- **Cons**:
  - Complex API setup
  - Requires account with minimum balance
  - Market data subscriptions required
- **API Documentation**: https://www.interactivebrokers.com/api/
- **Data Feeds**: Real-time, historical, depth of market
- **Cost**: $1-10/month per exchange (CME, NYMEX, COMEX)

#### 3. **TradeStation**
- **Pros**:
  - Advanced charting and analysis tools
  - WebSocket and REST APIs
  - Futures and options support
- **Cons**:
  - Requires funded account
  - API access limited to certain account types
- **API Documentation**: https://api.tradestation.com/
- **Data Feeds**: Real-time quotes, historical bars
- **Cost**: Free with funded account ($2,000+ balance)

#### 4. **TD Ameritrade / Thinkorswim**
- **Pros**:
  - Free delayed quotes
  - Good documentation
  - No minimum balance for API access
- **Cons**:
  - Real-time futures data requires subscriptions
  - Being merged with Schwab (API changes expected)
- **API Documentation**: https://developer.tdameritrade.com/
- **Data Feeds**: Delayed (20 min) or real-time with subscription
- **Cost**: Free for delayed, $2-5/month for real-time per exchange

---

### 🔧 Free/Low-Cost Market Data Alternatives

#### 1. **Polygon.io**
- Real-time and historical market data API
- Futures support (limited)
- **Cost**: $199/month for futures data
- **URL**: https://polygon.io/

#### 2. **Alpha Vantage**
- Free API with limited futures support
- Good for indices, limited for direct futures
- **Cost**: Free tier available
- **URL**: https://www.alphavantage.co/

#### 3. **Yahoo Finance API (Unofficial)**
- Free delayed quotes
- Limited futures coverage
- No official API (use at own risk)
- **Libraries**: yfinance (Python), yahoo-finance2 (Node.js)

---

## Integration Implementation Guide

### Step 1: Choose Your Data Provider
Based on your needs:
- **Professional trading**: Tradovate or Interactive Brokers
- **Development/testing**: TD Ameritrade (delayed) or Polygon.io
- **Budget-constrained**: Yahoo Finance (unofficial, delayed)

### Step 2: Update Environment Variables
Add broker API credentials to `.env`:

```bash
# Example for Tradovate
TRADOVATE_API_KEY=your_api_key
TRADOVATE_API_SECRET=your_api_secret
TRADOVATE_USERNAME=your_username
TRADOVATE_PASSWORD=your_password

# Example for Interactive Brokers
IBKR_CLIENT_ID=your_client_id
IBKR_HOST=localhost
IBKR_PORT=7497
```

### Step 3: Install Broker SDK
```bash
# For Tradovate
npm install tradovate-client

# For Interactive Brokers
npm install @ib-api/ibapi

# For TD Ameritrade
npm install @tdameritrade/client

# For Polygon.io
npm install @polygon.io/client-js
```

### Step 4: Create Broker Service (`server/broker-service.ts`)

```typescript
// Example: Tradovate Integration
import { TradovateClient } from 'tradovate-client';

export class BrokerService {
  private client: TradovateClient;

  async connect() {
    this.client = new TradovateClient({
      apiKey: process.env.TRADOVATE_API_KEY,
      apiSecret: process.env.TRADOVATE_API_SECRET,
      environment: 'live', // or 'demo'
    });
    
    await this.client.authenticate();
  }

  async getContractPrice(symbol: string) {
    const quote = await this.client.getQuote(symbol);
    return {
      symbol,
      price: quote.last,
      bid: quote.bid,
      ask: quote.ask,
      volume: quote.volume,
      timestamp: quote.timestamp,
    };
  }

  subscribeToMarketData(symbol: string, callback: (data: any) => void) {
    this.client.subscribeQuotes([symbol], (quote) => {
      callback({
        symbol: quote.symbol,
        price: quote.last,
        change: quote.change,
        changePercent: quote.changePercent,
        volume: quote.volume,
        timestamp: new Date().toISOString(),
      });
    });
  }
}
```

### Step 5: Update WebSocket Server (`server/market-simulator.ts`)

Replace the simulator with real broker data:

```typescript
import { BrokerService } from './broker-service';

export async function setupMarketData(httpServer: Server) {
  const wss = new WebSocketServer({ 
    server: httpServer,
    path: '/ws/market'
  });
  
  const broker = new BrokerService();
  await broker.connect();

  wss.on('connection', (ws) => {
    // Subscribe to all contracts
    const contracts = ['/NQ', '/ES', '/YM', '/RTY', '/GC', '/CL'];
    
    contracts.forEach(symbol => {
      broker.subscribeToMarketData(symbol, (update) => {
        // Broadcast to all connected clients
        wss.clients.forEach((client) => {
          if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify(update));
          }
        });
      });
    });
  });

  return wss;
}
```

### Step 6: Update Storage for Initial Prices

Fetch real prices on startup:

```typescript
// In server/storage.ts initialization
async initializeWithRealPrices() {
  const broker = new BrokerService();
  await broker.connect();
  
  for (const contract of mockContracts) {
    const realPrice = await broker.getContractPrice(contract.symbol);
    contract.currentPrice = realPrice.price;
    contract.volume = realPrice.volume;
    // ... update other fields
  }
}
```

---

## Price Data Considerations

### Understanding Futures Contract Pricing

1. **Contract Months**: Futures have different prices for different expiration months
   - December 2025: `/ESZ25` (most active)
   - Continuous: `/ES1!` (front month)

2. **Quote Types**:
   - **Last**: Last traded price
   - **Bid/Ask**: Current market prices
   - **Settlement**: Official end-of-day price

3. **Data Timing**:
   - **Real-time**: Instantaneous updates (requires subscription)
   - **Delayed**: 15-20 minute delay (often free)
   - **End-of-Day**: Settlement prices (free from CME)

### Why Prices May Differ

Your observed prices vs expected:
- ✅ **Contract month mismatch**: Dec 2025 vs Mar 2026
- ✅ **Quote type**: Bid vs Ask vs Last
- ✅ **Data source**: Different providers, different timestamps
- ✅ **Market hours**: Pre-market, regular, or post-market

---

## Next Steps

### For Production Deployment:

1. **Create Replit Secret** for broker credentials
   ```bash
   # In Replit Secrets (left sidebar)
   TRADOVATE_API_KEY=your_key
   TRADOVATE_API_SECRET=your_secret
   ```

2. **Implement error handling** for broker disconnections

3. **Add data validation** to ensure price sanity

4. **Set up monitoring** for API rate limits and costs

5. **Consider caching** to reduce API calls

### For Development/Testing:

1. **Use demo/paper accounts** from brokers
2. **Implement mock mode** (current setup) with toggle
3. **Add data refresh button** for manual updates
4. **Test with delayed data** before paying for real-time

---

## Troubleshooting

### Common Issues:

**❌ Problem**: Prices don't match expectations
- **Solution**: Verify contract month, quote type, and data source

**❌ Problem**: WebSocket disconnects frequently
- **Solution**: Implement reconnection logic, check API rate limits

**❌ Problem**: High API costs
- **Solution**: Use delayed data, cache aggressively, or switch providers

**❌ Problem**: Inaccurate volatility calculations
- **Solution**: Ensure using actual historical data, not simulated

---

## Cost Summary

| Provider | Setup | Monthly Cost | Real-time | Recommended For |
|----------|-------|--------------|-----------|-----------------|
| **Tradovate** | Funded account | $0-85 | ✅ Yes | Professional traders |
| **IBKR** | Funded account | $1-10 | ✅ Yes | Multi-asset trading |
| **TradeStation** | $2,000 balance | $0 | ✅ Yes | Active traders |
| **TD Ameritrade** | Free | $0-5 | ⚠️ Optional | Retail investors |
| **Polygon.io** | Credit card | $199 | ✅ Yes | Developers |
| **Yahoo Finance** | None | $0 | ❌ No | Hobbyists |

---

## Conclusion

**Current Status**: Using mock data with manually updated October 10, 2025 closing prices

**Recommendation**: 
1. For **testing**: Continue with mock data + manual updates
2. For **production**: Integrate Tradovate (best futures support) or IBKR (professional grade)
3. For **budget**: Use TD Ameritrade delayed quotes or unofficial Yahoo Finance

**Next Action**: 
- ✅ WebSocket toggle added for network savings
- ⏳ Choose broker based on budget and requirements
- ⏳ Implement broker service integration (see Step 4-6 above)
