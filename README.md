# Stock Price Tracker

A real-time stock price tracking application with AI-powered analysis and alert system.

## Features

- Real-time stock price tracking
- Portfolio management with purchase tracking
- Technical analysis with multiple indicators (RSI, Stochastic, MACD, EMA)
- AI-powered sentiment analysis and recommendations
- Alert system for technical indicator triggers
- Email notifications

## Setup Instructions

### Prerequisites

- Node.js (v14+)
- NPM or Yarn

### Installation

1. Clone the repository:
   ```
   git clone https://github.com/Matthew910818/Project2.git
   cd Project2
   ```

2. Install dependencies for both frontend and backend:
   ```
   # Install frontend dependencies
   npm install
   
   # Install backend dependencies
   cd server
   npm install
   cd ..
   ```

3. Environment Setup:
   - Copy `.env.example` to `.env`
   - Fill in your API keys and configuration settings
   ```
   cp .env.example .env
   ```

4. Start the backend server:
   ```
   cd server
   npm start
   ```

5. In a new terminal, start the frontend application:
   ```
   npm start
   ```

### Environment Variables

The application uses a single `.env` file at the root of the project for both frontend and backend configuration:

- **OpenAI API Keys**
  - `REACT_APP_OPENAI_API_KEY` - Used by frontend
  - `OPENAI_API_KEY` - Used by backend

- **Technical Analysis Settings**
  - `REACT_APP_RSI_THRESHOLD` - RSI level for alerts (default: 30)
  - `REACT_APP_STOCHASTIC_THRESHOLD` - Stochastic level for alerts (default: 20)
  - `REACT_APP_USE_EMA_ALIGNMENT` - Whether to check EMA alignment (default: true)
  - `REACT_APP_USE_MACD_POSITIVE` - Whether to check MACD signal (default: true)

- **Email Configuration**
  - `REACT_APP_EMAIL_RECIPIENT` - Default email recipient for frontend
  - `SENDGRID_API_KEY` - SendGrid API key for email notifications
  - `SENDER_EMAIL` - Sender email address
  - `RECIPIENT_EMAIL` - Default recipient email address

- **Server Configuration**
  - `PORT` - Backend server port (default: 4000)

## Development

### Project Structure

- `/public` - Static assets
- `/src` - Frontend React code
  - `/components` - React components
  - `/services` - Service modules for data handling
- `/server` - Backend Node.js server
  - `server.js` - Express server setup
  - `database.js` - SQLite database operations
