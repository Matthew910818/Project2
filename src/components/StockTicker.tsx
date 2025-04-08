import React, { useEffect, useState, useCallback } from 'react';
import yahooFinanceService, { StockData, MessageLog } from '../services/yahooFinanceService';
import { analyzeStock, AnalysisResponse } from '../services/stockAnalysisService';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { TechnicalIndicators } from '../services/technicalAnalysisService';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { StockAnalysisResult } from '../services/openaiService';

interface StockTickerProps {
  symbols: string[];
}

// Check if OpenAI API key is configured
const isOpenAIConfigured = process.env.REACT_APP_OPENAI_API_KEY ? true : false;
const isProjectKey = process.env.REACT_APP_OPENAI_API_KEY?.startsWith('sk-proj-') || false;

// Check if API URL is accessible
const API_URL = 'http://localhost:4000/api';

const StockTicker: React.FC<StockTickerProps> = ({ symbols }) => {
  const [stocks, setStocks] = useState<Record<string, StockData>>({});
  const [connected, setConnected] = useState<boolean>(false);
  const [lastUpdateTime, setLastUpdateTime] = useState<Date | null>(null);
  const [debugMode, setDebugMode] = useState<boolean>(false);
  const [timeSinceLastMsg, setTimeSinceLastMsg] = useState<number>(-1);
  const [messageLogs, setMessageLogs] = useState<MessageLog[]>([]);
  const [showMessageLogs, setShowMessageLogs] = useState<boolean>(false);
  const [filterType, setFilterType] = useState<string>('ALL');
  const [wsUrl, setWsUrl] = useState<string>(yahooFinanceService.getWebSocketUrl());
  const [analyzing, setAnalyzing] = useState<Record<string, boolean>>({});
  const [analyses, setAnalyses] = useState<Record<string, AnalysisResponse>>({});
  const [showAnalysis, setShowAnalysis] = useState<Record<string, boolean>>({});
  const [backendStatus, setBackendStatus] = useState<'checking' | 'connected' | 'disconnected'>('checking');
  const [showAlertSettings, setShowAlertSettings] = useState<boolean>(false);
  const [rsiThreshold, setRsiThreshold] = useState<number>(Number(process.env.REACT_APP_RSI_THRESHOLD) || 30);
  const [stochasticThreshold, setStochasticThreshold] = useState<number>(Number(process.env.REACT_APP_STOCHASTIC_THRESHOLD) || 20);
  const [useMacdPositive, setUseMacdPositive] = useState<boolean>(process.env.REACT_APP_USE_MACD_POSITIVE !== 'false');
  const [useEmaAlignment, setUseEmaAlignment] = useState<boolean>(process.env.REACT_APP_USE_EMA_ALIGNMENT !== 'false');

  // Update "time since last message" counter and message logs
  useEffect(() => {
    const timer = setInterval(() => {
      const timeSince = yahooFinanceService.getTimeSinceLastMessage();
      setTimeSinceLastMsg(timeSince);
      
      // Update message logs
      if (debugMode) {
        setMessageLogs(yahooFinanceService.getMessageLogs());
        setWsUrl(yahooFinanceService.getWebSocketUrl());
      }
    }, 1000);
    
    return () => clearInterval(timer);
  }, [debugMode]);

  useEffect(() => {
    if (symbols.length === 0) return;

    // Initialize the service and connect
    yahooFinanceService.connect(symbols);
    setConnected(true);

    // Subscribe to data updates
    const unsubscribe = yahooFinanceService.onData((data) => {
      setStocks(prev => ({
        ...prev,
        [data.id]: data
      }));
      setLastUpdateTime(new Date());
    });

    // Cleanup on component unmount
    return () => {
      unsubscribe();
      yahooFinanceService.disconnect();
      setConnected(false);
    };
  }, [symbols]);

  // Check backend connection
  useEffect(() => {
    const checkBackendConnection = async () => {
      try {
        const response = await fetch(`${API_URL}/health`);
        if (response.ok) {
          setBackendStatus('connected');
        } else {
          setBackendStatus('disconnected');
        }
      } catch (error) {
        console.error('Failed to connect to backend:', error);
        setBackendStatus('disconnected');
      }
    };

    checkBackendConnection();
    // Check every 30 seconds
    const interval = setInterval(checkBackendConnection, 30000);
    
    return () => clearInterval(interval);
  }, []);

  // Function to format price change with color
  const formatPriceChange = (change: number, changePercent: number) => {
    const color = change >= 0 ? 'green' : 'red';
    const sign = change >= 0 ? '+' : '';
    return (
      <span style={{ color }}>
        {sign}{change.toFixed(2)} ({sign}{changePercent.toFixed(2)}%)
      </span>
    );
  };
  
  // Function to toggle debug mode
  const toggleDebugMode = useCallback(() => {
    setDebugMode(prev => !prev);
    if (!debugMode) {
      setMessageLogs(yahooFinanceService.getMessageLogs());
      setWsUrl(yahooFinanceService.getWebSocketUrl());
    }
  }, [debugMode]);
  
  // Function to toggle message logs view
  const toggleMessageLogs = useCallback(() => {
    setShowMessageLogs(prev => !prev);
  }, []);
  
  // Function to reconnect with the same symbols
  const handleReconnect = useCallback(() => {
    if (symbols.length > 0) {
      yahooFinanceService.disconnect();
      setTimeout(() => {
        yahooFinanceService.connect(symbols);
      }, 1000);
    }
  }, [symbols]);
  
  // Calculate time difference
  const getTimeDifference = (timestamp: Date) => {
    const now = new Date();
    const diffMs = now.getTime() - timestamp.getTime();
    const diffSec = Math.floor(diffMs / 1000);
    
    if (diffSec < 60) return `${diffSec} sec ago`;
    if (diffSec < 3600) return `${Math.floor(diffSec / 60)} min ago`;
    return `${Math.floor(diffSec / 3600)} hours ago`;
  };

  // Function to analyze a stock
  const handleAnalyzeStock = async (symbol: string) => {
    if (!stocks[symbol] || analyzing[symbol]) return;
    
    try {
      // Set analyzing flag
      setAnalyzing(prev => ({ ...prev, [symbol]: true }));
      
      const stock = stocks[symbol];
      const analysis = await analyzeStock(
        symbol,
        stock.price,
        stock.changePercent,
        true // Send email if recommended
      );
      
      // Store analysis results
      setAnalyses(prev => ({ ...prev, [symbol]: analysis }));
      
      // Automatically show analysis
      setShowAnalysis(prev => ({ ...prev, [symbol]: true }));
    } catch (error) {
      console.error(`Error analyzing ${symbol}:`, error);
    } finally {
      // Clear analyzing flag
      setAnalyzing(prev => ({ ...prev, [symbol]: false }));
    }
  };
  
  // Function to toggle showing analysis
  const toggleAnalysis = (symbol: string) => {
    setShowAnalysis(prev => ({ 
      ...prev, 
      [symbol]: !prev[symbol] 
    }));
  };
  
  // Function to toggle WebSocket URL
  const toggleWebSocketVersion = useCallback(() => {
    const currentUrl = yahooFinanceService.getWebSocketUrl();
    const newUrl = currentUrl.includes('version=2') 
      ? 'wss://streamer.finance.yahoo.com/' 
      : 'wss://streamer.finance.yahoo.com/?version=2';
    
    yahooFinanceService.setWebSocketUrl(newUrl);
    setWsUrl(newUrl);
  }, []);

  // Filter message logs
  const filteredLogs = filterType === 'ALL' 
    ? messageLogs 
    : messageLogs.filter(log => log.type === filterType);

  // Get available log types
  const logTypes = ['ALL', ...Array.from(new Set(messageLogs.map(log => log.type)))];

  // Format sentiment display
  const formatSentiment = (sentiment: string) => {
    let color = 'gray';
    if (sentiment === 'positive') color = 'green';
    if (sentiment === 'negative') color = 'red';
    return <span style={{ color }}>{sentiment}</span>;
  };
  
  // Format technical indicators
  const formatIndicator = (value: number | null | undefined) => {
    if (value === null || value === undefined) return 'N/A';
    return value.toFixed(2);
  };

  // Add a toggle function for alert settings
  const toggleAlertSettings = useCallback(() => {
    setShowAlertSettings(prev => !prev);
  }, []);

  return (
    <div className="stock-ticker">
      <div className="stock-ticker-header">
        <h2>Stock Prices</h2>
        <div className="ticker-controls">
          <button 
            className="ticker-btn"
            onClick={toggleDebugMode}
          >
            {debugMode ? 'Hide Debug' : 'Debug'}
          </button>
          <button onClick={handleReconnect} className="reconnect-btn">
            Reconnect WebSocket
          </button>
          <button 
            className="settings-btn"
            onClick={toggleAlertSettings}
          >
            {showAlertSettings ? 'Hide Alert Settings' : 'Alert Settings'}
          </button>
        </div>
      </div>
      
      <div className="connection-status">
        <div className={`status-indicator ${connected ? "connected" : "disconnected"}`}></div>
        <span>Status: {connected ? "Connected" : "Disconnected"}</span>
        {lastUpdateTime && (
          <span className="last-update">
            Last update: {lastUpdateTime.toLocaleTimeString()} ({getTimeDifference(lastUpdateTime)})
          </span>
        )}
        {timeSinceLastMsg >= 0 && (
          <span className="time-since-msg">
            Time since last message: {timeSinceLastMsg.toFixed(0)}s
          </span>
        )}
      </div>
      
      {debugMode && (
        <div className="debug-info">
          <h3>Debug Information</h3>
          <p>WebSocket URL: {wsUrl}</p>
          <p>Subscribed symbols: {symbols.join(", ")}</p>
          <p>Number of stocks received: {Object.keys(stocks).length}</p>
          
          <div className="ws-version-toggle">
            <button onClick={toggleWebSocketVersion} className="ws-version-btn">
              Toggle WebSocket Version
            </button>
          </div>
          
          <div className="logs-control">
            <button onClick={toggleMessageLogs} className="logs-toggle-btn">
              {showMessageLogs ? "Hide WebSocket Messages" : "Show WebSocket Messages"}
            </button>
            {messageLogs.length > 0 && (
              <button onClick={() => yahooFinanceService.clearMessageLogs()} className="clear-logs-btn">
                Clear Logs
              </button>
            )}
          </div>
          
          {showMessageLogs && (
            <div className="message-logs">
              <h4>WebSocket Message Logs ({messageLogs.length} messages)</h4>
              
              <div className="filter-controls">
                <label>Filter by type: </label>
                <select 
                  value={filterType} 
                  onChange={(e) => setFilterType(e.target.value)}
                  className="log-filter"
                >
                  {logTypes.map(type => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
              </div>
              
              <div className="logs-container">
                {filteredLogs.length === 0 ? (
                  <p>No matching logs found.</p>
                ) : (
                  filteredLogs.map((log, index) => (
                    <div key={index} className={`log-entry log-type-${log.type.toLowerCase()}`}>
                      <div className="log-header">
                        <span className="log-timestamp">{new Date(log.timestamp).toLocaleTimeString()}</span>
                        <span className="log-type">{log.type}</span>
                        <span className="log-size">{log.size > 0 ? `${log.size} bytes` : ''}</span>
                      </div>
                      {log.content && (
                        <div className="log-content">
                          {log.type === 'STRING' || log.type === 'PROTOBUF_DECODED' ? (
                            <pre>{log.content}</pre>
                          ) : (
                            <p>{log.content}</p>
                          )}
                        </div>
                      )}
                      {log.parsedData && (
                        <details className="log-parsed-data">
                          <summary>Parsed Data</summary>
                          <pre>{JSON.stringify(log.parsedData, null, 2)}</pre>
                        </details>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      )}
      
      {!connected && symbols.length > 0 && <p>Connecting to Yahoo Finance...</p>}
      
      {Object.keys(stocks).length === 0 && connected && (
        <p>Waiting for stock data...</p>
      )}
      
      {/* API Key Configuration Notice */}
      <div className="api-key-notice">
        <details>
          <summary>
            OpenAI API Status
          </summary>
          <div className="api-key-instructions">
            {!isOpenAIConfigured ? (
              <p>
                To enable AI-powered analysis, add your OpenAI API key to the <code>.env</code> file and restart the app.
              </p>
            ) : (
              <p>
                OpenAI API is configured. Use the "Analyze Stock" button on any stock to get AI-powered analysis.
              </p>
            )}
          </div>
        </details>
      </div>
      
      {showAlertSettings && (
        <div className="alert-settings">
          <h3>Technical Alert Settings</h3>
          <p>Configure the thresholds for technical analysis alerts</p>
          
          <div className="settings-row">
            <label>
              RSI Threshold:
              <input 
                type="number" 
                value={rsiThreshold}
                min="1" 
                max="99"
                onChange={(e) => setRsiThreshold(Number(e.target.value))}
              />
            </label>
            <span className="setting-hint">Lower values indicate oversold conditions (typically below 30)</span>
          </div>
          
          <div className="settings-row">
            <label>
              Stochastic Threshold:
              <input 
                type="number" 
                value={stochasticThreshold}
                min="1" 
                max="99"
                onChange={(e) => setStochasticThreshold(Number(e.target.value))}
              />
            </label>
            <span className="setting-hint">Lower values indicate oversold conditions (typically below 20)</span>
          </div>
          
          <div className="settings-row">
            <label>
              <input 
                type="checkbox" 
                checked={useMacdPositive}
                onChange={(e) => setUseMacdPositive(e.target.checked)}
              />
              Include MACD signal
            </label>
            <span className="setting-hint">Checks if MACD line crosses above the signal line</span>
          </div>
          
          <div className="settings-row">
            <label>
              <input 
                type="checkbox" 
                checked={useEmaAlignment}
                onChange={(e) => setUseEmaAlignment(e.target.checked)}
              />
              Include EMA alignment
            </label>
            <span className="setting-hint">Checks if 8-day EMA &gt; 20-day EMA &gt; 50-day EMA</span>
          </div>
          
          <div className="settings-note">
            <p>Note: These settings apply only for the current session. For permanent changes, update the .env file.</p>
          </div>
        </div>
      )}
      
      {/* Backend Status Notice */}
      <div className={`backend-status-notice ${backendStatus}`}>
        <div className="status-indicator"></div>
        <span className="status-message">
          {backendStatus === 'checking' && 'Checking backend server...'}
          {backendStatus === 'connected' && 'Backend server connected'}
          {backendStatus === 'disconnected' && 'Backend server disconnected - stock analysis will be limited'}
        </span>
        {backendStatus === 'disconnected' && (
          <button 
            onClick={() => setBackendStatus('checking')}
            className="retry-button"
          >
            Retry Connection
          </button>
        )}
      </div>
      
      <div className="stock-list">
        {Object.values(stocks).map((stock) => (
          <div key={stock.id} className="stock-item">
            <div className="stock-header">
              <h3>{stock.shortName} ({stock.id})</h3>
              <span className="market-hours">{stock.marketHours}</span>
            </div>
            <div className="stock-price">
              <span className="price">{stock.price.toFixed(2)} {stock.currency}</span>
              <span className="change">
                {formatPriceChange(stock.change, stock.changePercent)}
              </span>
            </div>
            <div className="stock-details">
              <div>Open: {stock.openPrice.toFixed(2)}</div>
              <div>Previous Close: {stock.previousClose.toFixed(2)}</div>
              <div>Day Range: {stock.dayLow.toFixed(2)} - {stock.dayHigh.toFixed(2)}</div>
              <div>Volume: {stock.volume.toLocaleString()}</div>
              <div className="last-update-time">
                Last Update: {stock.time.toLocaleTimeString()} ({getTimeDifference(stock.time)})
              </div>
            </div>
            
            <div className="stock-analysis-controls">
              <button 
                onClick={() => handleAnalyzeStock(stock.id)}
                disabled={analyzing[stock.id]}
                className="analyze-btn"
              >
                {analyzing[stock.id] ? 'Analyzing...' : analyses[stock.id] ? 'Reanalyze Stock' : 'Analyze Stock'}
              </button>
              
              {analyses[stock.id] && (
                <button 
                  onClick={() => toggleAnalysis(stock.id)}
                  className="toggle-analysis-btn"
                >
                  {showAnalysis[stock.id] ? 'Hide Analysis' : 'Show Analysis'}
                </button>
              )}
            </div>
            
            {showAnalysis[stock.id] && analyses[stock.id] && (
              <div className="stock-analysis">
                <h4>Stock Analysis Results</h4>
                
                {analyses[stock.id].error && (
                  <div className="analysis-error">
                    Error: {analyses[stock.id].error}
                  </div>
                )}
                
                {analyses[stock.id].sentimentAnalysis && (
                  <div className="sentiment-analysis">
                    <h5>Sentiment Analysis</h5>
                    <div className="sentiment-result">
                      <div>Sentiment: {formatSentiment(analyses[stock.id].sentimentAnalysis?.sentiment || '')}</div>
                      <div>Recommendation: {analyses[stock.id].sentimentAnalysis?.buyRecommendation ? 'Buy' : 'Hold/Sell'}</div>
                      <div className="sentiment-explanation">
                        {analyses[stock.id].sentimentAnalysis?.explanation}
                      </div>
                    </div>
                  </div>
                )}
                
                {analyses[stock.id].technicalAnalysis && (
                  <div className="technical-analysis">
                    <h5>Technical Analysis</h5>
                    <div className="technical-indicators">
                      <div className="indicator-row">
                        <div>Stochastic K: {formatIndicator(analyses[stock.id].technicalAnalysis?.stochasticK)}</div>
                        <div>Stochastic D: {formatIndicator(analyses[stock.id].technicalAnalysis?.stochasticD)}</div>
                      </div>
                      <div className="indicator-row">
                        <div>RSI: {formatIndicator(analyses[stock.id].technicalAnalysis?.rsi)}</div>
                        <div>MACD: {formatIndicator(analyses[stock.id].technicalAnalysis?.macd)}</div>
                      </div>
                      <div className="indicator-row">
                        <div>EMA 5: {formatIndicator(analyses[stock.id].technicalAnalysis?.ema5)}</div>
                        <div>EMA 10: {formatIndicator(analyses[stock.id].technicalAnalysis?.ema10)}</div>
                        <div>EMA 20: {formatIndicator(analyses[stock.id].technicalAnalysis?.ema20)}</div>
                      </div>
                    </div>
                    
                    <div className="technical-signals">
                      <h6>Trading Signals:</h6>
                      <ul>
                        {analyses[stock.id].technicalAnalysis?.indicators.map((signal, index) => (
                          <li key={index}>{signal}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                )}
                
                {analyses[stock.id].finalRecommendation && (
                  <div className="final-recommendation">
                    <h5>Final Recommendation</h5>
                    <div className={`recommendation ${analyses[stock.id].finalRecommendation?.buyRecommendation ? 'buy' : 'hold'}`}>
                      <div className="recommendation-decision">
                        {analyses[stock.id].finalRecommendation?.buyRecommendation ? 'BUY' : 'HOLD/SELL'}
                      </div>
                      <div className="recommendation-explanation">
                        {analyses[stock.id].finalRecommendation?.explanation}
                      </div>
                      {analyses[stock.id].emailSent && (
                        <div className="email-sent">
                          Buy recommendation email notification sent!
                        </div>
                      )}
                    </div>
                  </div>
                )}
                
                {analyses[stock.id] && analyses[stock.id].technicalAlertSent && (
                  <div className="technical-alert-sent">
                    <h6>Technical Alert Email Sent</h6>
                    <p>The following technical conditions met the criteria for an alert:</p>
                    <ul>
                      {analyses[stock.id].metTechnicalCriteria.map((criterion, index) => (
                        <li key={index}>{criterion}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
            
            {debugMode && stock.rawData && (
              <div className="debug-data">
                <details>
                  <summary>Raw Data</summary>
                  <pre>{JSON.stringify(stock.rawData, null, 2)}</pre>
                </details>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default StockTicker; 