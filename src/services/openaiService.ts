// OpenAI service using backend API

// Simple interface for stock analysis results
export interface StockAnalysisResult {
  sentiment: string;
  explanation: string;
  buyRecommendation: boolean;
}

// API URL
const API_URL = 'http://localhost:4000/api';

// Analyze sentiment for a stock symbol
export const analyzeSentiment = async (symbol: string): Promise<StockAnalysisResult> => {
  // Default response if API fails
  const defaultResponse: StockAnalysisResult = {
    sentiment: "neutral",
    explanation: "Unable to analyze sentiment at this time.",
    buyRecommendation: false
  };
  
  try {
    // Call backend API
    const response = await fetch(`${API_URL}/analyze-sentiment`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ symbol }),
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      console.error('API error:', errorData);
      
      // Use fallback data if provided by the server
      if (errorData.fallback) {
        return errorData.fallback;
      }
      
      return defaultResponse;
    }
    
    // Parse the result
    const result = await response.json();
    return result;
  } catch (error) {
    console.error("Error analyzing sentiment:", error);
    return defaultResponse;
  }
};

// Combine technical analysis with sentiment
export const combineAnalysis = async (
  symbol: string, 
  technicalAnalysis: string, 
  price: number,
  change: number
): Promise<StockAnalysisResult> => {
  // Default response if API fails
  const defaultResponse: StockAnalysisResult = {
    sentiment: "neutral",
    explanation: "Unable to generate recommendation at this time.",
    buyRecommendation: false
  };
  
  try {
    // Call backend API
    const response = await fetch(`${API_URL}/combine-analysis`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ 
        symbol, 
        technicalAnalysis, 
        price, 
        change 
      }),
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      console.error('API error:', errorData);
      
      // Use fallback data if provided by the server
      if (errorData.fallback) {
        return errorData.fallback;
      }
      
      return defaultResponse;
    }
    
    // Parse the result
    const result = await response.json();
    return result;
  } catch (error) {
    console.error("Error generating recommendation:", error);
    return defaultResponse;
  }
}; 