const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', 'arbitrage-bot', '.env') });

const { Server } = require('socket.io');
const os = require('os');
const { ethers } = require('ethers');
const fs = require('fs');
const express = require('express');
const http = require('http');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "http://localhost:3000",
    methods: ["GET", "POST"]
  }
});

// Store connected clients
let connectedClients = new Set();

io.on('connection', (socket) => {
  console.log('Client connected');
  connectedClients.add(socket);

  socket.on('disconnect', () => {
    console.log('Client disconnected');
    connectedClients.delete(socket);
  });
});

// Function to broadcast updates to all connected clients
const broadcastUpdate = (eventName, data) => {
  connectedClients.forEach(socket => {
    socket.emit(eventName, data);
  });
};

// Add POST endpoint to receive updates from the bot
app.post('/update', (req, res) => {
  const { eventName, data } = req.body;
  if (!eventName || !data) {
    return res.status(400).json({ error: 'Missing eventName or data' });
  }
  
  // Broadcast the update to all connected clients
  broadcastUpdate(eventName, data);
  
  res.json({ success: true });
});

// Expose broadcast function
app.broadcastUpdate = broadcastUpdate;

// Initialize Ethereum provider
let provider;
try {
  if (process.env.ETHEREUM_WS_URL) {
    provider = new ethers.providers.WebSocketProvider(process.env.ETHEREUM_WS_URL);
    console.log('Connected to Ethereum WebSocket provider');
  } else {
    console.log('No ETHEREUM_WS_URL provided. Block updates will be disabled.');
  }
} catch (error) {
  console.error('Failed to connect to Ethereum WebSocket provider:', error.message);
  console.log('Block updates will be disabled.');
}

// Track active markets and transactions
let activeMarkets = new Map();
let transactions = new Map();
let profitHistory = [];
let lastMarketUpdate = new Date().toLocaleTimeString();
let totalMarketsCount = 0;
let activeMarketsCount = 0;

// Function to get real system status
function getSystemStatus() {
  const cpus = os.cpus();
  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  
  const cpuUsage = cpus.reduce((acc, cpu) => {
    const total = Object.values(cpu.times).reduce((a, b) => a + b);
    const idle = cpu.times.idle;
    return acc + ((total - idle) / total) * 100;
  }, 0) / cpus.length;

  return {
    cpuUsage: Math.round(cpuUsage * 10) / 10,
    memoryUsage: Math.round(((totalMem - freeMem) / totalMem) * 1000) / 10,
    uptime: Math.floor(os.uptime()),
    lastBlock: 0  // Will be updated by block listener
  };
}

// Function to parse market updates from bot output
function updateMarketMetrics(line) {
  // Parse total markets
  const totalMarketsMatch = line.match(/Updating reserves for (\d+) markets/);
  if (totalMarketsMatch) {
    totalMarketsCount = parseInt(totalMarketsMatch[1]);
  }

  // Parse filtered/active markets
  const activeMarketsMatch = line.match(/Filtered pairs for arbitrage calculation: (\d+)/);
  if (activeMarketsMatch) {
    activeMarketsCount = parseInt(activeMarketsMatch[1]);
  }

  // Update timestamp whenever we get new market data
  if (totalMarketsMatch || activeMarketsMatch) {
    lastMarketUpdate = new Date().toLocaleTimeString();
    
    // Emit updated metrics to all connected clients
    io.emit('marketMetrics', {
      totalMarkets: totalMarketsCount,
      activeMarkets: activeMarketsCount,
      lastUpdate: lastMarketUpdate
    });
  }
}

// Watch bot log file for updates
function watchBotLog() {
  const logPath = path.join(__dirname, '..', 'output.log');
  
  // Create file if it doesn't exist
  if (!fs.existsSync(logPath)) {
    fs.writeFileSync(logPath, '');
  }

  // Watch for changes
  fs.watchFile(logPath, { interval: 1000 }, (curr, prev) => {
    if (curr.size > prev.size) {
      const buffer = Buffer.alloc(curr.size - prev.size);
      const fd = fs.openSync(logPath, 'r');
      fs.readSync(fd, buffer, 0, buffer.length, prev.size);
      fs.closeSync(fd);
      
      const newLines = buffer.toString().split('\n');
      newLines.forEach(line => {
        if (line.trim()) {
          updateMarketMetrics(line);
        }
      });
    }
  });
}

// Function to parse bot logs
function parseBotLogs() {
  try {
    const logPath = path.join(__dirname, '..', 'bot.log');
    if (!fs.existsSync(logPath)) {
      console.log('No bot.log file found. Will create when bot starts logging.');
      return;
    }
    
    const logs = fs.readFileSync(logPath, 'utf8').split('\n');
    
    // Process last 1000 lines at most
    const recentLogs = logs.slice(-1000);
    
    recentLogs.forEach(line => {
      if (!line.trim()) return;
      
      // Update market metrics from log lines
      updateMarketMetrics(line);
      
      try {
        // Skip lines that don't look like JSON
        if (!line.startsWith('{')) return;
        
        const log = JSON.parse(line);
        
        // Handle different log types
        switch (log.type) {
          case 'MARKET_UPDATE':
            lastMarketUpdate = new Date().toLocaleTimeString();
            break;
          
          case 'TRANSACTION':
            transactions.set(log.hash, {
              hash: log.hash,
              type: log.transactionType,
              timestamp: new Date(log.timestamp).toLocaleTimeString(),
              status: log.status,
              profit: log.profit?.toString() || '0'
            });
            
            if (log.profit) {
              profitHistory.push({
                timestamp: new Date(log.timestamp).toLocaleTimeString(),
                profit: parseFloat(ethers.utils.formatEther(log.profit))
              });
            }
            break;
        }
      } catch (e) {
        // Silently skip invalid JSON lines
        return;
      }
    });
  } catch (e) {
    console.error('Error reading bot logs:', e);
  }
}

// Initialize data on startup
parseBotLogs();

// Watch for new bot log entries
const logWatcher = fs.watch(path.join(__dirname, '..', 'bot.log'), (eventType) => {
  if (eventType === 'change') {
    parseBotLogs();
  }
});

// Initialize WebSocket connections
io.on('connection', (socket) => {
  console.log('Client connected');
  
  // Send initial data
  socket.emit('systemStatus', getSystemStatus());
  socket.emit('marketMetrics', {
    totalMarkets: totalMarketsCount,
    activeMarkets: activeMarketsCount,
    lastUpdate: lastMarketUpdate
  });
  
  // Set up periodic updates
  const statusInterval = setInterval(() => {
    socket.emit('systemStatus', getSystemStatus());
  }, 1000);
  
  socket.on('disconnect', () => {
    clearInterval(statusInterval);
    console.log('Client disconnected');
  });
});

// Start watching bot log
watchBotLog();

// Cleanup on exit
process.on('SIGINT', () => {
  logWatcher.close();
  if (provider) {
    provider.removeAllListeners();
  }
  process.exit();
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

module.exports = { app, broadcastUpdate }; 