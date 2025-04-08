import WebSocket from 'isomorphic-ws';
import * as protobuf from 'protobufjs';
import { Buffer } from 'buffer/';

// Interface for Yahoo Finance ticker data
export interface YahooTickerData {
  id: string;
  price: number;
  time: number;
  currency: string;
  exchange: string;
  quoteType: number;
  marketHours: number;
  changePercent: number;
  dayVolume: number;
  dayHigh: number;
  dayLow: number;
  change: number;
  shortName: string;
  expireDate?: number;
  openPrice: number;
  previousClose: number;
  strikePrice?: number;
  underlyingSymbol?: string;
  openInterest?: number;
  optionsType?: number;
  miniOption?: number;
  lastSize?: number;
  bid?: number;
  bidSize?: number;
  ask?: number;
  askSize?: number;
  priceHint?: number;
  vol_24hr?: number;
  volAllCurrencies?: number;
  fromcurrency?: string;
  lastMarket?: string;
  circulatingSupply?: number;
  marketcap?: number;
}

// Interface for Yahoo Finance JSON wrapper message
// eslint-disable-next-line @typescript-eslint/no-unused-vars
interface YahooFinanceMessage {
  type: string;
  message: string; // Base64 encoded protobuf message
}

// Interface for the stock data
export interface StockData {
  id: string;
  price: number;
  change: number;
  changePercent: number;
  shortName: string;
  currency: string;
  marketHours: string;
  volume: number;
  dayHigh: number;
  dayLow: number;
  openPrice: number;
  previousClose: number;
  time: Date;
  rawData?: any; // Adding raw data for debugging
}

// Store for raw message logs
export interface MessageLog {
  timestamp: string;
  type: string;
  size: number;
  content?: string;
  parsedData?: any;
}

// WebSocket URL with version parameter
const YAHOO_FINANCE_WS_URL = 'wss://streamer.finance.yahoo.com/';

// Class to handle Yahoo Finance WebSocket connection
export class YahooFinanceService {
  private ws: WebSocket | null = null;
  private subscribers: ((data: StockData) => void)[] = [];
  private yaticker: protobuf.Type | null = null;
  private isConnected = false;
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private symbols: string[] = [];
  private lastMessageTime: number = 0;
  private messageLogs: MessageLog[] = []; // Store message logs
  private maxLogSize = 100; // Maximum number of messages to store
  private wsUrl: string = YAHOO_FINANCE_WS_URL;

  constructor() {
    this.initProtobuf();
  }

  private async initProtobuf() {
    try {
      const root = await protobuf.load(process.env.PUBLIC_URL + '/YPricingData.proto');
      this.yaticker = root.lookupType('yaticker');
    } catch (error) {
      console.error('Failed to load protobuf definition:', error);
    }
  }

  // Get all message logs
  getMessageLogs(): MessageLog[] {
    return this.messageLogs;
  }

  // Clear message logs
  clearMessageLogs(): void {
    this.messageLogs = [];
  }

  // Add a message to the log
  private addMessageLog(log: MessageLog): void {
    this.messageLogs.unshift(log); // Add to beginning of array
    if (this.messageLogs.length > this.maxLogSize) {
      this.messageLogs = this.messageLogs.slice(0, this.maxLogSize);
    }
  }

  // Set the WebSocket URL
  setWebSocketUrl(url: string): void {
    this.wsUrl = url;
    // If already connected, reconnect with the new URL
    if (this.isConnected) {
      this.disconnect();
      this.connect(this.symbols);
    }
  }

  // Get the current WebSocket URL
  getWebSocketUrl(): string {
    return this.wsUrl;
  }

  connect(symbols: string[] = []) {
    if (!this.yaticker) {
      console.error('Protobuf definition not loaded yet');
      return;
    }

    if (this.isConnected) {
      this.disconnect();
    }

    this.symbols = symbols;
    this.clearMessageLogs();
    
    // Log connection attempt
    this.addMessageLog({
      timestamp: new Date().toISOString(),
      type: 'CONNECTION_ATTEMPT',
      size: 0,
      content: `Attempting to connect to ${this.wsUrl} with symbols: ${symbols.join(', ')}`
    });
    
    // Use the updated WebSocket URL 
    this.ws = new WebSocket(this.wsUrl);

    this.ws.onopen = () => {
      console.log('WebSocket connected');
      this.isConnected = true;
      
      // Log connection success
      const timestamp = new Date().toISOString();
      console.log('Connected at:', timestamp);
      this.addMessageLog({
        timestamp,
        type: 'CONNECTION_OPEN',
        size: 0,
        content: `WebSocket connection established successfully to ${this.wsUrl}`
      });
      
      if (this.symbols.length > 0) {
        this.subscribe(this.symbols);
      }
    };

    this.ws.onclose = (event) => {
      console.log('WebSocket disconnected');
      this.isConnected = false;
      
      // Log connection close
      this.addMessageLog({
        timestamp: new Date().toISOString(),
        type: 'CONNECTION_CLOSE',
        size: 0,
        content: `WebSocket closed with code: ${event.code}, reason: ${event.reason || 'No reason provided'}`
      });
      
      // Try to reconnect after a delay
      if (this.reconnectTimeout) {
        clearTimeout(this.reconnectTimeout);
      }
      
      this.reconnectTimeout = setTimeout(() => {
        console.log('Attempting to reconnect...');
        this.connect(this.symbols);
      }, 5000);
    };

    this.ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      
      // Log connection error
      this.addMessageLog({
        timestamp: new Date().toISOString(),
        type: 'CONNECTION_ERROR',
        size: 0,
        content: `WebSocket error: ${JSON.stringify(error)}`
      });
    };

    this.ws.onmessage = (event) => {
      try {
        if (!this.yaticker) return;
        
        // Update last message time
        this.lastMessageTime = Date.now();
        const timestamp = new Date().toISOString();
        
        // Create log entry object
        let logEntry: MessageLog = {
          timestamp,
          type: 'UNKNOWN',
          size: 0
        };
        
        // Log raw data details based on type
        if (typeof event.data === 'string') {
          logEntry.type = 'STRING';
          logEntry.size = event.data.length;
          // For string data, store the entire content if it's not too large
          if (event.data.length < 5000) {
            logEntry.content = event.data;
          } else {
            logEntry.content = `${event.data.substring(0, 500)}... [truncated, total length: ${event.data.length}]`;
          }
          
          // Try to parse as JSON
          try {
            const jsonData = JSON.parse(event.data);
            logEntry.parsedData = jsonData;
            logEntry.type = 'JSON';
            
            // Add log for the JSON message
            this.addMessageLog(logEntry);
            
            // If it's a heartbeat
            if (jsonData.type === 'heartbeat') {
              const heartbeatLog: MessageLog = {
                timestamp,
                type: 'HEARTBEAT',
                size: logEntry.size,
                content: 'Received heartbeat message',
                parsedData: jsonData
              };
              this.addMessageLog(heartbeatLog);
              return;
            }
            
            // Check if it's a wrapped pricing message with base64 data
            if (jsonData.type === 'pricing' && jsonData.message) {
              const decodingLog: MessageLog = {
                timestamp,
                type: 'PRICING_MESSAGE',
                size: jsonData.message.length,
                content: `Processing pricing message with base64 data: ${jsonData.message.substring(0, 50)}...`,
                parsedData: jsonData
              };
              this.addMessageLog(decodingLog);
              
              // Decode the base64 message
              try {
                const base64Data = jsonData.message;
                const messageBuffer = Buffer.from(base64Data, 'base64');
                const decodedData = this.yaticker.decode(messageBuffer) as unknown as YahooTickerData;
                
                // Log successful decode
                const decodedLog: MessageLog = {
                  timestamp,
                  type: 'PROTOBUF_DECODED',
                  size: messageBuffer.length,
                  content: `Successfully decoded protobuf message for symbol: ${decodedData.id}`,
                  parsedData: decodedData
                };
                this.addMessageLog(decodedLog);
                
                // Process the data
                const stockData = this.formatStockData(decodedData);
                stockData.rawData = decodedData;
                this.notifySubscribers(stockData);
              } catch (decodeError) {
                console.error('Failed to decode base64 message data:', decodeError);
                const errorLog: MessageLog = {
                  timestamp,
                  type: 'DECODE_ERROR',
                  size: jsonData.message.length,
                  content: `Failed to decode base64 message data: ${(decodeError as Error).message}`,
                  parsedData: { base64: jsonData.message.substring(0, 100) }
                };
                this.addMessageLog(errorLog);
              }
              return;
            }
            
            // Other JSON message types
            if (jsonData.data) {
              const processedLog: MessageLog = {
                timestamp,
                type: 'JSON_DATA_PROCESSED',
                size: logEntry.size,
                content: `Processed JSON data for type: ${jsonData.type || 'unknown'}`,
                parsedData: jsonData
              };
              this.addMessageLog(processedLog);
              return;
            }
            
            return;
          } catch (e) {
            // Not JSON or JSON parsing failed, continue with protobuf decoding attempt
            console.log('JSON parsing failed, trying direct protobuf decoding');
            const parsingErrorLog: MessageLog = {
              timestamp,
              type: 'JSON_PARSE_ERROR',
              size: event.data.length,
              content: `Failed to parse JSON: ${(e as Error).message}. Trying direct protobuf decoding.`,
              parsedData: { sample: event.data.substring(0, 100) }
            };
            this.addMessageLog(parsingErrorLog);
            
            // Try direct base64 decoding (old format)
            try {
              const directDecodedData = this.yaticker.decode(Buffer.from(event.data, 'base64')) as unknown as YahooTickerData;
              
              // Update log with decoded data
              const decodedLog: MessageLog = {
                timestamp,
                type: 'PROTOBUF_DECODED_DIRECT',
                size: logEntry.size,
                content: `Successfully decoded direct protobuf message for symbol: ${directDecodedData.id}`,
                parsedData: directDecodedData
              };
              this.addMessageLog(decodedLog);
              
              // Process the data
              const stockData = this.formatStockData(directDecodedData);
              stockData.rawData = directDecodedData;
              this.notifySubscribers(stockData);
              return;
              
            } catch (decodeError) {
              console.error('Failed to decode direct base64 data:', decodeError);
              const errorLog: MessageLog = {
                timestamp,
                type: 'DIRECT_DECODE_ERROR',
                size: logEntry.size,
                content: `Failed to decode direct base64 data: ${(decodeError as Error).message}`
              };
              this.addMessageLog(errorLog);
            }
          }
          
        } else if (event.data instanceof ArrayBuffer) {
          logEntry.type = 'ARRAY_BUFFER';
          logEntry.size = event.data.byteLength;
          logEntry.content = `ArrayBuffer of size ${event.data.byteLength} bytes`;
          
          // Log the ArrayBuffer
          this.addMessageLog(logEntry);
          
          // Try to decode ArrayBuffer directly
          try {
            const arrayBufferData = this.yaticker.decode(new Uint8Array(event.data)) as unknown as YahooTickerData;
            
            // Update log with decoded data
            const decodedLog: MessageLog = {
              timestamp,
              type: 'PROTOBUF_DECODED',
              size: logEntry.size,
              content: `Successfully decoded ArrayBuffer for symbol: ${arrayBufferData.id}`,
              parsedData: arrayBufferData
            };
            this.addMessageLog(decodedLog);
            
            // Process the data
            const stockData = this.formatStockData(arrayBufferData);
            stockData.rawData = arrayBufferData;
            this.notifySubscribers(stockData);
          } catch (decodeError) {
            console.error('Failed to decode ArrayBuffer:', decodeError);
            const errorLog: MessageLog = {
              timestamp,
              type: 'DECODE_ERROR',
              size: logEntry.size,
              content: `Failed to decode ArrayBuffer: ${(decodeError as Error).message}`
            };
            this.addMessageLog(errorLog);
          }
          return;
        } else if (event.data instanceof Blob) {
          const blob = event.data as Blob;
          logEntry.type = 'BLOB';
          logEntry.size = blob.size;
          logEntry.content = `Blob of size ${blob.size} bytes`;
          
          // Handle Blob data by reading it as text
          this.addMessageLog(logEntry);
          
          // Try to read blob as text
          const blobReader = new FileReader();
          blobReader.onload = () => {
            const blobText = blobReader.result as string;
            const blobLog: MessageLog = {
              timestamp: new Date().toISOString(),
              type: 'BLOB_READ',
              size: blob.size,
              content: blobText.length < 5000 ? blobText : 
                `${blobText.substring(0, 500)}... [truncated, total length: ${blobText.length}]`
            };
            this.addMessageLog(blobLog);
            
            // Try to parse as JSON
            try {
              const jsonData = JSON.parse(blobText);
              const jsonBlobLog: MessageLog = {
                timestamp: new Date().toISOString(),
                type: 'BLOB_JSON',
                size: blob.size,
                content: `Successfully parsed blob as JSON`,
                parsedData: jsonData
              };
              this.addMessageLog(jsonBlobLog);
              
              // Check if it's a wrapped pricing message with base64 data
              if (jsonData.type === 'pricing' && jsonData.message) {
                try {
                  const base64Data = jsonData.message;
                  const messageBuffer = Buffer.from(base64Data, 'base64');
                  const decodedData = this.yaticker?.decode(messageBuffer) as unknown as YahooTickerData;
                  
                  const protobufBlobLog: MessageLog = {
                    timestamp: new Date().toISOString(),
                    type: 'BLOB_PROTOBUF_DECODED',
                    size: blob.size,
                    content: `Successfully decoded blob pricing message for symbol: ${decodedData.id}`,
                    parsedData: decodedData
                  };
                  this.addMessageLog(protobufBlobLog);
                  
                  // Process the data
                  const stockData = this.formatStockData(decodedData);
                  stockData.rawData = decodedData;
                  this.notifySubscribers(stockData);
                } catch (e) {
                  const errorLog: MessageLog = {
                    timestamp: new Date().toISOString(),
                    type: 'BLOB_DECODE_ERROR',
                    size: blob.size,
                    content: `Failed to decode blob pricing message: ${(e as Error).message}`
                  };
                  this.addMessageLog(errorLog);
                }
                return;
              }
            } catch (e) {
              // Not JSON, try to decode with protobuf directly
              try {
                const blobData = Buffer.from(blobText, 'base64');
                const decodedData = this.yaticker?.decode(blobData) as unknown as YahooTickerData;
                const protobufBlobLog: MessageLog = {
                  timestamp: new Date().toISOString(),
                  type: 'BLOB_PROTOBUF',
                  size: blob.size,
                  content: `Successfully decoded blob with protobuf for symbol: ${decodedData.id}`,
                  parsedData: decodedData
                };
                this.addMessageLog(protobufBlobLog);
                
                // Process the data
                const stockData = this.formatStockData(decodedData);
                stockData.rawData = decodedData;
                this.notifySubscribers(stockData);
              } catch (e) {
                const errorLog: MessageLog = {
                  timestamp: new Date().toISOString(),
                  type: 'BLOB_DECODE_ERROR',
                  size: blob.size,
                  content: `Failed to decode blob: ${(e as Error).message}`
                };
                this.addMessageLog(errorLog);
              }
            }
          };
          
          blobReader.onerror = (err) => {
            const errorLog: MessageLog = {
              timestamp: new Date().toISOString(),
              type: 'BLOB_READ_ERROR',
              size: blob.size,
              content: `Failed to read blob: ${err}`
            };
            this.addMessageLog(errorLog);
          };
          
          blobReader.readAsText(blob);
          return;
        } else {
          logEntry.type = 'UNKNOWN';
          logEntry.content = `Unknown data type: ${typeof event.data}`;
          this.addMessageLog(logEntry);
          return;
        }
        
      } catch (error) {
        console.error('Error processing message:', error);
        console.error('Error details:', (error as Error).message);
        
        // Log the error
        this.addMessageLog({
          timestamp: new Date().toISOString(),
          type: 'PROCESSING_ERROR',
          size: 0,
          content: `Error processing message: ${(error as Error).message}`
        });
      }
    };
  }

  subscribe(symbols: string[]) {
    if (!this.isConnected || !this.ws) {
      this.symbols = symbols;
      return;
    }

    this.symbols = symbols;
    console.log('Subscribing to symbols:', symbols);
    
    // Send subscription message
    const subscriptionMessage = JSON.stringify({
      subscribe: symbols
    });
    
    console.log('Sending subscription message:', subscriptionMessage);
    
    // Log the subscription message
    this.addMessageLog({
      timestamp: new Date().toISOString(),
      type: 'SUBSCRIBE_REQUEST',
      size: subscriptionMessage.length,
      content: subscriptionMessage
    });
    
    this.ws.send(subscriptionMessage);
  }

  disconnect() {
    if (this.ws) {
      // Log disconnection
      this.addMessageLog({
        timestamp: new Date().toISOString(),
        type: 'MANUAL_DISCONNECT',
        size: 0,
        content: 'Manual disconnection requested'
      });
      
      this.ws.close();
      this.ws = null;
      this.isConnected = false;
    }
    
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
  }

  onData(callback: (data: StockData) => void) {
    this.subscribers.push(callback);
    return () => {
      this.subscribers = this.subscribers.filter(cb => cb !== callback);
    };
  }

  // Get the time since last message in seconds
  getTimeSinceLastMessage(): number {
    if (this.lastMessageTime === 0) return -1;
    return (Date.now() - this.lastMessageTime) / 1000;
  }

  private notifySubscribers(data: StockData) {
    this.subscribers.forEach(callback => {
      callback(data);
    });
  }

  private formatStockData(data: YahooTickerData): StockData {
    // Convert market hours enum to string
    let marketHoursStr = 'REGULAR_MARKET';
    if (data.marketHours === 0) marketHoursStr = 'PRE_MARKET';
    else if (data.marketHours === 1) marketHoursStr = 'REGULAR_MARKET';
    else if (data.marketHours === 2) marketHoursStr = 'POST_MARKET';
    else if (data.marketHours === 3) marketHoursStr = 'EXTENDED_HOURS_MARKET';

    // Record the current time for comparison
    const currentTime = new Date();
    let timestamp = data.time ? new Date(data.time * 1000) : currentTime;
    
    // If timestamp is too far in the future (more than 1 day), use current time
    if (timestamp.getTime() - currentTime.getTime() > 24 * 60 * 60 * 1000) {
      console.warn(`Unrealistic timestamp detected for ${data.id}: ${timestamp.toISOString()}, using current time instead`);
      timestamp = currentTime;
    }

    return {
      id: data.id,
      price: data.price,
      change: data.change || 0,
      changePercent: data.changePercent || 0,
      shortName: data.shortName || data.id,
      currency: data.currency || 'USD',
      marketHours: marketHoursStr,
      volume: data.dayVolume || 0,
      dayHigh: data.dayHigh || data.price,
      dayLow: data.dayLow || data.price,
      openPrice: data.openPrice || data.price,
      previousClose: data.previousClose || data.price,
      time: timestamp
    };
  }
}

// Create and export a singleton instance
export const yahooFinanceService = new YahooFinanceService();

export default yahooFinanceService; 