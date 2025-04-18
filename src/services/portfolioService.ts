const API_BASE_URL = 'http://localhost:4000/api';
export interface StockPurchaseInput {
  id?: number;
  symbol: string;
  quantity: number | string;
  purchasePrice: number | string;
  purchaseDate?: string;
  notes?: string;
}

export interface StockPurchase {
  id?: number;
  symbol: string;
  quantity: number;
  purchasePrice: number;
  purchaseDate?: string;
  notes?: string;
}

export interface PortfolioSummary {
  symbol: string;
  totalShares: number;
  avgPrice: number;
  totalInvestment: number;
}

export const addStockPurchase = async (purchase: StockPurchaseInput): Promise<StockPurchase> => {
  try {
    const response = await fetch(`${API_BASE_URL}/purchases`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(purchase),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to add stock purchase');
    }

    return await response.json();
  } catch (error) {
    console.error('Error adding stock purchase:', error);
    throw error;
  }
};

export const getStockPurchases = async (symbol: string): Promise<StockPurchase[]> => {
  try {
    const response = await fetch(`${API_BASE_URL}/purchases/${symbol}`);

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to fetch stock purchases');
    }

    return await response.json();
  } catch (error) {
    console.error(`Error fetching purchases for ${symbol}:`, error);
    throw error;
  }
};

export const getAllStockPurchases = async (): Promise<StockPurchase[]> => {
  try {
    const response = await fetch(`${API_BASE_URL}/purchases`);

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to fetch stock purchases');
    }

    return await response.json();
  } catch (error) {
    console.error('Error fetching all stock purchases:', error);
    throw error;
  }
};

export const getPortfolioSummary = async (): Promise<PortfolioSummary[]> => {
  try {
    const response = await fetch(`${API_BASE_URL}/portfolio`);

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to fetch portfolio summary');
    }

    const data = await response.json();
    return data.map((item: any) => ({
      symbol: item.symbol,
      totalShares: item.total_shares,
      avgPrice: item.avg_price,
      totalInvestment: item.total_investment
    }));
  } catch (error) {
    console.error('Error fetching portfolio summary:', error);
    throw error;
  }
};

export const updateStockPurchase = async (id: number, updates: Partial<StockPurchaseInput>): Promise<StockPurchase> => {
  try {
    const response = await fetch(`${API_BASE_URL}/purchases/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(updates),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to update stock purchase');
    }

    return await response.json();
  } catch (error) {
    console.error(`Error updating purchase with ID ${id}:`, error);
    throw error;
  }
};

export const deleteStockPurchase = async (id: number): Promise<{ id: number; deleted: boolean }> => {
  try {
    const response = await fetch(`${API_BASE_URL}/purchases/${id}`, {
      method: 'DELETE',
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to delete stock purchase');
    }

    return await response.json();
  } catch (error) {
    console.error(`Error deleting purchase with ID ${id}:`, error);
    throw error;
  }
}; 