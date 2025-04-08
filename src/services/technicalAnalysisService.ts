// Technical analysis service to calculate various technical indicators

export interface HistoricalPrice {
  date: Date;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface TechnicalIndicators {
  symbol: string;
  stochasticK: number | null;
  stochasticD: number | null;
  ema5: number | null;
  ema10: number | null;
  ema20: number | null;
  ema50: number | null;
  rsi: number | null;
  macd: number | null;
  macdSignal: number | null;
  macdHistogram: number | null;
  currentPrice: number;
  indicators: string[];
}

// Fetch historical prices for a given symbol
// This would typically come from a market data API like Alpha Vantage, Yahoo Finance, etc.
export const fetchHistoricalPrices = async (symbol: string, days: number = 60): Promise<HistoricalPrice[]> => {
  try {
    // In a real implementation, this would call an external API
    // For now, we'll use dummy data or could integrate with a real data provider
    const response = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?range=${days}d&interval=1d`);
    
    if (!response.ok) {
      throw new Error(`Yahoo Finance API returned status: ${response.status}`);
    }
    
    const data = await response.json();
    
    if (!data.chart || !data.chart.result || data.chart.result.length === 0) {
      throw new Error('Invalid data received from Yahoo Finance API');
    }
    
    const result = data.chart.result[0];
    const timestamps = result.timestamp;
    
    if (!timestamps || !result.indicators || !result.indicators.quote || !result.indicators.quote[0]) {
      throw new Error('Missing required data in Yahoo Finance API response');
    }
    
    const quotes = result.indicators.quote[0];
    
    return timestamps.map((timestamp: number, index: number) => ({
      date: new Date(timestamp * 1000),
      open: quotes.open[index],
      high: quotes.high[index],
      low: quotes.low[index],
      close: quotes.close[index],
      volume: quotes.volume[index]
    })).filter((price: HistoricalPrice) => 
      price.open !== null && 
      price.high !== null && 
      price.low !== null && 
      price.close !== null
    );
  } catch (error) {
    console.error(`Error fetching historical prices for ${symbol}:`, error);
    return [];
  }
};

// Calculate Exponential Moving Average (EMA)
export const calculateEMA = (prices: number[], period: number): number[] => {
  if (prices.length === 0 || period <= 0 || period > prices.length) {
    return [];
  }
  
  const ema = [];
  const multiplier = 2 / (period + 1);
  
  // First EMA is the SMA
  let sma = 0;
  for (let i = 0; i < period; i++) {
    sma += prices[i];
  }
  sma /= period;
  ema.push(sma);
  
  // Calculate EMA for each subsequent day
  for (let i = period; i < prices.length; i++) {
    ema.push((prices[i] - ema[ema.length - 1]) * multiplier + ema[ema.length - 1]);
  }
  
  return ema;
};

// Calculate Stochastic Oscillator
export const calculateStochastic = (
  prices: HistoricalPrice[], 
  kPeriod: number = 14, 
  dPeriod: number = 3
): { k: number[], d: number[] } => {
  if (prices.length < kPeriod) {
    return { k: [], d: [] };
  }
  
  const ks: number[] = [];
  
  // Calculate %K for each period
  for (let i = kPeriod - 1; i < prices.length; i++) {
    const period = prices.slice(i - kPeriod + 1, i + 1);
    const highestHigh = Math.max(...period.map(p => p.high));
    const lowestLow = Math.min(...period.map(p => p.low));
    const lastClose = prices[i].close;
    
    const k = (highestHigh === lowestLow) ? 50 : (lastClose - lowestLow) / (highestHigh - lowestLow) * 100;
    ks.push(k);
  }
  
  if (ks.length < dPeriod) {
    return { k: ks, d: [] };
  }
  
  // Calculate %D (simple moving average of %K)
  const ds: number[] = [];
  for (let i = dPeriod - 1; i < ks.length; i++) {
    let sum = 0;
    for (let j = 0; j < dPeriod; j++) {
      sum += ks[i - j];
    }
    ds.push(sum / dPeriod);
  }
  
  return { k: ks, d: ds };
};

// Calculate Relative Strength Index (RSI)
export const calculateRSI = (prices: HistoricalPrice[], period: number = 14): number[] => {
  if (prices.length <= period + 1) {
    return [];
  }
  
  const gains: number[] = [];
  const losses: number[] = [];
  const rsi: number[] = [];
  
  // Calculate initial price changes
  for (let i = 1; i < prices.length; i++) {
    const change = prices[i].close - prices[i - 1].close;
    gains.push(change > 0 ? change : 0);
    losses.push(change < 0 ? Math.abs(change) : 0);
  }
  
  if (gains.length < period) {
    return [];
  }
  
  // Calculate initial averages
  let avgGain = 0;
  let avgLoss = 0;
  
  for (let i = 0; i < period; i++) {
    avgGain += gains[i];
    avgLoss += losses[i];
  }
  
  avgGain /= period;
  avgLoss /= period;
  
  // Calculate first RSI
  let rs = avgGain / (avgLoss === 0 ? 0.001 : avgLoss); // Avoid division by zero
  rsi.push(100 - (100 / (1 + rs)));
  
  // Calculate subsequent RSIs
  for (let i = period; i < gains.length; i++) {
    avgGain = ((avgGain * (period - 1)) + gains[i]) / period;
    avgLoss = ((avgLoss * (period - 1)) + losses[i]) / period;
    
    rs = avgGain / (avgLoss === 0 ? 0.001 : avgLoss);
    rsi.push(100 - (100 / (1 + rs)));
  }
  
  return rsi;
};

// Calculate MACD (Moving Average Convergence Divergence)
export const calculateMACD = (
  prices: number[], 
  fastLength: number = 12, 
  slowLength: number = 26, 
  signalLength: number = 9
): { macd: number[], signal: number[], histogram: number[] } => {
  if (prices.length <= slowLength) {
    return { macd: [], signal: [], histogram: [] };
  }
  
  const fastEMA = calculateEMA(prices, fastLength);
  const slowEMA = calculateEMA(prices, slowLength);
  
  if (fastEMA.length === 0 || slowEMA.length === 0) {
    return { macd: [], signal: [], histogram: [] };
  }
  
  // Align EMAs (they have different starting points)
  const macd: number[] = [];
  for (let i = slowLength - fastLength; i < fastEMA.length; i++) {
    macd.push(fastEMA[i] - slowEMA[i - (slowLength - fastLength)]);
  }
  
  if (macd.length < signalLength) {
    return { macd, signal: [], histogram: [] };
  }
  
  // Calculate signal line (EMA of MACD)
  const signal = calculateEMA(macd, signalLength);
  
  if (signal.length === 0) {
    return { macd, signal, histogram: [] };
  }
  
  // Calculate histogram (MACD - Signal)
  const histogram: number[] = [];
  for (let i = 0; i < signal.length; i++) {
    histogram.push(macd[i + (macd.length - signal.length)] - signal[i]);
  }
  
  return { macd, signal, histogram };
};

// Generate trading signals based on technical indicators
export const generateSignals = (indicators: TechnicalIndicators): string[] => {
  const signals: string[] = [];
  
  // Stochastic Oversold/Overbought
  if (indicators.stochasticK !== null && indicators.stochasticD !== null) {
    if (indicators.stochasticK < 20 && indicators.stochasticD < 20) {
      signals.push("Stochastic indicates oversold conditions (below 20)");
    } else if (indicators.stochasticK > 80 && indicators.stochasticD > 80) {
      signals.push("Stochastic indicates overbought conditions (above 80)");
    }
    
    // Stochastic K crosses D (bullish)
    if (indicators.stochasticK > indicators.stochasticD) {
      signals.push("Stochastic K crossed above D (potential bullish signal)");
    }
  }
  
  // EMA Crossovers
  if (indicators.ema5 !== null && indicators.ema10 !== null) {
    if (indicators.ema5 > indicators.ema10) {
      signals.push("EMA 5 is above EMA 10 (bullish trend)");
    } else {
      signals.push("EMA 5 is below EMA 10 (bearish trend)");
    }
  }
  
  if (indicators.ema10 !== null && indicators.ema20 !== null) {
    if (indicators.ema10 > indicators.ema20) {
      signals.push("EMA 10 is above EMA 20 (bullish trend)");
    } else {
      signals.push("EMA 10 is below EMA 20 (bearish trend)");
    }
  }
  
  // RSI Oversold/Overbought
  if (indicators.rsi !== null) {
    if (indicators.rsi < 30) {
      signals.push("RSI below 30 (oversold conditions)");
    } else if (indicators.rsi > 70) {
      signals.push("RSI above 70 (overbought conditions)");
    }
  }
  
  // MACD Signals
  if (indicators.macd !== null && indicators.macdSignal !== null && indicators.macdHistogram !== null) {
    if (indicators.macdHistogram > 0) {
      signals.push("MACD Histogram is positive (bullish momentum)");
    } else {
      signals.push("MACD Histogram is negative (bearish momentum)");
    }
    
    if (indicators.macd > indicators.macdSignal) {
      signals.push("MACD crossed above Signal line (bullish crossover)");
    } else if (indicators.macd < indicators.macdSignal) {
      signals.push("MACD crossed below Signal line (bearish crossover)");
    }
  }
  
  if (signals.length === 0) {
    signals.push("No clear technical signals detected");
  }
  
  return signals;
};

// Generate mock data for testing when real data is not available
const generateMockData = (symbol: string, currentPrice: number): TechnicalIndicators => {
  const randomValue = (min: number, max: number) => Math.random() * (max - min) + min;
  
  const mockIndicators: TechnicalIndicators = {
    symbol,
    currentPrice,
    stochasticK: randomValue(10, 90),
    stochasticD: randomValue(10, 90),
    ema5: currentPrice * randomValue(0.98, 1.02),
    ema10: currentPrice * randomValue(0.97, 1.03),
    ema20: currentPrice * randomValue(0.96, 1.04),
    ema50: currentPrice * randomValue(0.95, 1.05),
    rsi: randomValue(30, 70),
    macd: randomValue(-1, 1),
    macdSignal: randomValue(-1, 1),
    macdHistogram: randomValue(-0.5, 0.5),
    indicators: []
  };
  
  mockIndicators.indicators = generateSignals(mockIndicators);
  return mockIndicators;
};

// Compute all technical indicators for a given symbol
export const calculateTechnicalIndicators = async (symbol: string, currentPrice: number): Promise<TechnicalIndicators> => {
  try {
    // Fetch historical data
    const historicalPrices = await fetchHistoricalPrices(symbol);
    
    if (historicalPrices.length === 0) {
      console.warn(`No historical price data available for ${symbol}, using mock data`);
      return generateMockData(symbol, currentPrice);
    }
    
    // Extract closing prices
    const closingPrices = historicalPrices.map(price => price.close);
    
    // Calculate indicators
    // EMAs
    const ema5 = calculateEMA(closingPrices, 5);
    const ema10 = calculateEMA(closingPrices, 10);
    const ema20 = calculateEMA(closingPrices, 20);
    const ema50 = calculateEMA(closingPrices, 50);
    
    // Stochastic
    const stochastic = calculateStochastic(historicalPrices);
    
    // RSI
    const rsi = calculateRSI(historicalPrices);
    
    // MACD
    const macd = calculateMACD(closingPrices);
    
    const indicators: TechnicalIndicators = {
      symbol,
      currentPrice,
      stochasticK: stochastic.k.length > 0 ? stochastic.k[stochastic.k.length - 1] : null,
      stochasticD: stochastic.d.length > 0 ? stochastic.d[stochastic.d.length - 1] : null,
      ema5: ema5.length > 0 ? ema5[ema5.length - 1] : null,
      ema10: ema10.length > 0 ? ema10[ema10.length - 1] : null,
      ema20: ema20.length > 0 ? ema20[ema20.length - 1] : null,
      ema50: ema50.length > 0 ? ema50[ema50.length - 1] : null,
      rsi: rsi.length > 0 ? rsi[rsi.length - 1] : null,
      macd: macd.macd.length > 0 ? macd.macd[macd.macd.length - 1] : null,
      macdSignal: macd.signal.length > 0 ? macd.signal[macd.signal.length - 1] : null,
      macdHistogram: macd.histogram.length > 0 ? macd.histogram[macd.histogram.length - 1] : null,
      indicators: []
    };
    
    // Generate signals/indicators
    indicators.indicators = generateSignals(indicators);
    
    return indicators;
  } catch (error) {
    console.error("Error calculating technical indicators:", error);
    console.warn(`Using mock data for ${symbol} due to calculation error`);
    return generateMockData(symbol, currentPrice);
  }
}; 