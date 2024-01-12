// SPDX-License-Identifier: SEE LICENSE IN LICENSE
pragma solidity 0.8.23;

import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {EnumerableSet} from "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";
import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";

/// @notice reverted when native chain token transfer fails
error TransferFailed();
/// @notice reverted when zero address is passed
error ZeroAddress(string argName);
/// @notice reverted when zero value is passed
error ZeroValue(string argName);
/// @notice reverted when msg value is not zero
error MsgValueIsNotZero();
/// @notice reverted when order does not exist
error OrderDoesNotExist(uint256 orderId);
/// @notice reverted when deadline is incorrect
error IncorrectDeadline(string deadline);
/// @notice reverted when percents is incorrect
error IncorrectPercent(string argName);
/// @notice reverted when price is incorrect
error IncorrectPrice(string argName);
/// @notice reverted when only order customer can call function
error OnlyCustomer(uint256 orderId, address caller, address customer);
/// @notice reverted when payment token is not supported
error UnSupportedPaymentToken(address paymentToken);
/// @notice reverted when order already assigned
error OrderAlreadyAssigned(uint256 orderId, address contractor);
/// @notice reverted when order is not in progress
error OrderNotInProgress(uint256 orderId);
/// @notice reverted when cancelation is forbidden
error CancelationForbidden(uint256 orderId);

contract CryptoPlatform is AccessControl, Pausable {
    using SafeERC20 for IERC20;

    enum OrderStatus {
        CREATED, /// @notice equal 0. Order is created
        IN_PROGRESS, /// @notice equal 1. Order assigned to contractor and payment sent to contract.
        COMPLETED, /// @notice equal 2. Order completed and approved by customer. Payment sent to contractor and fee sent to feeReceiver.
        CANCELED_BY_CUSTOMER, /// @notice equal 3. Order canceled by customer. Only if order is in CREATED status.
        JUDGED /// @notice equal 4. Order judged by judge. Only if order is in IN_PROGRESS status.
    }

    struct Order {
        uint256 id; /// @notice unique order id
        address customer; /// @notice customer address
        address contractor; /// @notice contractor address
        address paymentToken; /// @notice payment token address
        uint256 price; /// @notice order price
        uint32 deadline; /// @notice order deadline
        string title; /// @notice order title
        string descriptionLink; /// @notice order description link on IPFS
        OrderStatus status; /// @notice order status. enum OrderStatus
    }
    /// @notice judge role hash
    bytes32 public constant JUDGE_ROLE = keccak256("JUDGE_ROLE");
    /// @notice orders count
    uint256 public ordersCount;
    /// @notice project fee percent. 100% = 10000;
    uint16 public feePercent;
    /// @notice project fee receiver
    address public feeReceiver;
    /// @notice precision for fee calculations
    uint16 public constant FEE_PRECISION = 10000;
    /// @notice orders storage. orderId => Order
    mapping(uint256 => Order) public orders;
    /// @notice customer active orders storage. customer => orderIds[]
    mapping(address => EnumerableSet.UintSet) private customerActiveOrders;
    /// @notice contractor active orders storage contractor => orderIds[]
    mapping(address => EnumerableSet.UintSet) private contractorActiveOrders;
    /// @notice supported payment tokens
    EnumerableSet.AddressSet private paymentTokens;

    /// @notice emitted when order created
    event OrderCreated(
        uint256 orderId,
        address indexed customer,
        address indexed paymentToken,
        string title,
        string descriptionLink
    );
    /// @notice emitted when order assigned to contractor
    event OrderStarted(
        uint256 orderId,
        address indexed contractor,
        uint256 price,
        uint32 deadline
    );
    /// @notice emitted when order approved by customer
    event OrderCompleted(uint256 orderId);
    /// @notice emitted when order canceled by customer
    event OrderCanceledByCustomer(uint256 orderId);
    /// @notice emitted when order judged by platform judge
    event OrderJudged(
        uint256 orderId,
        uint256 contractorAmount,
        uint256 customerAmount
    );
    event ContractorUpdatedByJudge(uint256 orderId, address contractor);
    /// @notice emitted when project fee paid
    event ProjectFeePaid(
        uint256 orderId,
        address indexed paymentToken,
        uint256 feeAmount
    );
    /// @notice emitted when payment token added
    event PaymentTokenAdded(address indexed paymentToken);
    /// @notice emitted when payment token removed
    event PaymentTokenRemoved(address indexed paymentToken);
    /// @notice emitted when fee receiver updated
    event UpdateFeeReceiver(address indexed feeReceiver);
    /// @notice emitted when fee percent updated
    event UpdateFeePercent(uint16 feePercent);
    /// @notice emitted when emergency withdraw
    event EmergencyWithdraw(
        address indexed token,
        address indexed to,
        uint256 amount
    );

    /// @notice Create a new CryptoPlatform contract
    /// @param _admin - default admin address
    /// @param _feeReceiver - fee receiver address
    /// @param _feePercent - fee percent
    constructor(address _admin, address _feeReceiver, uint16 _feePercent) {
        _checkZeroAddress(_admin, "_admin");
        _checkZeroAddress(_feeReceiver, "_feeReceiver");
        if (_feePercent >= FEE_PRECISION) {
            revert IncorrectPercent(" _feePercent");
        }
        EnumerableSet.add(paymentTokens, address(0));
        feePercent = _feePercent;
        feeReceiver = _feeReceiver;
        _grantRole(DEFAULT_ADMIN_ROLE, _admin);
        _grantRole(JUDGE_ROLE, _admin);
    }

    /// @notice Create a new order. Can create order if contract not paused.
    /// @dev If passed _paymentToken is zero address, native chain token will be used.
    /// @param _paymentToken - payment token address
    /// @param _title - order title
    /// @param _descriptionLink - order description link on IPFS
    function createOrder(
        address _paymentToken,
        string memory _title,
        string memory _descriptionLink
    ) external whenNotPaused {
        if (bytes(_title).length == 0) {
            revert ZeroValue("_title");
        }
        if (bytes(_descriptionLink).length == 0) {
            revert ZeroValue("_descriptionLink");
        }
        if (!EnumerableSet.contains(paymentTokens, _paymentToken)) {
            revert UnSupportedPaymentToken(_paymentToken);
        }
        ++ordersCount;
        uint256 orderId = ordersCount;
        Order storage order = orders[orderId];
        order.id = orderId;
        order.customer = msg.sender;
        order.paymentToken = _paymentToken;
        order.title = _title;
        order.descriptionLink = _descriptionLink;
        order.status = OrderStatus.CREATED;
        EnumerableSet.add(customerActiveOrders[msg.sender], orderId);

        emit OrderCreated(
            orderId,
            msg.sender,
            _paymentToken,
            _title,
            _descriptionLink
        );
    }

    /// @notice Start order execution. Only customer can start order execution.
    /// @dev Can start order execution if order status is CREATED.
    /// @dev Can start order execution if contract not paused.
    /// @param _orderId - order id
    /// @param _contractor - contractor address
    /// @param _deadline - order deadline
    /// @param _price - order price
    function startOrderExecution(
        uint256 _orderId,
        address _contractor,
        uint32 _deadline,
        uint256 _price
    ) external payable whenNotPaused {
        _checkOrderExist(_orderId);
        Order storage order = orders[_orderId];
        address customerAddress = order.customer;
        address paymentTokenCache = order.paymentToken;
        if (customerAddress != msg.sender) {
            revert OnlyCustomer(_orderId, msg.sender, customerAddress);
        }
        if (order.status != OrderStatus.CREATED) {
            revert OrderAlreadyAssigned(_orderId, order.contractor);
        }
        if (_contractor == address(0)) {
            revert ZeroAddress("_contractor");
        }
        if (_price == 0) {
            revert ZeroValue("_price");
        }
        if (_deadline <= block.timestamp) {
            revert IncorrectDeadline("_deadline");
        }

        order.contractor = _contractor;
        order.deadline = _deadline;
        order.price = _price;
        order.status = OrderStatus.IN_PROGRESS;
        EnumerableSet.add(contractorActiveOrders[_contractor], _orderId);
        _acceptPaymentForOrderExecution(
            paymentTokenCache,
            customerAddress,
            _price,
            msg.value
        );
        emit OrderStarted(_orderId, _contractor, _price, _deadline);
    }

    /// @notice Approve order execution. Only customer can approve order.
    /// @dev Can approve order if order status is IN_PROGRESS.
    /// @dev Can approve order if contract not paused.
    /// @param _orderId - order id
    function approveOrder(uint256 _orderId) external whenNotPaused {
        _checkOrderExist(_orderId);
        Order storage order = orders[_orderId];
        address customerAddress = order.customer;
        address paymentTokenCache = order.paymentToken;
        address orderContractor = order.contractor;
        uint256 orderPrice = order.price;
        if (customerAddress != msg.sender) {
            revert OnlyCustomer(_orderId, msg.sender, customerAddress);
        }
        if (order.status != OrderStatus.IN_PROGRESS) {
            revert OrderNotInProgress(_orderId);
        }

        order.status = OrderStatus.COMPLETED;

        EnumerableSet.remove(customerActiveOrders[customerAddress], _orderId);
        EnumerableSet.remove(contractorActiveOrders[orderContractor], _orderId);
        _approveOrderPayment(
            _orderId,
            paymentTokenCache,
            orderContractor,
            feeReceiver,
            orderPrice
        );
        emit OrderCompleted(_orderId);
    }

    /// @notice Cancel order by customer. Only customer can cancel order.
    /// @dev Can cancel order if order status is CREATED.
    /// @dev Can cancel order if contract not paused.
    /// @param _orderId - order id
    function cancelOrderByCustomer(uint256 _orderId) external whenNotPaused {
        _checkOrderExist(_orderId);
        Order storage order = orders[_orderId];
        if (order.customer != msg.sender) {
            revert OnlyCustomer(_orderId, msg.sender, order.customer);
        }
        if (order.status != OrderStatus.CREATED) {
            revert CancelationForbidden(_orderId);
        }
        order.status = OrderStatus.CANCELED_BY_CUSTOMER;
        EnumerableSet.remove(customerActiveOrders[msg.sender], _orderId);
        emit OrderCanceledByCustomer(_orderId);
    }

    /// @notice Judge order. Only judge role can judge order.
    /// @dev Can judge order if order status is IN_PROGRESS.
    /// @dev Can judge order if contract not paused.
    /// @dev Its works for judge conflicts between customer and contractor.
    /// @param _orderId - order id
    /// @param _contractorPercent - contractor percent
    /// @param _customerPercent - customer percent
    function judjeOrder(
        uint256 _orderId,
        uint16 _contractorPercent,
        uint16 _customerPercent
    ) external whenNotPaused onlyRole(JUDGE_ROLE) {
        _checkOrderExist(_orderId);
        Order storage order = orders[_orderId];
        address paymentTokenCache = order.paymentToken;
        address orderContractor = order.contractor;
        address orderCustomer = order.customer;
        uint256 orderPrice = order.price;

        if (_contractorPercent + _customerPercent != FEE_PRECISION) {
            revert IncorrectPercent("_contractorPercent + _customerPercent");
        }
        if (order.status != OrderStatus.IN_PROGRESS) {
            revert OrderNotInProgress(_orderId);
        }

        order.status = OrderStatus.JUDGED;
        EnumerableSet.remove(contractorActiveOrders[orderContractor], _orderId);
        EnumerableSet.remove(customerActiveOrders[orderCustomer], _orderId);

        _judjePayments(
            _orderId,
            orderPrice,
            paymentTokenCache,
            orderCustomer,
            orderContractor,
            _customerPercent,
            _contractorPercent
        );
    }

    function updateOrderContractor(
        uint256 _orderId,
        address _contractor
    ) external whenNotPaused onlyRole(JUDGE_ROLE) {
        _checkOrderExist(_orderId);
        Order storage order = orders[_orderId];
        if (order.status != OrderStatus.IN_PROGRESS) {
            revert OrderNotInProgress(_orderId);
        }
        if (_contractor == address(0)) {
            revert ZeroAddress("_contractor");
        }
        order.contractor = _contractor;
        emit ContractorUpdatedByJudge(_orderId, _contractor);
    }

    /// @notice Add new payment token to list.
    /// @dev Only admin can add new payment token.
    /// @param _paymentToken - payment token address
    function addPaymentToken(
        address _paymentToken
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (EnumerableSet.contains(paymentTokens, _paymentToken)) {
            revert("Already added");
        }
        EnumerableSet.add(paymentTokens, _paymentToken);
        emit PaymentTokenAdded(_paymentToken);
    }

    /// @notice Remove payment token from list.
    /// @dev Only admin can remove payment token.
    /// @param _paymentToken - payment token address
    function removePaymentToken(
        address _paymentToken
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (!EnumerableSet.contains(paymentTokens, _paymentToken)) {
            revert("Not added");
        }
        EnumerableSet.remove(paymentTokens, _paymentToken);
        emit PaymentTokenRemoved(_paymentToken);
    }

    /// @notice Withdraw native chain token or ERC20 tokens from contract.
    /// @dev If passed token address is zero address, native chain token will be withdrawn.
    /// @dev Only admin can withdraw tokens if contract paused.
    /// @param _token - token address
    /// @param _to - receiver address
    /// @param _amount - amount of tokens
    function emergencyWithdraw(
        address _token,
        address _to,
        uint256 _amount
    ) external whenPaused onlyRole(DEFAULT_ADMIN_ROLE) {
        if (_token == address(0)) {
            _sendNative(_to, _amount);
            emit EmergencyWithdraw(address(0), _to, _amount);
        } else {
            IERC20(_token).safeTransfer(_to, _amount);
            emit EmergencyWithdraw(_token, _to, _amount);
        }
    }

    /// @notice Pause platform.
    /// @dev Only admin can pause platform.
    function pausePlatform() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _pause();
    }

    /// @notice Unpause platform.
    /// @dev Only admin can unpause platform.
    function unpausePlatform() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _unpause();
    }

    /// @notice Update fee receiver.
    /// @dev Only admin can update fee receiver.
    /// @param _feeReceiver - fee receiver address
    function updateFeeReceiver(
        address _feeReceiver
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _checkZeroAddress(_feeReceiver, "_feeReceiver");
        feeReceiver = _feeReceiver;
        emit UpdateFeeReceiver(_feeReceiver);
    }

    /// @notice Update fee percent.
    /// @dev Only admin can update fee percent.
    /// @param _feePercent - fee percent
    function updateFeePercent(
        uint16 _feePercent
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (_feePercent >= FEE_PRECISION) {
            revert IncorrectPercent("_feePercent");
        }
        feePercent = _feePercent;
        emit UpdateFeePercent(_feePercent);
    }

    /// @notice Get payment tokens.
    /// @return tokens - allowed for payment token addresses array
    function getPaymentTokens() public view returns (address[] memory) {
        uint256 length = EnumerableSet.length(paymentTokens);
        address[] memory tokens = new address[](length);
        for (uint256 i = 0; i < length; i++) {
            tokens[i] = EnumerableSet.at(paymentTokens, i);
        }
        return tokens;
    }

    /// @notice Get customer active orders.
    /// @param _customer - customer address
    /// @return ordersIds - customer active orders ids array
    function getCustomerActiveOrders(
        address _customer
    ) external view returns (uint256[] memory) {
        uint256 length = EnumerableSet.length(customerActiveOrders[_customer]);
        uint256[] memory ordersIds = new uint256[](length);
        for (uint256 i = 0; i < length; i++) {
            ordersIds[i] = EnumerableSet.at(customerActiveOrders[_customer], i);
        }
        return ordersIds;
    }

    /// @notice Get contractor active orders.
    /// @param _contractor - contractor address
    /// @return ordersIds - contractor active orders ids array
    function getContractorActiveOrders(
        address _contractor
    ) external view returns (uint256[] memory) {
        uint256 length = EnumerableSet.length(
            contractorActiveOrders[_contractor]
        );
        uint256[] memory ordersIds = new uint256[](length);
        for (uint256 i = 0; i < length; i++) {
            ordersIds[i] = EnumerableSet.at(
                contractorActiveOrders[_contractor],
                i
            );
        }
        return ordersIds;
    }

    /// @notice Internal function that accepts payment for order execution.
    /// @dev If passed _paymentToken is zero address, native chain token will be used.
    /// @param paymentToken - payment token address
    /// @param customer - customer address
    /// @param price - order price
    /// @param value - msg value
    function _acceptPaymentForOrderExecution(
        address paymentToken,
        address customer,
        uint256 price,
        uint256 value
    ) internal {
        if (paymentToken == address(0)) {
            if (value < price) {
                revert IncorrectPrice("_price");
            }
            if (value > price) {
                _sendNative(customer, value - price);
            }
        } else {
            if (value > 0) {
                revert MsgValueIsNotZero();
            }
            IERC20(paymentToken).safeTransferFrom(
                customer,
                address(this),
                price
            );
        }
    }

    /// @notice Internal function that approves order payment.
    /// @dev If passed _paymentToken is zero address, native chain token will be used.
    /// @param _orderId - order id
    /// @param _paymentToken - payment token address
    /// @param _contractor - contractor address
    /// @param _feeReceiver - fee receiver address
    /// @param _price - order price
    function _approveOrderPayment(
        uint256 _orderId,
        address _paymentToken,
        address _contractor,
        address _feeReceiver,
        uint256 _price
    ) internal {
        uint16 feePercentCache = feePercent;
        uint256 fee = feePercentCache > 0
            ? (_price * feePercentCache) / FEE_PRECISION
            : 0;
        if (_paymentToken == address(0)) {
            _sendNative(_contractor, _price - fee);
            if (fee > 0) {
                _sendNative(feeReceiver, fee);
                emit ProjectFeePaid(ordersCount, address(0), fee);
            }
        } else {
            IERC20(_paymentToken).safeTransfer(_contractor, _price - fee);
            if (fee > 0) {
                IERC20(_paymentToken).safeTransfer(_feeReceiver, fee);
                emit ProjectFeePaid(_orderId, _paymentToken, fee);
            }
        }
    }

    /// @notice Internal function that judges order payments in conflict situations.
    /// @dev If passed _paymentToken is zero address, native chain token will be used.
    /// @param _orderId - order id
    /// @param _orderPrice - order price
    /// @param _paymentToken - payment token address
    /// @param _customer - customer address
    /// @param _contractor - contractor address
    /// @param _customerPercent - customer percent
    /// @param _contractorPercent - contractor percent
    function _judjePayments(
        uint256 _orderId,
        uint256 _orderPrice,
        address _paymentToken,
        address _customer,
        address _contractor,
        uint16 _customerPercent,
        uint16 _contractorPercent
    ) internal {
        address feeReceiverCache = feeReceiver;
        uint16 feePercentCache = feePercent;
        uint256 fee = feePercentCache > 0
            ? uint256((_orderPrice * feePercentCache) / FEE_PRECISION)
            : 0;
        uint256 amount = _orderPrice - fee;
        uint256 _contractorAmount = _contractorPercent > 0
            ? uint256((amount * _contractorPercent) / FEE_PRECISION)
            : 0;
        uint256 _customerAmount = _customerPercent > 0
            ? uint256((amount * _customerPercent) / FEE_PRECISION)
            : 0;
        if (_paymentToken == address(0)) {
            if (_contractorAmount > 0) {
                _sendNative(_contractor, _contractorAmount);
            }
            if (_customerAmount > 0) {
                _sendNative(_customer, _customerAmount);
            }
            if (fee > 0) {
                _sendNative(feeReceiverCache, fee);
                emit ProjectFeePaid(_orderId, address(0), fee);
            }
        } else {
            if (_contractorAmount > 0) {
                IERC20(_paymentToken).safeTransfer(
                    _contractor,
                    _contractorAmount
                );
            }
            if (_customerAmount > 0) {
                IERC20(_paymentToken).safeTransfer(_customer, _customerAmount);
            }
            if (fee > 0) {
                IERC20(_paymentToken).safeTransfer(feeReceiverCache, fee);
                emit ProjectFeePaid(_orderId, _paymentToken, fee);
            }
        }
        emit OrderJudged(_orderId, _contractorAmount, _customerAmount);
    }

    /// @notice This function sends native chain token.
    /// @param to_ - address of receiver
    /// @param amount_ - amount of native chain token
    /// @dev If the transfer fails, the function reverts.
    function _sendNative(address to_, uint256 amount_) internal {
        (bool success, ) = to_.call{value: amount_}("");
        if (!success) {
            revert TransferFailed();
        }
    }

    /// @notice This function checks zero address.
    /// @param _address - address for check
    /// @param _argName - argument name
    function _checkZeroAddress(
        address _address,
        string memory _argName
    ) private pure {
        if (_address == address(0)) {
            revert ZeroAddress(_argName);
        }
    }

    /// @notice This function checks order exist.
    /// @param _orderId - order id
    function _checkOrderExist(uint256 _orderId) private view {
        if (_orderId > ordersCount) {
            revert OrderDoesNotExist(_orderId);
        }
    }
}
