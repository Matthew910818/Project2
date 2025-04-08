const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Connect to SQLite database
const dbPath = path.resolve(__dirname, 'stock_tracker.db');
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error connecting to the database:', err.message);
  } else {
    console.log('Connected to SQLite database');
    // Create tables if they don't exist
    createTables();
  }
});

// Create necessary tables
const createTables = () => {
  // Stock purchases table
  db.run(`
    CREATE TABLE IF NOT EXISTS stock_purchases (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      symbol TEXT NOT NULL,
      quantity REAL NOT NULL,
      purchase_price REAL NOT NULL,
      purchase_date TEXT DEFAULT CURRENT_TIMESTAMP,
      notes TEXT
    )
  `, (err) => {
    if (err) {
      console.error('Error creating stock_purchases table:', err.message);
    } else {
      console.log('Stock purchases table ready');
    }
  });
};

// Add a new stock purchase record
const addStockPurchase = (purchase) => {
  return new Promise((resolve, reject) => {
    const { symbol, quantity, purchasePrice, notes } = purchase;
    
    // Validate numeric fields
    const validQuantity = parseFloat(quantity);
    const validPrice = parseFloat(purchasePrice);
    
    if (isNaN(validQuantity) || isNaN(validPrice)) {
      return reject(new Error('Quantity and purchase price must be valid numbers'));
    }
    
    // Format the date in ISO format
    const purchaseDate = new Date().toISOString();
    
    db.run(
      `INSERT INTO stock_purchases (symbol, quantity, purchase_price, purchase_date, notes) 
       VALUES (?, ?, ?, ?, ?)`,
      [symbol.toUpperCase(), validQuantity, validPrice, purchaseDate, notes || ''],
      function(err) {
        if (err) {
          console.error('Error adding stock purchase:', err.message);
          reject(err);
        } else {
          resolve({ 
            id: this.lastID, 
            symbol: symbol.toUpperCase(), 
            quantity: validQuantity, 
            purchasePrice: validPrice, 
            purchaseDate, 
            notes: notes || '' 
          });
        }
      }
    );
  });
};

// Get all purchases for a specific stock
const getStockPurchases = (symbol) => {
  return new Promise((resolve, reject) => {
    db.all(
      `SELECT 
        id, 
        symbol, 
        quantity, 
        purchase_price as purchasePrice, 
        purchase_date as purchaseDate, 
        notes 
       FROM stock_purchases 
       WHERE symbol = ? 
       ORDER BY purchase_date DESC`,
      [symbol.toUpperCase()],
      (err, rows) => {
        if (err) {
          console.error('Error retrieving stock purchases:', err.message);
          reject(err);
        } else {
          resolve(rows);
        }
      }
    );
  });
};

// Get all stock purchases
const getAllStockPurchases = () => {
  return new Promise((resolve, reject) => {
    db.all(
      `SELECT 
        id, 
        symbol, 
        quantity, 
        purchase_price as purchasePrice, 
        purchase_date as purchaseDate, 
        notes 
       FROM stock_purchases 
       ORDER BY purchase_date DESC`,
      (err, rows) => {
        if (err) {
          console.error('Error retrieving all stock purchases:', err.message);
          reject(err);
        } else {
          resolve(rows);
        }
      }
    );
  });
};

// Get portfolio summary (grouped by symbol)
const getPortfolioSummary = () => {
  return new Promise((resolve, reject) => {
    db.all(
      `SELECT 
        symbol, 
        SUM(quantity) as total_shares, 
        CASE 
          WHEN SUM(quantity) > 0 THEN SUM(quantity * purchase_price) / SUM(quantity)
          ELSE 0
        END as avg_price,
        SUM(quantity * purchase_price) as total_investment
      FROM stock_purchases 
      GROUP BY symbol
      ORDER BY symbol`,
      (err, rows) => {
        if (err) {
          console.error('Error getting portfolio summary:', err.message);
          reject(err);
        } else {
          // Format data to ensure proper types
          const formattedRows = rows.map(row => ({
            symbol: row.symbol,
            total_shares: parseFloat(row.total_shares),
            avg_price: parseFloat(row.avg_price),
            total_investment: parseFloat(row.total_investment)
          }));
          resolve(formattedRows);
        }
      }
    );
  });
};

// Update a stock purchase record
const updateStockPurchase = (id, updates) => {
  return new Promise((resolve, reject) => {
    const { quantity, purchasePrice, notes } = updates;
    
    // Validate numeric fields
    const validQuantity = parseFloat(quantity);
    const validPrice = parseFloat(purchasePrice);
    
    if (isNaN(validQuantity) || isNaN(validPrice)) {
      return reject(new Error('Quantity and purchase price must be valid numbers'));
    }
    
    db.run(
      `UPDATE stock_purchases 
       SET quantity = ?, purchase_price = ?, notes = ?
       WHERE id = ?`,
      [validQuantity, validPrice, notes || '', id],
      function(err) {
        if (err) {
          console.error('Error updating stock purchase:', err.message);
          reject(err);
        } else {
          if (this.changes === 0) {
            reject(new Error('Purchase record not found'));
          } else {
            resolve({ 
              id, 
              quantity: validQuantity, 
              purchasePrice: validPrice, 
              notes: notes || '' 
            });
          }
        }
      }
    );
  });
};

// Delete a stock purchase record
const deleteStockPurchase = (id) => {
  return new Promise((resolve, reject) => {
    db.run(
      `DELETE FROM stock_purchases WHERE id = ?`,
      [id],
      function(err) {
        if (err) {
          console.error('Error deleting stock purchase:', err.message);
          reject(err);
        } else {
          if (this.changes === 0) {
            reject(new Error('Purchase record not found'));
          } else {
            resolve({ id, deleted: true });
          }
        }
      }
    );
  });
};

// Clean up database connection when the application closes
process.on('SIGINT', () => {
  db.close((err) => {
    if (err) {
      console.error('Error closing database connection:', err.message);
    } else {
      console.log('Database connection closed');
    }
    process.exit(0);
  });
});

module.exports = {
  addStockPurchase,
  getStockPurchases,
  getAllStockPurchases,
  getPortfolioSummary,
  updateStockPurchase,
  deleteStockPurchase
}; 