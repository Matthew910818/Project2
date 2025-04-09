import React, { useState, useEffect } from 'react';
import { 
  StockPurchase, 
  StockPurchaseInput,
  PortfolioSummary, 
  addStockPurchase, 
  getPortfolioSummary, 
  getAllStockPurchases, 
  updateStockPurchase, 
  deleteStockPurchase 
} from '../services/portfolioService';

const PortfolioManager: React.FC = () => {
  const [summary, setSummary] = useState<PortfolioSummary[]>([]);
  const [purchases, setPurchases] = useState<StockPurchase[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  
  const [formData, setFormData] = useState<StockPurchaseInput>({
    symbol: '',
    quantity: '',
    purchasePrice: '',
    notes: ''
  });
  
  const [editId, setEditId] = useState<number | null>(null);
  const [isFormVisible, setIsFormVisible] = useState<boolean>(false);

  const loadPortfolioData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const [summaryData, purchasesData] = await Promise.all([
        getPortfolioSummary(),
        getAllStockPurchases()
      ]);
      
      setSummary(summaryData);
      setPurchases(purchasesData);
    } catch (err: any) {
      setError(err.message || 'Failed to load portfolio data');
      console.error('Error loading portfolio data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPortfolioData();
  }, []);


  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    let processedValue: string | number = value;
    
    if (name === 'quantity' || name === 'purchasePrice') {
      if (value === '' || /^\d*\.?\d*$/.test(value)) {
        processedValue = value;
      } else {
        return;
      }
    } else if (name === 'symbol') {
      processedValue = value.toUpperCase();
    }
    
    setFormData({
      ...formData,
      [name]: processedValue
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const quantity = typeof formData.quantity === 'string' && formData.quantity.trim() !== ''
      ? parseFloat(formData.quantity)
      : typeof formData.quantity === 'number' ? formData.quantity : NaN;
      
    const purchasePrice = typeof formData.purchasePrice === 'string' && formData.purchasePrice.trim() !== ''
      ? parseFloat(formData.purchasePrice)
      : typeof formData.purchasePrice === 'number' ? formData.purchasePrice : NaN;
    
    if (!formData.symbol || isNaN(Number(quantity)) || isNaN(Number(purchasePrice))) {
      setError('Symbol, quantity, and purchase price are required and must be valid numbers');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      
      const validatedData = {
        ...formData,
        quantity: quantity,
        purchasePrice: purchasePrice
      };
      
      if (editId) {
        await updateStockPurchase(editId, validatedData);
      } else {
        await addStockPurchase(validatedData);
      }
      
      setFormData({
        symbol: '',
        quantity: '',
        purchasePrice: '',
        notes: ''
      });
      setEditId(null);
      setIsFormVisible(false);
      await loadPortfolioData();
    } catch (err: any) {
      setError(err.message || 'Failed to save stock purchase');
      console.error('Error saving stock purchase:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (purchase: StockPurchase) => {
    if (!purchase.id) return;
    
    setFormData({
      symbol: purchase.symbol,
      quantity: purchase.quantity.toString(),
      purchasePrice: purchase.purchasePrice.toString(),
      notes: purchase.notes || ''
    });
    setEditId(purchase.id);
    setIsFormVisible(true);
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('Are you sure you want to delete this purchase?')) return;
    
    try {
      setLoading(true);
      setError(null);
      
      await deleteStockPurchase(id);
      await loadPortfolioData();
    } catch (err: any) {
      setError(err.message || 'Failed to delete stock purchase');
      console.error('Error deleting stock purchase:', err);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value: number) => {
    if (isNaN(value)) return '$0.00';
    
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(value);
  };
  
  const formatQuantity = (value: number) => {
    if (isNaN(value)) return '0';
    
    return value.toLocaleString('en-US', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 8
    });
  };
  
  const formatDate = (dateString: string | undefined) => {
    if (!dateString) return 'N/A';
    
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return 'N/A';
      return date.toLocaleDateString();
    } catch (error) {
      return 'N/A';
    }
  };

  return (
    <div className="portfolio-manager">
      <h2>Portfolio Manager</h2>
      
      {/* Error display */}
      {error && <div className="error-message">{error}</div>}
      
      {/* Summary section */}
      <div className="portfolio-summary">
        <h3>Portfolio Summary</h3>
        {loading && <p>Loading summary...</p>}
        {!loading && summary.length === 0 && <p>No stocks in portfolio yet.</p>}
        {!loading && summary.length > 0 && (
          <table className="summary-table">
            <thead>
              <tr>
                <th>Symbol</th>
                <th>Shares</th>
                <th>Avg. Price</th>
                <th>Total Value</th>
              </tr>
            </thead>
            <tbody>
              {summary.map((item) => (
                <tr key={item.symbol}>
                  <td>{item.symbol}</td>
                  <td>{formatQuantity(item.totalShares)}</td>
                  <td>{formatCurrency(item.avgPrice)}</td>
                  <td>{formatCurrency(item.totalInvestment)}</td>
                </tr>
              ))}
              <tr className="total-row">
                <td colSpan={3}><strong>Total Portfolio Value:</strong></td>
                <td><strong>{formatCurrency(summary.reduce((sum, item) => sum + item.totalInvestment, 0))}</strong></td>
              </tr>
            </tbody>
          </table>
        )}
      </div>

      {/* Form toggle button */}
      <div className="form-toggle">
        <button 
          className="form-toggle-btn" 
          onClick={() => {
            if (isFormVisible && editId) {
              // Reset form if we're canceling an edit
              setFormData({
                symbol: '',
                quantity: '',
                purchasePrice: '',
                notes: ''
              });
              setEditId(null);
            }
            setIsFormVisible(!isFormVisible);
          }}
        >
          {isFormVisible ? 'Cancel' : 'Add New Purchase'}
        </button>
      </div>

      {/* Purchase form */}
      {isFormVisible && (
        <div className="purchase-form">
          <h3>{editId ? 'Edit Purchase' : 'Add New Purchase'}</h3>
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label htmlFor="symbol">Symbol</label>
              <input
                type="text"
                id="symbol"
                name="symbol"
                value={formData.symbol}
                onChange={handleInputChange}
                required
                disabled={!!editId} // Disable symbol edit for existing purchases
              />
            </div>
            
            <div className="form-group">
              <label htmlFor="quantity">Quantity</label>
              <input
                type="text"
                id="quantity"
                name="quantity"
                value={formData.quantity}
                onChange={handleInputChange}
                placeholder="Enter quantity (e.g. 10 or 0.5)"
                required
              />
            </div>
            
            <div className="form-group">
              <label htmlFor="purchasePrice">Purchase Price</label>
              <input
                type="text"
                id="purchasePrice"
                name="purchasePrice"
                value={formData.purchasePrice}
                onChange={handleInputChange}
                placeholder="Enter price (e.g. 150.25)"
                required
              />
            </div>
            
            <div className="form-group">
              <label htmlFor="notes">Notes</label>
              <textarea
                id="notes"
                name="notes"
                value={formData.notes || ''}
                onChange={handleInputChange}
                rows={3}
              ></textarea>
            </div>
            
            <div className="form-actions">
              <button type="submit" disabled={loading}>
                {editId ? 'Update Purchase' : 'Add Purchase'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Purchases list */}
      <div className="purchases-list">
        <h3>Purchase History</h3>
        {loading && <p>Loading purchases...</p>}
        {!loading && purchases.length === 0 && <p>No purchases recorded yet.</p>}
        {!loading && purchases.length > 0 && (
          <table className="purchases-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Symbol</th>
                <th>Quantity</th>
                <th>Price</th>
                <th>Total</th>
                <th>Notes</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {purchases.map((purchase) => (
                <tr key={purchase.id}>
                  <td>{formatDate(purchase.purchaseDate)}</td>
                  <td>{purchase.symbol}</td>
                  <td>{formatQuantity(purchase.quantity)}</td>
                  <td>{formatCurrency(purchase.purchasePrice)}</td>
                  <td>{formatCurrency(purchase.quantity * purchase.purchasePrice)}</td>
                  <td>{purchase.notes || '-'}</td>
                  <td>
                    <button className="edit-btn" onClick={() => handleEdit(purchase)}>Edit</button>
                    <button className="delete-btn" onClick={() => purchase.id && handleDelete(purchase.id)}>Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default PortfolioManager; 