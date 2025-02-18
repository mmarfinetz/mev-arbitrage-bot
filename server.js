const { Server } = require('socket.io');
const { io: ioClient } = require('socket.io-client');
const os = require('os');

// Create WebSocket server for frontend
const io = new Server(3001, {
  cors: {
    origin: "http://localhost:3000",
    methods: ["GET", "POST"]
  }
});

// Connect to the bot's WebSocket server
const botSocket = ioClient('http://localhost:8545');

// Store connected frontend clients
const clients = new Set();

function getSystemStatus() {
  const cpus = os.cpus();
  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  
  return {
    cpuUsage: Math.round(cpus.reduce((acc, cpu) => {
      const total = Object.values(cpu.times).reduce((a, b) => a + b);
      const idle = cpu.times.idle;
      return acc + ((total - idle) / total) * 100;
    }, 0) / cpus.length),
    memoryUsage: Math.round(((totalMem - freeMem) / totalMem) * 100),
    uptime: Math.floor(os.uptime()),
    lastBlock: 0 // Will be updated by bot
  };
}

// Handle frontend client connections
io.on('connection', (socket) => {
  console.log('Frontend client connected');
  clients.add(socket);

  // Send initial system status
  socket.emit('systemStatus', getSystemStatus());

  // Clean up on disconnect
  socket.on('disconnect', () => {
    console.log('Frontend client disconnected');
    clients.delete(socket);
  });
});

// Handle bot events
botSocket.on('connect', () => {
  console.log('Connected to bot WebSocket');
});

botSocket.on('disconnect', () => {
  console.log('Disconnected from bot WebSocket');
});

// Forward bot events to all connected frontend clients
botSocket.on('marketMetrics', (data) => {
  clients.forEach(client => client.emit('marketMetrics', data));
});

botSocket.on('transaction', (data) => {
  clients.forEach(client => client.emit('transaction', data));
});

botSocket.on('profit', (data) => {
  clients.forEach(client => client.emit('profit', data));
});

botSocket.on('newBlock', (data) => {
  const status = getSystemStatus();
  status.lastBlock = data.number;
  clients.forEach(client => {
    client.emit('systemStatus', status);
  });
});

// Update system status periodically
setInterval(() => {
  const status = getSystemStatus();
  clients.forEach(client => client.emit('systemStatus', status));
}, 2000);

console.log('WebSocket server running on port 3001'); 