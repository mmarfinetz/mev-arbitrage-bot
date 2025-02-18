# Ethereum MEV Arbitrage Bot

A sophisticated Ethereum arbitrage bot designed to identify and execute profitable trades across decentralized exchanges (DEXes), specifically focusing on Uniswap V2 and its forks. The bot leverages Flashbots to submit transaction bundles, mitigating front-running risks and potentially increasing the chances of successful arbitrage execution.

## Key Features

- **Market Monitoring**: Monitors multiple Uniswap V2-style DEXes for price discrepancies
- **Real-time Updates**: Supports both polling and WebSocket connections for market data
- **Flash Loan Integration**: Uses Aave V3 flash loans for capital-efficient arbitrage
- **Flashbots Integration**: Protects trades from front-running via Flashbots bundles
- **Gas Optimization**: Dynamic gas price adjustment based on network conditions
- **Circuit Breaker**: Prevents excessive failed transactions
- **Extensive Logging**: Detailed operation and error logging

## Prerequisites

- Node.js (v14 or higher)
- npm or yarn
- An Ethereum node (RPC endpoint)
- Flashbots relay access
- (Optional) WebSocket-enabled Ethereum node

## Installation

1. Clone the repository:
```bash
git clone https://github.com/0xmarf/mev-arbitrage-bot.git
cd mev-arbitrage-bot
```

2. Install dependencies:
```bash
npm install
```

3. Create a `.env` file in the root directory:
```env
ETHEREUM_RPC_URL=your_ethereum_rpc_url
WEBSOCKET_URL=your_websocket_url  # Optional
PRIVATE_KEY=your_private_key
FLASHBOTS_RELAY_SIGNING_KEY=your_flashbots_key
```

## Configuration

Adjust the following configuration files according to your needs:

- `src/config/config.ts`: Main configuration parameters
- `src/config/thresholds.ts`: Market filtering thresholds
- `hardhat.config.ts`: Network configuration for contract deployment

## Usage

### Standard JSON-RPC Mode
```bash
npm run start
```

### WebSocket Mode
```bash
npm run start:ws
```

### MEV-Share Mode
```bash
npm run start:mevshare
```

### Deploy Contracts
```bash
npx hardhat run scripts/deploy.ts --network <network>
```

## Architecture

The bot consists of several key components:

- **Smart Contracts**: `BundleExecutor.sol` and `FlashLoanExecutor.sol`
- **Market Monitoring**: `UniswapV2EthPair.ts` and WebSocket manager
- **Arbitrage Logic**: `Arbitrage.ts` and optimization algorithms
- **Services**: MEV-Share, Multicall, and Cache services
- **Utilities**: Circuit breaker, gas price manager, and logging

## Testing

Run the test suite:
```bash
npm test
```

## Security

- Never commit private keys or sensitive data
- Use environment variables for sensitive configuration
- Regularly update dependencies
- Consider running security audits before mainnet deployment

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Disclaimer

This software is for educational purposes only. Use at your own risk. The authors take no responsibility for financial losses incurred through the use of this software. 