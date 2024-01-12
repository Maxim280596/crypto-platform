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

#### `getPaymentTokens()`

- **Description:** Retrieves the list of payment tokens supported by the platform.
- **Return Type:** `address[] memory`

#### `getCustomerActiveOrders(address _customer)`

- **Description:** Returns the array of active order IDs for a given customer.
- **Parameters:** `_customer` - Customer's address.
- **Return Type:** `uint256[] memory`

#### `getContractorActiveOrders(address _contractor)`

- **Description:** Returns the array of active order IDs for a given contractor.
- **Parameters:** `_contractor` - Contractor's address.
- **Return Type:** `uint256[] memory`

### Write Methods:

#### `createOrder(address _paymentToken, string memory _title, string memory _descriptionLink)`

- **Description:** Creates a new freelance order.
- **Parameters:**
  - `_paymentToken` - Payment token address.
  - `_title` - Order title.
  - `_descriptionLink` - IPFS link to order description.
- **Access Control:** Public
- **Modifier:** `whenNotPaused`
- **Emits Event:** `OrderCreated`

#### `startOrderExecution(uint256 _orderId, address _contractor, uint32 _deadline, uint256 _price)`

- **Description:** Initiates the execution of a freelance order by assigning a contractor.
- **Parameters:**
  - `_orderId` - Order ID.
  - `_contractor` - Contractor's address.
  - `_deadline` - Order deadline.
  - `_price` - Order price.
- **Access Control:** Public
- **Modifier:** `whenNotPaused`
- **Emits Event:** `OrderStarted`

#### `approveOrder(uint256 _orderId)`

- **Description:** Approves the completion of a freelance order by the customer.
- **Parameters:** `_orderId` - Order ID.
- **Access Control:** Public
- **Modifier:** `whenNotPaused`
- **Emits Event:** `OrderCompleted`

#### `cancelOrderByCustomer(uint256 _orderId)`

- **Description:** Cancels a freelance order by the customer.
- **Parameters:** `_orderId` - Order ID.
- **Access Control:** Public
- **Modifier:** `whenNotPaused`
- **Emits Event:** `OrderCanceledByCustomer`

#### `judjeOrder(uint256 _orderId, uint16 _contractorPercent, uint16 _customerPercent)`

- **Description:** Judges a freelance order in case of conflicts between customer and contractor.
- **Parameters:**
  - `_orderId` - Order ID.
  - `_contractorPercent` - Percentage for the contractor.
  - `_customerPercent` - Percentage for the customer.
- **Access Control:** Public (only accessible by the `JUDGE_ROLE`)
- **Modifier:** `whenNotPaused`, `onlyRole(JUDGE_ROLE)`
- **Emits Event:** `OrderJudged`

#### `updateOrderContractor(uint256 _orderId, address _contractor)`

- **Description:** Updates the contractor of a freelance order (only accessible by the judge role).
- **Parameters:**
  - `_orderId` - Order ID.
  - `_contractor` - New contractor's address.
- **Access Control:** Public (only accessible by the judge role)
- **Modifier:** `whenNotPaused`, `onlyRole(JUDGE_ROLE)`
- **Emits Event:** `ContractorUpdatedByJudge`

#### `addPaymentToken(address _paymentToken)`

- **Description:** Adds a new payment token to the list of supported tokens (only accessible by the admin).
- **Parameters:** `_paymentToken` - Payment token address.
- **Access Control:** Public (only accessible by the admin)
- **Modifier:** `onlyRole(DEFAULT_ADMIN_ROLE)`
- **Emits Event:** `PaymentTokenAdded`

#### `removePaymentToken(address _paymentToken)`

- **Description:** Removes a payment token from the list of supported tokens (only accessible by the admin).
- **Parameters:** `_paymentToken` - Payment token address.
- **Access Control:** Public (only accessible by the admin)
- **Modifier:** `onlyRole(DEFAULT_ADMIN_ROLE)`
- **Emits Event:** `PaymentTokenRemoved`

#### `emergencyWithdraw(address _token, address _to, uint256 _amount)`

- **Description:** Withdraws native chain tokens or ERC20 tokens from the contract (only accessible by the admin when the contract is paused).
- **Parameters:**
  - `_token` - Token address.
  - `_to` - Receiver's address.
  - `_amount` - Amount of tokens.
- **Access Control:** Public (only accessible by the admin when the contract is paused)
- **Modifier:** `whenPaused`, `onlyRole(DEFAULT_ADMIN_ROLE)`
- **Emits Event:** `EmergencyWithdraw`

#### `pausePlatform()`

- **Description:** Pauses the platform (only accessible by the admin).
- **Access Control:** Public (only accessible by the admin)
- **Modifier:** `onlyRole(DEFAULT_ADMIN_ROLE)`

#### `unpausePlatform()`

- **Description:** Unpauses the platform (only accessible by the admin).
- **Access Control:** Public (only accessible by the admin)
- **Modifier:** `onlyRole(DEFAULT_ADMIN_ROLE)`

#### `updateFeeReceiver(address _feeReceiver)`

- **Description:** Updates the fee receiver address (only accessible by the admin).
- **Parameters:** `_feeReceiver` - New fee receiver address.
- **Access Control:** Public (only accessible by the admin)
- **Modifier:** `onlyRole(DEFAULT_ADMIN_ROLE)`
- **Emits Event:** `UpdateFeeReceiver`

#### `updateFeePercent(uint16 _feePercent)`

- **Description:** Updates the project fee percentage (only accessible by the admin).
- **Parameters:** `_feePercent` - New fee percentage.
- **Access Control:** Public (only accessible by the admin)
- **Modifier:** `onlyRole(DEFAULT_ADMIN_ROLE)`
- **Emits Event:** `UpdateFeePercent`

### Public Variables:

#### JUDGE_ROLE

- **Type:** `bytes32`
- **Description:** Role hash for the judge role.

#### ordersCount

- **Type:** `uint256`
- **Description:** Number of orders created on the platform.

#### feePercent

- **Type:** `uint16`
- **Description:** Project fee percentage (100% = 10000).

#### feeReceiver

- **Type:** `address`
- **Description:** Address of the project fee receiver.

#### FEE_PRECISION

- **Type:** `uint16`
- **Description:** Precision for fee calculations (10000).

#### DEFAULT_ADMIN_ROLE

- **Type:** `bytes32`
- **Description:** Role hash for the admin role.

### Events:

#### OrderCreated

Emitted when a new order is created.

- **Parameters:**
  - `orderId` - Order ID.
  - `customer` - Customer's address.
  - `paymentToken` - Payment token address.
  - `title` - Order title.
  - `descriptionLink` - IPFS link to order description.

#### OrderStarted

Emitted when an order is assigned to a contractor and payment is sent to the contract.

- **Parameters:**
  - `orderId` - Order ID.
  - `contractor` - Contractor's address.
  - `price` - Order price.
  - `deadline` - Order deadline.

#### OrderCompleted

Emitted when an order is completed and approved by the customer.

- **Parameters:**
  - `orderId` - Order ID.

#### OrderCanceledByCustomer

Emitted when an order is canceled by the customer.

- **Parameters:**
  - `orderId` - Order ID.

#### OrderJudged

Emitted when an order is judged by the platform judge.

- **Parameters:**
  - `orderId` - Order ID.
  - `contractorAmount` - Amount allocated to the contractor.
  - `customerAmount` - Amount allocated to the customer.

#### ContractorUpdatedByJudge

Emitted when the contractor of an order is updated by the judge.

- **Parameters:**
  - `orderId` - Order ID.
  - `contractor` - New contractor's address.

#### ProjectFeePaid

Emitted when the project fee is paid.

- **Parameters:**
  - `orderId` - Order ID.
  - `paymentToken` - Payment token address.
  - `feeAmount` - Amount of the project fee paid.

#### PaymentTokenAdded

Emitted when a new payment token is added.

- **Parameters:**
  - `paymentToken` - Payment token address.

#### PaymentTokenRemoved

Emitted when a payment token is removed.

- **Parameters:**
  - `paymentToken` - Payment token address.

#### UpdateFeeReceiver

Emitted when the fee receiver is updated.

- **Parameters:**
  - `feeReceiver` - New fee receiver address.

#### UpdateFeePercent

Emitted when the project fee percentage is updated.

- **Parameters:**
  - `feePercent` - New fee percentage.

#### EmergencyWithdraw

Emitted when native chain tokens or ERC20 tokens are withdrawn from the contract.

- **Parameters:**
  - `token` - Token address.
  - `to` - Receiver's address.
  - `amount` - Amount of tokens.

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
