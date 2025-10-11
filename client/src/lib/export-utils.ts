import type { FuturesContract, DailyPrediction, HistoricalPrice } from "@shared/schema";

export function exportToCSV(data: any[], filename: string) {
  if (data.length === 0) return;

  const headers = Object.keys(data[0]);
  const csvContent = [
    headers.join(','),
    ...data.map(row => 
      headers.map(header => {
        const value = row[header];
        if (value instanceof Date) {
          return value.toISOString();
        }
        if (typeof value === 'string' && value.includes(',')) {
          return `"${value}"`;
        }
        return value;
      }).join(',')
    )
  ].join('\n');

  downloadFile(csvContent, filename, 'text/csv');
}

export function exportToJSON(data: any[], filename: string) {
  const jsonContent = JSON.stringify(data, null, 2);
  downloadFile(jsonContent, filename, 'application/json');
}

function downloadFile(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function prepareContractsForExport(contracts: FuturesContract[]) {
  return contracts.map(c => ({
    Symbol: c.symbol,
    Name: c.name,
    'Current Price': c.currentPrice,
    'Previous Close': c.previousClose,
    'Daily Change': c.dailyChange,
    'Daily Change %': c.dailyChangePercent,
    Volume: c.volume,
    'Open Interest': c.openInterest,
    'Weekly Volatility': c.weeklyVolatility,
    'Daily Volatility': c.dailyVolatility,
    'Updated At': new Date(c.updatedAt).toISOString(),
  }));
}

export function preparePredictionsForExport(predictions: DailyPrediction[]) {
  return predictions.map(p => ({
    Symbol: p.contractSymbol,
    Date: new Date(p.date).toISOString(),
    'Current Price': p.currentPrice,
    'Predicted Min': p.predictedMin,
    'Predicted Max': p.predictedMax,
    'Daily Volatility': p.dailyVolatility,
    'Weekly Volatility': p.weeklyVolatility,
    Confidence: p.confidence,
    'OI Change': p.openInterestChange,
    Trend: p.trend,
  }));
}

export function prepareHistoricalForExport(historical: HistoricalPrice[]) {
  return historical.map(h => ({
    Symbol: h.contractSymbol,
    Date: new Date(h.date).toISOString(),
    Open: h.open,
    High: h.high,
    Low: h.low,
    Close: h.close,
    Volume: h.volume,
  }));
}
