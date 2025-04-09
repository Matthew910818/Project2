import { StockAnalysisResult } from './openaiService';
import { TechnicalIndicators } from './technicalAnalysisService';

export interface EmailConfig {
  recipientEmail: string;
}

const DEFAULT_CONFIG: EmailConfig = {
  recipientEmail: process.env.REACT_APP_EMAIL_RECIPIENT || '',
};
export interface TechnicalAlertCriteria {
  rsiThreshold?: number;      
  macdPositive?: boolean;     
  emaAlignment?: boolean;      
  stochasticOversold?: number;
}

export const DEFAULT_TECHNICAL_CRITERIA: TechnicalAlertCriteria = {
  rsiThreshold: 30,
  macdPositive: true,
  emaAlignment: true,
  stochasticOversold: 20
};

export const meetsTechnicalCriteria = (
  technicalAnalysis: TechnicalIndicators,
  criteria: TechnicalAlertCriteria = DEFAULT_TECHNICAL_CRITERIA
): boolean => {
  let criteriaCount = 0;
  let metCount = 0;
  
  // Check RSI (oversold condition)
  if (criteria.rsiThreshold !== undefined && technicalAnalysis.rsi != null) {
    criteriaCount++;
    if (technicalAnalysis.rsi < criteria.rsiThreshold) {
      metCount++;
    }
  }
  
  // Check MACD 
  if (criteria.macdPositive && technicalAnalysis.macd != null) {
    criteriaCount++;
    if (technicalAnalysis.macd > 0) {
      metCount++;
    }
  }
  
  // Check EMA alignment
  if (criteria.emaAlignment && 
      technicalAnalysis.ema5 != null && 
      technicalAnalysis.ema10 != null && 
      technicalAnalysis.ema20 != null) {
    criteriaCount++;
    if (technicalAnalysis.ema5 > technicalAnalysis.ema10 && 
        technicalAnalysis.ema10 > technicalAnalysis.ema20) {
      metCount++;
    }
  }
  
  // Check Stochastic 
  if (criteria.stochasticOversold !== undefined && 
      technicalAnalysis.stochasticK != null) {
    criteriaCount++;
    if (technicalAnalysis.stochasticK < criteria.stochasticOversold) {
      metCount++;
    }
  }
  return criteriaCount > 0 && (metCount / criteriaCount) >= 0.5;
};

export const sendTechnicalAlertEmail = async (
  symbol: string,
  price: number,
  change: number,
  technicalAnalysis: TechnicalIndicators,
  metCriteria: string[],
  config: EmailConfig = DEFAULT_CONFIG
): Promise<boolean> => {
  try {
    const subject = `Technical Alert: ${symbol} at $${price.toFixed(2)}`;
    const text = `Technical Analysis Alert for ${symbol}
    Current Price: $${price.toFixed(2)} (${change >= 0 ? '+' : ''}${change.toFixed(2)}%)
    
    Alert Triggered - The following technical conditions have been met:
    ${metCriteria.join(', ')}
    
    Technical Indicators:
    - Stochastic K: ${technicalAnalysis.stochasticK?.toFixed(2) || 'N/A'}
    - Stochastic D: ${technicalAnalysis.stochasticD?.toFixed(2) || 'N/A'}
    - RSI: ${technicalAnalysis.rsi?.toFixed(2) || 'N/A'}
    - EMA 5: ${technicalAnalysis.ema5?.toFixed(2) || 'N/A'}
    - EMA 10: ${technicalAnalysis.ema10?.toFixed(2) || 'N/A'}
    - EMA 20: ${technicalAnalysis.ema20?.toFixed(2) || 'N/A'}
    - MACD: ${technicalAnalysis.macd?.toFixed(2) || 'N/A'}
    `;
    
    const html = `
      <h2>Technical Analysis Alert for ${symbol}</h2>
      <p>Current Price: $${price.toFixed(2)} (${change >= 0 ? '+' : ''}${change.toFixed(2)}%)</p>
      
      <h3>Alert Triggered</h3>
      <p>The following technical conditions have been met:</p>
      <ul>
        ${metCriteria.map(criterion => `<li>${criterion}</li>`).join('')}
      </ul>
      
      <h3>Technical Indicators</h3>
      <ul>
        <li>Stochastic K: ${technicalAnalysis.stochasticK?.toFixed(2) || 'N/A'}</li>
        <li>Stochastic D: ${technicalAnalysis.stochasticD?.toFixed(2) || 'N/A'}</li>
        <li>RSI: ${technicalAnalysis.rsi?.toFixed(2) || 'N/A'}</li>
        <li>EMA 5: ${technicalAnalysis.ema5?.toFixed(2) || 'N/A'}</li>
        <li>EMA 10: ${technicalAnalysis.ema10?.toFixed(2) || 'N/A'}</li>
        <li>EMA 20: ${technicalAnalysis.ema20?.toFixed(2) || 'N/A'}</li>
        <li>MACD: ${technicalAnalysis.macd?.toFixed(2) || 'N/A'}</li>
      </ul>
      
      <h3>Trading Signals</h3>
      <ul>
        ${technicalAnalysis.indicators.map(indicator => `<li>${indicator}</li>`).join('')}
      </ul>
      
      <p>This alert was generated automatically by your Stock Price Tracker application.</p>
    `;

    console.log(`Sending technical alert email with subject: ${subject}`);
    
    const response = await fetch('http://localhost:4000/api/send-email', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        subject,
        text,
        html,
        recipientEmail: config.recipientEmail
      })
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`Email API responded with status: ${response.status}. ${errorData.error || ''}`);
    }
    
    const result = await response.json();
    console.log('Email notification result:', result);
    
    return true;
  } catch (error) {
    console.error('Failed to send email notification:', error);
    return false;
  }
};

export const sendBuyRecommendationEmail = async (
  symbol: string,
  price: number,
  change: number,
  sentimentAnalysis: StockAnalysisResult,
  technicalAnalysis: TechnicalIndicators,
  config: EmailConfig = DEFAULT_CONFIG
): Promise<boolean> => {
  try {
    const technicalIndicatorsStr = technicalAnalysis.indicators.join('\n- ');
    const subject = `Buy Recommendation Alert: ${symbol} at $${price.toFixed(2)}`;
    const text = `Buy Recommendation for ${symbol}
    Current Price: $${price.toFixed(2)} (${change >= 0 ? '+' : ''}${change.toFixed(2)}%)
    
    Sentiment Analysis:
    Overall Sentiment: ${sentimentAnalysis.sentiment}
    Explanation: ${sentimentAnalysis.explanation}
    
    Technical Indicators:
    - Stochastic K: ${technicalAnalysis.stochasticK?.toFixed(2) || 'N/A'}
    - Stochastic D: ${technicalAnalysis.stochasticD?.toFixed(2) || 'N/A'}
    - RSI: ${technicalAnalysis.rsi?.toFixed(2) || 'N/A'}
    - EMA 5: ${technicalAnalysis.ema5?.toFixed(2) || 'N/A'}
    - EMA 10: ${technicalAnalysis.ema10?.toFixed(2) || 'N/A'}
    - EMA 20: ${technicalAnalysis.ema20?.toFixed(2) || 'N/A'}
    - MACD: ${technicalAnalysis.macd?.toFixed(2) || 'N/A'}
    
    Trading Signals:
    - ${technicalIndicatorsStr.replace(/\n- /g, '\n- ')}
    `;
    
    const html = `
      <h2>Buy Recommendation for ${symbol}</h2>
      <p>Current Price: $${price.toFixed(2)} (${change >= 0 ? '+' : ''}${change.toFixed(2)}%)</p>
      
      <h3>Sentiment Analysis</h3>
      <p><strong>Overall Sentiment:</strong> ${sentimentAnalysis.sentiment}</p>
      <p><strong>Explanation:</strong> ${sentimentAnalysis.explanation}</p>
      
      <h3>Technical Analysis</h3>
      <p><strong>Indicators:</strong></p>
      <ul>
        <li>Stochastic K: ${technicalAnalysis.stochasticK?.toFixed(2) || 'N/A'}</li>
        <li>Stochastic D: ${technicalAnalysis.stochasticD?.toFixed(2) || 'N/A'}</li>
        <li>RSI: ${technicalAnalysis.rsi?.toFixed(2) || 'N/A'}</li>
        <li>EMA 5: ${technicalAnalysis.ema5?.toFixed(2) || 'N/A'}</li>
        <li>EMA 10: ${technicalAnalysis.ema10?.toFixed(2) || 'N/A'}</li>
        <li>EMA 20: ${technicalAnalysis.ema20?.toFixed(2) || 'N/A'}</li>
        <li>MACD: ${technicalAnalysis.macd?.toFixed(2) || 'N/A'}</li>
      </ul>
      
      <p><strong>Trading Signals:</strong></p>
      <ul>
        <li>${technicalIndicatorsStr.replace(/\n- /g, '</li><li>')}</li>
      </ul>
      
      <p>This recommendation was generated automatically by your Stock Price Tracker application.</p>
    `;

    console.log(`Sending buy recommendation email with subject: ${subject}`);
    
    const response = await fetch('http://localhost:4000/api/send-email', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        subject,
        text,
        html,
        recipientEmail: config.recipientEmail
      })
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`Email API responded with status: ${response.status}. ${errorData.error || ''}`);
    }
    
    const result = await response.json();
    console.log('Email notification result:', result);
    
    return true;
  } catch (error) {
    console.error('Failed to send email notification:', error);
    return false;
  }
}; 