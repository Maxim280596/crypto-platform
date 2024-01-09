# Crypto-Platform Smart Contracts


## Technical Stack

- Solidity
- Hardhat
- JavaScript
- TypeScript
- Ethers.js
- solidity-coverage
- Mocha
- Chai

## Smart Contracts Overview



## Installation

It is recommended to install [Yarn](https://classic.yarnpkg.com) through the `npm` package manager, which comes bundled with [Node.js](https://nodejs.org) when you install it on your system. It is recommended to use a Node.js version `>= 16.0.0`.

Once you have `npm` installed, you can run the following both to install and upgrade Yarn:

```bash
npm install --global yarn
```

After having installed Yarn, simply run:

```bash
yarn install
```

## `.env` File

In the `.env` file place the private key of your wallet in the `PRIVATE_KEY` section. This allows secure access to your wallet to use with both testnet and mainnet funds during Hardhat deployments. For more information on how this works, please read the documentation of the `npm` package [`dotenv`](https://www.npmjs.com/package/dotenv).

### `.env` variables list

- **PRIVATE_KEY** - Private key of wallet that will be used for deployment.
- **[Network]\_API_KEY** - Api key for smart contracts auto verification on blockchain explorers.
- **[Network]\_MAINNET_URL** - rpc for mainnet network.
- **[Network]\_TESTNET_URL** - rpc for testnet network.

You can see an example of the `.env` file in the `.env.example` file.

## Contracts

Project smart contracts:

### Testing

1. To run TypeScript tests:

```bash
yarn test:hh
```

2. To run tests and view coverage :

```bash
yarn coverage
```

### Compilation

```bash
yarn compile
```

### Deployment

To deploy contracts you need set up `.env` file and run:

```bash
yarn deploy:[network]
```

or

```bash
npx hardhat run --network [Network] scripts/deploy.ts
```



## Contract Verification

Change the contract address to your contract after the deployment has been successful. This works for both testnet and mainnet. You will need to get an API key from [etherscan](https://etherscan.io), [snowtrace](https://snowtrace.io) etc.

**Example:**

```bash
npx hardhat verify --network [network] --constructor-args [...args] <YOUR_CONTRACT_ADDRESS>
```
