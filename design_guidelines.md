# Design Guidelines: Futures Price Movement Prediction Platform

## Design Approach
**Selected Approach:** Design System with Financial Application Patterns

Drawing inspiration from professional trading platforms (TradingView, Bloomberg Terminal) combined with modern fintech UX (Robinhood, Webull). Using a modified Material Design foundation optimized for data-heavy financial interfaces.

**Core Principles:**
- Data clarity over decoration
- Rapid information scanning
- Professional trust and credibility
- Efficient workflow optimization

## Color Palette

### Dark Mode (Primary)
- **Background:** 220 15% 8% (deep navy-black)
- **Surface:** 220 12% 12% (elevated panels)
- **Surface Elevated:** 220 10% 16% (cards, modals)
- **Border:** 220 8% 24% (subtle divisions)
- **Primary (Bullish):** 142 76% 36% (vibrant green)
- **Danger (Bearish):** 0 84% 60% (bold red)
- **Info:** 217 91% 60% (electric blue)
- **Text Primary:** 0 0% 95%
- **Text Secondary:** 220 8% 65%

### Light Mode (Secondary)
- **Background:** 0 0% 98%
- **Surface:** 0 0% 100%
- **Primary:** 142 71% 45%
- **Danger:** 0 72% 51%
- **Text:** 220 15% 15%

## Typography

**Font Stack:**
- **Primary:** 'Inter' (Google Fonts) - UI, navigation, labels
- **Data/Mono:** 'JetBrains Mono' (Google Fonts) - prices, numbers, tables

**Type Scale:**
- Display (Dashboard headers): text-3xl font-bold (30px)
- Heading: text-xl font-semibold (20px)
- Body: text-base font-medium (16px)
- Data/Prices: text-lg font-mono (18px)
- Caption: text-sm (14px)
- Micro (timestamps): text-xs (12px)

## Layout System

**Spacing Units:** Tailwind 2, 4, 6, 8, 12, 16
- Component padding: p-4 or p-6
- Section gaps: gap-6 or gap-8
- Card spacing: p-6
- Dense data tables: p-2

**Grid Structure:**
- Dashboard: 12-column grid system
- Sidebar: 240px fixed width
- Main content: flex-1 with max-w-7xl
- Charts: Full width of container minus padding
- Responsive breakpoints: md (768px), lg (1024px), xl (1280px)

## Component Library

### Navigation
- **Sidebar:** Fixed left navigation (240px) with contract selector (/NQ, /ES, /YM), main dashboard sections, settings
- **Top Bar:** User account, notifications, time/date display, quick filters

### Data Display
- **Price Cards:** Large numerical display with color-coded change indicators (green up/red down), mini sparkline charts inline
- **Data Tables:** Striped rows, sortable headers, monospace numbers right-aligned, hover states with 220 12% 18% background
- **Charts:** TradingView-inspired candlestick/line charts using Chart.js or Recharts, dark grid background 220 8% 10%, axis labels in text-secondary

### Forms & Inputs
- **Input Fields:** Dark surface (220 12% 14%), focus ring in primary color, rounded-lg borders
- **Selectors:** Dropdown menus for contract selection, date ranges with calendar picker
- **Filters:** Chip-based multi-select filters with clear affordances

### Cards & Containers
- **Primary Cards:** Surface elevated background, rounded-xl, subtle border, 6px padding
- **Stat Cards:** Compact design with large number display, label, percentage change indicator
- **Alert Cards:** Border-left accent (4px) in primary/danger colors for market alerts

### Interactive Elements
- **Buttons Primary:** bg-primary text-white, rounded-lg, hover brightness increase
- **Buttons Secondary:** border-2 with primary color, transparent background
- **Icon Buttons:** Circular or square with subtle hover state

## Key Interface Sections

### Dashboard Layout
1. **Header Bar** (h-16): Contract quick-switcher, real-time clock, user menu
2. **Sidebar** (240px): Navigation, contract list with live prices
3. **Main Grid** (3-column on xl, 2-column on lg, 1-column on md):
   - Price Summary Cards (current price, daily change, volume)
   - Volatility Indicator (weekly σ with daily conversion)
   - Open Interest Trends (chart + number)
4. **Chart Section** (full width): Interactive price chart with volume overlay
5. **Data Table** (full width): Predicted daily movements with confidence ranges

### Contract Cards
- Large price display (text-3xl font-mono)
- Color-coded percentage change
- Inline mini chart (sparkline)
- Last update timestamp
- Quick action buttons (analyze, alert)

### Movement Prediction Display
- Range visualization (horizontal bar showing min/max expected)
- Confidence percentage badge
- Supporting metrics grid (2x2: volatility, OI change, trend, volume)

## Animations & Interactions
**Minimal and purposeful only:**
- Number transitions: Smooth count-up/down for price updates
- Live data pulse: Subtle glow on cards receiving updates (500ms fade)
- Chart animations: Disabled for performance
- Hover states: 150ms ease transitions on opacity/background

## Images
**No hero images.** This is a data-focused application dashboard. All visual emphasis should be on charts, numbers, and data visualization. 

**Icon System:** Use Heroicons (outline variant) for navigation and actions, monochrome with currentColor for consistent theming.

## Data Visualization Standards
- **Candlestick charts:** Green/red bodies, thin wicks
- **Line charts:** Primary color stroke, gradient fill (10% opacity)
- **Area charts:** Smooth curves with subtle gradient
- **Grid lines:** 220 8% 18%, subtle and non-intrusive
- **Tooltips:** Dark surface with white text, rounded corners, drop shadow

## Mobile Responsiveness
- Collapsible sidebar → hamburger menu
- Stack grid to single column
- Horizontal scroll for wide data tables
- Simplified chart controls (touch-optimized)
- Bottom navigation bar for primary actions