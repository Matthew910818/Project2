const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const { OpenAI } = require('openai');
const sgMail = require('@sendgrid/mail');
const database = require('./database');
const path = require('path');

// Load environment variables from parent directory
dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

// Initialize Express app
const app = express();
app.use(cors());
app.use(express.json());

// Initialize OpenAI client
const openAI = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Initialize SendGrid
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Server is running' });
});

// Helper function to extract JSON from OpenAI text response
const extractJSON = (text) => {
  // Try to find JSON content in the response
  const jsonRegex = /\{[\s\S]*\}/;
  const match = text.match(jsonRegex);
  
  if (match) {
    try {
      return JSON.parse(match[0]);
    } catch (e) {
      console.error("Failed to parse matched JSON:", e);
    }
  }
  
  // If we can't extract valid JSON, construct a basic response
  return {
    sentiment: "neutral",
    explanation: "Unable to extract proper analysis from response.",
    buyRecommendation: false
  };
};

// Send email notification endpoint
app.post('/api/send-email', async (req, res) => {
  try {
    const { 
      subject, 
      html, 
      text,
      recipientEmail = process.env.RECIPIENT_EMAIL 
    } = req.body;
    
    if (!subject || (!html && !text)) {
      return res.status(400).json({ error: 'Subject and html/text content are required' });
    }
    
    console.log(`Sending email notification to ${recipientEmail}...`);
    
    const msg = {
      to: recipientEmail,
      from: process.env.SENDER_EMAIL,
      subject: subject,
      text: text || '',
      html: html || '',
    };
    
    await sgMail.send(msg);
    
    console.log('Email sent successfully');
    return res.json({ 
      success: true, 
      message: 'Email notification sent successfully'
    });
  } catch (error) {
    console.error('Error sending email:', error);
    return res.status(500).json({ 
      error: error.message || 'Failed to send email notification'
    });
  }
});

// Stock purchase API endpoints
// Add a new stock purchase
app.post('/api/purchases', async (req, res) => {
  try {
    const { symbol, quantity, purchasePrice, notes } = req.body;
    
    if (!symbol || quantity === undefined || quantity === '' || purchasePrice === undefined || purchasePrice === '') {
      return res.status(400).json({ error: 'Symbol, quantity, and purchase price are required' });
    }
    
    // Ensure proper float parsing
    const numQuantity = parseFloat(quantity);
    const numPrice = parseFloat(purchasePrice);
    
    if (isNaN(numQuantity) || isNaN(numPrice)) {
      return res.status(400).json({ error: 'Quantity and purchase price must be valid numbers' });
    }
    
    const purchase = await database.addStockPurchase({
      symbol,
      quantity: numQuantity,
      purchasePrice: numPrice,
      notes
    });
    
    return res.status(201).json(purchase);
  } catch (error) {
    console.error('Error adding stock purchase:', error);
    return res.status(500).json({ error: error.message });
  }
});

// Get all purchases for a specific stock
app.get('/api/purchases/:symbol', async (req, res) => {
  try {
    const { symbol } = req.params;
    const purchases = await database.getStockPurchases(symbol);
    return res.json(purchases);
  } catch (error) {
    console.error('Error retrieving stock purchases:', error);
    return res.status(500).json({ error: error.message });
  }
});

// Get all stock purchases
app.get('/api/purchases', async (req, res) => {
  try {
    const purchases = await database.getAllStockPurchases();
    return res.json(purchases);
  } catch (error) {
    console.error('Error retrieving all stock purchases:', error);
    return res.status(500).json({ error: error.message });
  }
});

// Get portfolio summary
app.get('/api/portfolio', async (req, res) => {
  try {
    const summary = await database.getPortfolioSummary();
    return res.json(summary);
  } catch (error) {
    console.error('Error retrieving portfolio summary:', error);
    return res.status(500).json({ error: error.message });
  }
});

// Update a stock purchase
app.put('/api/purchases/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { quantity, purchasePrice, notes } = req.body;
    
    if (quantity === undefined || quantity === '' || purchasePrice === undefined || purchasePrice === '') {
      return res.status(400).json({ error: 'Quantity and purchase price are required' });
    }
    
    // Ensure proper float parsing
    const numQuantity = parseFloat(quantity);
    const numPrice = parseFloat(purchasePrice);
    
    if (isNaN(numQuantity) || isNaN(numPrice)) {
      return res.status(400).json({ error: 'Quantity and purchase price must be valid numbers' });
    }
    
    const purchase = await database.updateStockPurchase(id, {
      quantity: numQuantity,
      purchasePrice: numPrice,
      notes
    });
    
    return res.json(purchase);
  } catch (error) {
    console.error('Error updating stock purchase:', error);
    return res.status(500).json({ error: error.message });
  }
});

// Delete a stock purchase
app.delete('/api/purchases/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await database.deleteStockPurchase(id);
    return res.json(result);
  } catch (error) {
    console.error('Error deleting stock purchase:', error);
    return res.status(500).json({ error: error.message });
  }
});

// Analyze sentiment endpoint
app.post('/api/analyze-sentiment', async (req, res) => {
  try {
    const { symbol } = req.body;
    
    if (!symbol) {
      return res.status(400).json({ error: 'Symbol is required' });
    }
    
    console.log(`Analyzing sentiment for ${symbol}...`);
    
    const response = await openAI.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: "You are a financial analyst. Your response must be valid JSON with the fields 'sentiment' ('positive', 'neutral', or 'negative'), 'explanation' (string), and 'buyRecommendation' (boolean). Return ONLY a JSON object without code blocks, explanation, or additional text."
        },
        {
          role: "user",
          content: `Analyze the sentiment for ${symbol} stock. Format your response as JSON with the fields: "sentiment" (string: positive, neutral, negative), "explanation" (string), "buyRecommendation" (boolean).`
        }
      ]
    });
    
    const content = response.choices[0].message.content;
    
    if (!content) {
      return res.status(500).json({ 
        error: 'No content received from OpenAI',
        fallback: {
          sentiment: "neutral",
          explanation: "Unable to analyze sentiment at this time.",
          buyRecommendation: false
        }
      });
    }
    
    console.log("Raw OpenAI response:", content);
    
    try {
      // First try direct JSON parsing
      const result = JSON.parse(content);
      return res.json(result);
    } catch (error) {
      console.error("Failed to parse OpenAI response as JSON, trying to extract:", error);
      
      // If direct parsing fails, try to extract JSON from the response
      const extractedResult = extractJSON(content);
      console.log("Extracted result:", extractedResult);
      
      return res.json(extractedResult);
    }
  } catch (error) {
    console.error("OpenAI API error:", error);
    return res.status(500).json({ 
      error: error.message,
      fallback: {
        sentiment: "neutral",
        explanation: "Error during analysis: " + error.message,
        buyRecommendation: false
      }
    });
  }
});

// Combined analysis endpoint
app.post('/api/combine-analysis', async (req, res) => {
  try {
    const { symbol, technicalAnalysis, price, change } = req.body;
    
    if (!symbol || !technicalAnalysis || price === undefined || change === undefined) {
      return res.status(400).json({ error: 'Symbol, technicalAnalysis, price, and change are required' });
    }
    
    console.log(`Generating recommendation for ${symbol}...`);
    
    const response = await openAI.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: "You are a financial analyst. Your response must be valid JSON with the fields 'sentiment' ('positive', 'neutral', or 'negative'), 'explanation' (string), and 'buyRecommendation' (boolean). Return ONLY a JSON object without code blocks, explanation, or additional text."
        },
        {
          role: "user",
          content: `For ${symbol} at $${price} (${change}%), analyze these technical indicators: ${technicalAnalysis}. Format your response as JSON with the fields: "sentiment" (string: positive, neutral, negative), "explanation" (string), "buyRecommendation" (boolean).`
        }
      ]
    });
    
    const content = response.choices[0].message.content;
    
    if (!content) {
      return res.status(500).json({ 
        error: 'No content received from OpenAI',
        fallback: {
          sentiment: "neutral",
          explanation: "Unable to generate recommendation at this time.",
          buyRecommendation: false
        }
      });
    }
    
    console.log("Raw OpenAI response:", content);
    
    try {
      // First try direct JSON parsing
      const result = JSON.parse(content);
      return res.json(result);
    } catch (error) {
      console.error("Failed to parse OpenAI response as JSON, trying to extract:", error);
      
      // If direct parsing fails, try to extract JSON from the response
      const extractedResult = extractJSON(content);
      console.log("Extracted result:", extractedResult);
      
      return res.json(extractedResult);
    }
  } catch (error) {
    console.error("OpenAI API error:", error);
    return res.status(500).json({ 
      error: error.message,
      fallback: {
        sentiment: "neutral",
        explanation: "Error generating recommendation: " + error.message,
        buyRecommendation: false
      }
    });
  }
});

// Start the server
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/api/health`);
}); 