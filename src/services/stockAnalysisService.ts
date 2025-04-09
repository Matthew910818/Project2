import { analyzeSentiment, combineAnalysis, StockAnalysisResult } from './openaiService';
import { calculateTechnicalIndicators, TechnicalIndicators } from './technicalAnalysisService';
import { 
  sendBuyRecommendationEmail, 
  sendTechnicalAlertEmail, 
  meetsTechnicalCriteria, 
  DEFAULT_TECHNICAL_CRITERIA 
} from './emailService';

export interface AnalysisResponse {
  symbol: string;
  price: number;
  change: number;
  sentimentAnalysis: StockAnalysisResult | null;
  technicalAnalysis: TechnicalIndicators | null;
  finalRecommendation: StockAnalysisResult | null;
  emailSent: boolean;
  technicalAlertSent: boolean;
  metTechnicalCriteria: string[];
  error?: string;
}

const isOpenAIConfigured = (): boolean => {
  const apiKey = process.env.REACT_APP_OPENAI_API_KEY;
  return !!(apiKey && apiKey.trim().length > 0);
};

const getMetCriteriaDescriptions = (
  technicalAnalysis: TechnicalIndicators
): string[] => {
  const metCriteria: string[] = [];
  
  // Check RSI 
  if (technicalAnalysis.rsi != null && 
      technicalAnalysis.rsi < DEFAULT_TECHNICAL_CRITERIA.rsiThreshold!) {
    metCriteria.push(`RSI is ${technicalAnalysis.rsi.toFixed(2)}, below oversold threshold of ${DEFAULT_TECHNICAL_CRITERIA.rsiThreshold}`);
  }
  
  // Check MACD 
  if (technicalAnalysis.macd != null && technicalAnalysis.macd > 0) {
    metCriteria.push(`MACD is positive at ${technicalAnalysis.macd.toFixed(2)}, indicating upward momentum`);
  }
  
  // Check EMA alignment 
  if (technicalAnalysis.ema5 != null && 
      technicalAnalysis.ema10 != null && 
      technicalAnalysis.ema20 != null && 
      technicalAnalysis.ema5 > technicalAnalysis.ema10 && 
      technicalAnalysis.ema10 > technicalAnalysis.ema20) {
    metCriteria.push(`EMAs show uptrend pattern: EMA5 (${technicalAnalysis.ema5.toFixed(2)}) > EMA10 (${technicalAnalysis.ema10.toFixed(2)}) > EMA20 (${technicalAnalysis.ema20.toFixed(2)})`);
  }
  
  // Check Stochastic 
  if (technicalAnalysis.stochasticK != null && 
      technicalAnalysis.stochasticK < DEFAULT_TECHNICAL_CRITERIA.stochasticOversold!) {
    metCriteria.push(`Stochastic K is ${technicalAnalysis.stochasticK.toFixed(2)}, below oversold threshold of ${DEFAULT_TECHNICAL_CRITERIA.stochasticOversold}`);
  }
  
  return metCriteria;
};

export const analyzeStock = async (
  symbol: string,
  price: number,
  change: number,
  shouldSendEmail: boolean = true
): Promise<AnalysisResponse> => {
  try {
    console.log(`Starting analysis for ${symbol} at $${price}`);
    
    // Initialize response object
    const response: AnalysisResponse = {
      symbol,
      price,
      change,
      sentimentAnalysis: null,
      technicalAnalysis: null,
      finalRecommendation: null,
      emailSent: false,
      technicalAlertSent: false,
      metTechnicalCriteria: []
    };
    
    if (!isOpenAIConfigured()) {
      console.warn('OpenAI API key not configured properly. Skipping sentiment analysis.');
      response.error = 'OpenAI API key not configured. Please add your API key to the .env file.';
      response.sentimentAnalysis = {
        sentiment: 'neutral',
        explanation: 'OpenAI API key not configured. Please add your API key to the .env file.',
        buyRecommendation: false
      };
    } else {
      console.log('Performing sentiment analysis...');
      try {
        response.sentimentAnalysis = await analyzeSentiment(symbol);
        console.log('Sentiment analysis complete:', response.sentimentAnalysis);
      } catch (error) {
        console.error('Error during sentiment analysis:', error);
        response.error = `Sentiment analysis failed: ${(error as Error).message}`;
        response.sentimentAnalysis = {
          sentiment: 'neutral',
          explanation: `Error during sentiment analysis: ${(error as Error).message}`,
          buyRecommendation: false
        };
      }
    }
    
    console.log('Calculating technical indicators...');
    try {
      response.technicalAnalysis = await calculateTechnicalIndicators(symbol, price);
      console.log('Technical analysis complete with indicators:', response.technicalAnalysis.indicators);
      
      if (meetsTechnicalCriteria(response.technicalAnalysis)) {
        console.log('Technical criteria met for alert');
        response.metTechnicalCriteria = getMetCriteriaDescriptions(response.technicalAnalysis);
        
        if (shouldSendEmail && response.metTechnicalCriteria.length > 0) {
          console.log('Sending technical alert email...');
          try {
            response.technicalAlertSent = await sendTechnicalAlertEmail(
              symbol,
              price,
              change,
              response.technicalAnalysis,
              response.metTechnicalCriteria
            );
            console.log('Technical alert email sent:', response.technicalAlertSent);
          } catch (error) {
            console.error('Error sending technical alert email:', error);
            if (response.error) {
              response.error += `; Technical alert email failed: ${(error as Error).message}`;
            } else {
              response.error = `Technical alert email failed: ${(error as Error).message}`;
            }
          }
        }
      }
    } catch (error) {
      console.error('Error during technical analysis:', error);
      if (response.error) {
        response.error += `; Technical analysis failed: ${(error as Error).message}`;
      } else {
        response.error = `Technical analysis failed: ${(error as Error).message}`;
      }
    }
    
    if (response.technicalAnalysis) {
      console.log('Generating final recommendation...');
      
      if (!isOpenAIConfigured()) {
        const bullishSignals = response.technicalAnalysis.indicators.filter(signal => 
          signal.toLowerCase().includes('bullish') || 
          signal.toLowerCase().includes('oversold')
        ).length;
        
        const bearishSignals = response.technicalAnalysis.indicators.filter(signal => 
          signal.toLowerCase().includes('bearish') || 
          signal.toLowerCase().includes('overbought')
        ).length;
        
        const buyRecommendation = bullishSignals > bearishSignals;
        const sentiment = buyRecommendation ? 'positive' : 'negative';
        
        response.finalRecommendation = {
          sentiment,
          explanation: `Based on technical analysis (${bullishSignals} bullish vs ${bearishSignals} bearish signals). Note: Sentiment analysis was skipped due to missing OpenAI API key.`,
          buyRecommendation
        };
        
        console.log('Technical-only recommendation generated:', response.finalRecommendation);
      } else {
        try {
          const technicalSummary = response.technicalAnalysis.indicators.join('; ');
          response.finalRecommendation = await combineAnalysis(
            symbol,
            technicalSummary,
            price,
            change
          );
          console.log('Final recommendation:', response.finalRecommendation);
        } catch (error) {
          console.error('Error generating final recommendation:', error);
          if (response.error) {
            response.error += `; Final recommendation failed: ${(error as Error).message}`;
          } else {
            response.error = `Final recommendation failed: ${(error as Error).message}`;
          }
          
          response.finalRecommendation = {
            sentiment: 'neutral',
            explanation: `Could not generate recommendation: ${(error as Error).message}`,
            buyRecommendation: false
          };
        }
      }
    }
    
    if (shouldSendEmail && 
        response.finalRecommendation && 
        response.finalRecommendation.buyRecommendation && 
        response.technicalAnalysis) {
      console.log('Buy recommendation detected, sending email notification...');
      try {
        response.emailSent = await sendBuyRecommendationEmail(
          symbol,
          price,
          change,
          response.finalRecommendation,
          response.technicalAnalysis
        );
        console.log('Email notification sent:', response.emailSent);
      } catch (error) {
        console.error('Error sending email notification:', error);
        if (response.error) {
          response.error += `; Email notification failed: ${(error as Error).message}`;
        } else {
          response.error = `Email notification failed: ${(error as Error).message}`;
        }
      }
    }
    
    return response;
  } catch (error) {
    console.error('Error in stock analysis:', error);
    return {
      symbol,
      price,
      change,
      sentimentAnalysis: null,
      technicalAnalysis: null,
      finalRecommendation: null,
      emailSent: false,
      technicalAlertSent: false,
      metTechnicalCriteria: [],
      error: `Stock analysis failed: ${(error as Error).message}`
    };
  }
}; 