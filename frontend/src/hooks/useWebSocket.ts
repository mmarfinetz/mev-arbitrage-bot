import { useEffect, useState } from 'react';
import io, { Socket } from 'socket.io-client';

interface SystemStatus {
  cpuUsage: number;
  memoryUsage: number;
  uptime: number;
  lastBlock: number;
}

interface MarketMetrics {
  totalMarkets: number;
  activeMarkets: number;
  lastUpdate: string;
}

interface Transaction {
  hash: string;
  type: string;
  timestamp: string;
  status: string;
  profit: string;
}

interface ProfitData {
  timestamp: string;
  profit: number;
}

interface BlockData {
  number: number;
  timestamp: string;
}

interface WebSocketData {
  systemStatus: SystemStatus | null;
  marketMetrics: MarketMetrics | null;
  transactions: Transaction[];
  profitData: ProfitData[];
  latestBlock: BlockData | null;
  connected: boolean;
}

const SOCKET_URL = 'http://localhost:3001';

export function useWebSocket(): WebSocketData {
  const [systemStatus, setSystemStatus] = useState<SystemStatus | null>(null);
  const [marketMetrics, setMarketMetrics] = useState<MarketMetrics | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [profitData, setProfitData] = useState<ProfitData[]>([]);
  const [latestBlock, setLatestBlock] = useState<BlockData | null>(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const socket = io(SOCKET_URL);

    socket.on('connect', () => {
      console.log('Connected to WebSocket server');
      setConnected(true);
    });

    socket.on('disconnect', () => {
      console.log('Disconnected from WebSocket server');
      setConnected(false);
    });

    socket.on('systemStatus', (data: SystemStatus) => {
      setSystemStatus(data);
    });

    socket.on('marketMetrics', (data: MarketMetrics) => {
      setMarketMetrics(data);
    });

    socket.on('transaction', (data: Transaction) => {
      setTransactions(prev => [...prev.slice(-99), data]);
    });

    socket.on('profit', (data: ProfitData) => {
      setProfitData(prev => [...prev.slice(-49), data]);
    });

    socket.on('newBlock', (data: BlockData) => {
      setLatestBlock(data);
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  return {
    systemStatus,
    marketMetrics,
    transactions,
    profitData,
    latestBlock,
    connected
  };
} 