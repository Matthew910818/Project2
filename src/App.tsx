import React, { useState } from 'react';
import './App.css';
import StockTicker from './components/StockTicker';
import PortfolioManager from './components/PortfolioManager';

type TabType = 'stockTicker' | 'portfolioManager';

function App() {
  const [symbols, setSymbols] = useState<string[]>(['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'TSLA']);
  const [newSymbol, setNewSymbol] = useState<string>('');
  const [activeTab, setActiveTab] = useState<TabType>('stockTicker');

  const handleAddSymbol = () => {
    if (newSymbol && !symbols.includes(newSymbol)) {
      setSymbols([...symbols, newSymbol.toUpperCase()]);
      setNewSymbol('');
    }
  };

  const handleRemoveSymbol = (symbol: string) => {
    setSymbols(symbols.filter(s => s !== symbol));
  };

  return (
    <div className="App">
      <header className="App-header">
        <h1>Stock Price Tracker</h1>
        
        {/* Tab Navigation */}
        <div className="tab-navigation">
          <button 
            className={`tab-button ${activeTab === 'stockTicker' ? 'active' : ''}`}
            onClick={() => setActiveTab('stockTicker')}
          >
            Stock Ticker
          </button>
          <button 
            className={`tab-button ${activeTab === 'portfolioManager' ? 'active' : ''}`}
            onClick={() => setActiveTab('portfolioManager')}
          >
            Portfolio Manager
          </button>
        </div>
      </header>
      
      <main>
        {activeTab === 'stockTicker' && (
          <>
            <div className="symbol-control">
              <div className="tracked-symbols">
                <h3>Tracked Symbols:</h3>
                <div className="symbol-tags">
                  {symbols.map(symbol => (
                    <div key={symbol} className="symbol-tag">
                      {symbol}
                      <button onClick={() => handleRemoveSymbol(symbol)}>×</button>
                    </div>
                  ))}
                </div>
              </div>
              <div className="add-symbol">
                <input
                  type="text"
                  value={newSymbol}
                  onChange={(e) => setNewSymbol(e.target.value.toUpperCase())}
                  placeholder="Enter stock symbol"
                />
                <button onClick={handleAddSymbol}>Add</button>
              </div>
            </div>
            <StockTicker symbols={symbols} />
          </>
        )}
        
        {activeTab === 'portfolioManager' && (
          <PortfolioManager />
        )}
      </main>
    </div>
  );
}

export default App;
