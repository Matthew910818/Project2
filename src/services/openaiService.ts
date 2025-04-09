export interface StockAnalysisResult {
  sentiment: string;
  explanation: string;
  buyRecommendation: boolean;
}

const API_URL = 'http://localhost:4000/api';

export const analyzeSentiment = async (symbol: string): Promise<StockAnalysisResult> => {
  const defaultResponse: StockAnalysisResult = {
    sentiment: "neutral",
    explanation: "Unable to analyze sentiment at this time.",
    buyRecommendation: false
  };
  
  try {
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
      
      if (errorData.fallback) {
        return errorData.fallback;
      }
      
      return defaultResponse;
    }
    
    const result = await response.json();
    return result;
  } catch (error) {
    console.error("Error analyzing sentiment:", error);
    return defaultResponse;
  }
};

export const combineAnalysis = async (
  symbol: string, 
  technicalAnalysis: string, 
  price: number,
  change: number
): Promise<StockAnalysisResult> => {
  const defaultResponse: StockAnalysisResult = {
    sentiment: "neutral",
    explanation: "Unable to generate recommendation at this time.",
    buyRecommendation: false
  };
  
  try {
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
      
      if (errorData.fallback) {
        return errorData.fallback;
      }
      
      return defaultResponse;
    }
    
    const result = await response.json();
    return result;
  } catch (error) {
    console.error("Error generating recommendation:", error);
    return defaultResponse;
  }
}; 