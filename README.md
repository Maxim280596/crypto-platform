# Crypto-Platform Smart Contracts

This project represents a blockchain-based freelance marketplace, where users can create and fulfill freelance orders. The key functionalities of the contract include:

1. **Order Creation**: Users can create new freelance orders, specifying details such as title, description, deadline, and payment.

2. **Selection of Freelancers**: Clients can assign freelancers to their orders, indicating the freelancer's address and defining the terms and price for the completion.

3. **Approval of Completion**: After the work is completed, clients can approve the order, leading to the payment of the reward to the freelancer and the payment of the platform fee.

4. **Judicial Review**: In case of disputes that cannot be automatically resolved, a judge can review the case and determine the distribution of funds.

5. **Token Management**: The platform supports multiple tokens for payment, which can be used for transactions.

6. **Commission and Payments**: Setting a commission for platform usage.

7. **Role Management and Security**: Defining roles, such as administrator and judge, to manage the platform and resolve conflicts.

8. **Pause and Resume**: The ability to suspend and resume platform operations in case of emergencies.

9. **Addition and Removal of Tokens**: Administrators can manage the list of supported tokens for transactions on the platform.

This contract is designed for efficient and secure management of freelance projects, where transactions and dispute resolutions are conducted using blockchain technology.

## CryptoPlatform SC Docs

### Read Methods:

1. **getPaymentTokens()**
   Description: Retrieves the list of payment tokens supported by the platform.
   Return Type: address[] memory

2. **getCustomerActiveOrders(address \_customer)**
   Description: Returns the array of active order IDs for a given customer.
   Parameters: \_customer - Customer's address.
   Return Type: uint256[] memory

3. **getContractorActiveOrders(address \_contractor)**
   Description: Returns the array of active order IDs for a given contractor.
   Parameters: \_contractor - Contractor's address.
   Return Type: uint256[] memory

## Technical Stack

- Solidity
- Hardhat
- JavaScript
- TypeScript
- Ethers.js
- solidity-coverage
- Mocha
- Chai

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
- **DEFAULT_ADMIN_ADDRESS** - Feature admin of CryptoPlatform SC.
- **FEE_RECEIVER_ADDRESS** - Address that will be receive project fees.
- **FEE_PERCENT** - Percent of fee that will be taken from each order. From 0 to 10000. 100% = 10000.

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

### Deployment CryptoPlatform

To deploy contracts you need set up `.env`

- **PRIVATE_KEY** - Private key of wallet that will be used for deployment.
- **[Network]\_API_KEY** - Api key for smart contracts auto verification on blockchain explorers.
- **[Network]\_MAINNET_URL** - rpc for mainnet network.
- **[Network]\_TESTNET_URL** - rpc for testnet network.
- **DEFAULT_ADMIN_ADDRESS** - Feature admin of CryptoPlatform SC.
- **FEE_RECEIVER_ADDRESS** - Address that will be receive project fees.
- **FEE_PERCENT** - Percent of fee that will be taken from each order. From 0 to 10000. 100% = 10000.

run:

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
