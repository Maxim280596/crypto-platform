import { expect } from "chai";
import { ethers } from "hardhat";

import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { BigNumber } from "ethers";
import {
  CryptoPlatform,
  CryptoPlatform__factory,
  USDC,
} from "../typechain-types";

const getCurrentTimeStamp = async () => {
  const block = await ethers.provider.getBlock("latest");
  return block.timestamp;
};

describe("CryptoPlatform tests", function () {
  let CryptoPlatformFactory: CryptoPlatform__factory;
  let cryptoPlatform: CryptoPlatform;
  let usdc: USDC;
  let deployer: SignerWithAddress;
  let judge: SignerWithAddress;
  let feeReceiver: SignerWithAddress;
  let accounts: SignerWithAddress[];
  before(async () => {
    const [acc1, acc2, acc3, ...others] = await ethers.getSigners();
    deployer = acc1;
    judge = acc2;
    feeReceiver = acc3;
    accounts = others;

    CryptoPlatformFactory = await ethers.getContractFactory("CryptoPlatform");

    cryptoPlatform = await CryptoPlatformFactory.deploy(
      judge.address,
      feeReceiver.address,
      500
    );
    await cryptoPlatform.deployed();
    const tokenFactory = await ethers.getContractFactory("USDC");
    usdc = await tokenFactory.deploy(
      "USD Coin",
      "USDC",
      6,
      ethers.utils.parseEther("100000000000")
    );
    await usdc.deployed();
  });
  describe("Deployment", () => {
    it("should revert deployment with invalid admin address", async () => {
      await expect(
        CryptoPlatformFactory.deploy(
          ethers.constants.AddressZero,
          feeReceiver.address,
          500
        )
      ).to.be.revertedWith('ZeroAddress("_admin")');
    });
    it("should revert deployment with invalid fee receiver address", async () => {
      await expect(
        CryptoPlatformFactory.deploy(
          judge.address,
          ethers.constants.AddressZero,
          500
        )
      ).to.be.revertedWith('ZeroAddress("_feeReceiver")');
    });
    it("should revert deployment with invalid fee percentage", async () => {
      await expect(
        CryptoPlatformFactory.deploy(judge.address, feeReceiver.address, 10000)
      ).to.be.revertedWith('IncorrectPercent(" _feePercent")');
    });
  });

  describe("Success flow with native token", () => {
    it("should create order", async () => {
      const orderID = (await cryptoPlatform.ordersCount()).add(
        BigNumber.from(1)
      );
      await cryptoPlatform.createOrder(
        ethers.constants.AddressZero,
        "title",
        "https://www.some.com"
      );
      const order = await cryptoPlatform.orders(orderID);
      const userActiveOrders = await cryptoPlatform.getCustomerActiveOrders(
        deployer.address
      );

      expect(order.id).to.be.equal(orderID);
      expect(order.customer).to.be.equal(deployer.address);
      expect(order.title).to.be.equal("title");
      expect(order.descriptionLink).to.be.equal("https://www.some.com");
      expect(order.status).to.be.equal(0);
      expect(order.paymentToken).to.be.equal(ethers.constants.AddressZero);
      expect(order.price).to.be.equal(0);
      expect(order.contractor).to.be.equal(ethers.constants.AddressZero);
      expect(order.deadline).to.be.equal(0);
      expect(userActiveOrders.length).to.be.equal(1);
    });
    it("should start order", async () => {
      const contractor = accounts[0];
      const orderID = await cryptoPlatform.ordersCount();
      const deadline = (await getCurrentTimeStamp()) + 86400;
      const price = ethers.utils.parseEther("1");
      const customerBalanceBefore = await ethers.provider.getBalance(
        deployer.address
      );
      const cryptoPlatformBalanceBefore = await ethers.provider.getBalance(
        cryptoPlatform.address
      );
      await expect(
        cryptoPlatform.startOrderExecution(
          orderID,
          contractor.address,
          deadline,
          price,
          { value: 0 }
        )
      ).to.be.revertedWith('IncorrectPrice("_price")');
      await cryptoPlatform.startOrderExecution(
        orderID,
        contractor.address,
        deadline,
        price,
        { value: price.mul(BigNumber.from("2")) }
      );
      const customerBalanceAfter = await ethers.provider.getBalance(
        deployer.address
      );
      const cryptoPlatformBalanceAfter = await ethers.provider.getBalance(
        cryptoPlatform.address
      );
      const order = await cryptoPlatform.orders(orderID);
      expect(cryptoPlatformBalanceAfter).to.be.equal(
        cryptoPlatformBalanceBefore.add(price)
      );
      expect(customerBalanceAfter).to.be.lt(customerBalanceBefore);
      expect(order.status).to.be.equal(1);
      expect(order.contractor).to.be.equal(contractor.address);
      expect(order.deadline).to.be.equal(deadline);
      expect(order.price).to.be.equal(price);
    });
    it("should approve order", async () => {
      const orderID = await cryptoPlatform.ordersCount();
      const order = await cryptoPlatform.orders(orderID);
      const contractorBalanceBefore = await ethers.provider.getBalance(
        order.contractor
      );
      const cryptoPlatformBalanceBefore = await ethers.provider.getBalance(
        cryptoPlatform.address
      );
      const feeReceiverBalanceBefore = await ethers.provider.getBalance(
        feeReceiver.address
      );
      await cryptoPlatform.approveOrder(orderID);
      const contractorBalanceAfter = await ethers.provider.getBalance(
        order.contractor
      );
      const cryptoPlatformBalanceAfter = await ethers.provider.getBalance(
        cryptoPlatform.address
      );
      const feeReceiverBalanceAfter = await ethers.provider.getBalance(
        feeReceiver.address
      );
      expect(cryptoPlatformBalanceAfter).to.be.equal(
        cryptoPlatformBalanceBefore.sub(order.price)
      );
      const fee = order.price
        .mul(await cryptoPlatform.feePercent())
        .div(await cryptoPlatform.FEE_PRECISION());
      expect(feeReceiverBalanceAfter).to.be.equal(
        feeReceiverBalanceBefore.add(fee)
      );
      expect(contractorBalanceAfter).to.be.equal(
        contractorBalanceBefore.add(order.price.sub(fee))
      );

      const orderAfter = await cryptoPlatform.orders(orderID);
      expect(orderAfter.status).to.be.equal(2);

      const customerActiveOrders = await cryptoPlatform.getCustomerActiveOrders(
        deployer.address
      );
      const contractorActiveOrders =
        await cryptoPlatform.getContractorActiveOrders(order.contractor);
      expect(customerActiveOrders.length).to.be.equal(0);
      expect(contractorActiveOrders.length).to.be.equal(0);
    });
  });
  describe("Success flow with ERC20 token", () => {
    it("should create order", async () => {
      await cryptoPlatform.connect(judge).addPaymentToken(usdc.address);
      const orderID = (await cryptoPlatform.ordersCount()).add(
        BigNumber.from(1)
      );
      await cryptoPlatform.createOrder(
        usdc.address,
        "title",
        "https://www.some.com"
      );
      const order = await cryptoPlatform.orders(orderID);
      const userActiveOrders = await cryptoPlatform.getCustomerActiveOrders(
        deployer.address
      );
      expect(order.id).to.be.equal(orderID);
      expect(order.customer).to.be.equal(deployer.address);
      expect(order.title).to.be.equal("title");
      expect(order.descriptionLink).to.be.equal("https://www.some.com");
      expect(order.status).to.be.equal(0);
      expect(order.paymentToken).to.be.equal(usdc.address);
      expect(order.price).to.be.equal(0);
      expect(order.contractor).to.be.equal(ethers.constants.AddressZero);
      expect(order.deadline).to.be.equal(0);
      expect(userActiveOrders[userActiveOrders.length - 1]).to.be.equal(
        orderID
      );
    });
    it("should start order", async () => {
      await usdc
        .connect(deployer)
        .approve(cryptoPlatform.address, ethers.utils.parseUnits("1000", 6));
      const contractor = accounts[0];
      const orderID = await cryptoPlatform.ordersCount();
      const deadline = (await getCurrentTimeStamp()) + 86400;
      const price = ethers.utils.parseUnits("100", 6);
      const customerBalanceBefore = await usdc.balanceOf(deployer.address);
      const cryptoPlatformBalanceBefore = await usdc.balanceOf(
        cryptoPlatform.address
      );
      await expect(
        cryptoPlatform.startOrderExecution(
          orderID,
          contractor.address,
          deadline,
          price,
          { value: ethers.utils.parseEther("1") }
        )
      ).to.be.revertedWith("MsgValueIsNotZero()");
      await cryptoPlatform.startOrderExecution(
        orderID,
        contractor.address,
        deadline,
        price
      );
      const customerBalanceAfter = await usdc.balanceOf(deployer.address);
      const cryptoPlatformBalanceAfter = await usdc.balanceOf(
        cryptoPlatform.address
      );
      const order = await cryptoPlatform.orders(orderID);
      const contractorActiveOrders =
        await cryptoPlatform.getContractorActiveOrders(contractor.address);
      expect(cryptoPlatformBalanceAfter).to.be.equal(
        cryptoPlatformBalanceBefore.add(price)
      );
      expect(customerBalanceAfter).to.be.equal(
        customerBalanceBefore.sub(price)
      );
      expect(order.status).to.be.equal(1);
      expect(order.contractor).to.be.equal(contractor.address);
      expect(order.deadline).to.be.equal(deadline);
      expect(order.price).to.be.equal(price);
      expect(
        contractorActiveOrders[contractorActiveOrders.length - 1]
      ).to.be.equal(orderID);
    });
    it("should approve order", async () => {
      const orderID = await cryptoPlatform.ordersCount();
      const order = await cryptoPlatform.orders(orderID);
      const contractorBalanceBefore = await usdc.balanceOf(order.contractor);
      const cryptoPlatformBalanceBefore = await usdc.balanceOf(
        cryptoPlatform.address
      );
      const feeReceiverBalanceBefore = await usdc.balanceOf(
        feeReceiver.address
      );
      await cryptoPlatform.approveOrder(orderID);
      const contractorBalanceAfter = await usdc.balanceOf(order.contractor);
      const cryptoPlatformBalanceAfter = await usdc.balanceOf(
        cryptoPlatform.address
      );
      const feeReceiverBalanceAfter = await usdc.balanceOf(feeReceiver.address);
      expect(cryptoPlatformBalanceAfter).to.be.equal(
        cryptoPlatformBalanceBefore.sub(order.price)
      );
      const fee = order.price
        .mul(await cryptoPlatform.feePercent())
        .div(await cryptoPlatform.FEE_PRECISION());
      expect(feeReceiverBalanceAfter).to.be.equal(
        feeReceiverBalanceBefore.add(fee)
      );
      expect(contractorBalanceAfter).to.be.equal(
        contractorBalanceBefore.add(order.price.sub(fee))
      );

      const orderAfter = await cryptoPlatform.orders(orderID);
      expect(orderAfter.status).to.be.equal(2);

      const customerActiveOrders = await cryptoPlatform.getCustomerActiveOrders(
        deployer.address
      );
      const contractorActiveOrders =
        await cryptoPlatform.getContractorActiveOrders(order.contractor);
      expect(customerActiveOrders.length).to.be.equal(0);
      expect(contractorActiveOrders.length).to.be.equal(0);
    });
  });
  describe("Success flow with ERC20 and judge", () => {
    it("should create order", async () => {
      const orderID = (await cryptoPlatform.ordersCount()).add(
        BigNumber.from(1)
      );
      await cryptoPlatform.createOrder(
        usdc.address,
        "title",
        "https://www.some.com"
      );
      const order = await cryptoPlatform.orders(orderID);
      const userActiveOrders = await cryptoPlatform.getCustomerActiveOrders(
        deployer.address
      );
      expect(order.id).to.be.equal(orderID);
      expect(order.customer).to.be.equal(deployer.address);
      expect(order.title).to.be.equal("title");
      expect(order.descriptionLink).to.be.equal("https://www.some.com");
      expect(order.status).to.be.equal(0);
      expect(order.paymentToken).to.be.equal(usdc.address);
      expect(order.price).to.be.equal(0);
      expect(order.contractor).to.be.equal(ethers.constants.AddressZero);
      expect(order.deadline).to.be.equal(0);
      expect(userActiveOrders[userActiveOrders.length - 1]).to.be.equal(
        orderID
      );
    });
    it("should start order", async () => {
      await usdc
        .connect(deployer)
        .approve(cryptoPlatform.address, ethers.utils.parseUnits("1000", 6));
      const contractor = accounts[0];
      const orderID = await cryptoPlatform.ordersCount();
      const deadline = (await getCurrentTimeStamp()) + 86400;
      const price = ethers.utils.parseUnits("100", 6);
      const customerBalanceBefore = await usdc.balanceOf(deployer.address);
      const cryptoPlatformBalanceBefore = await usdc.balanceOf(
        cryptoPlatform.address
      );
      await cryptoPlatform.startOrderExecution(
        orderID,
        contractor.address,
        deadline,
        price
      );
      const customerBalanceAfter = await usdc.balanceOf(deployer.address);
      const cryptoPlatformBalanceAfter = await usdc.balanceOf(
        cryptoPlatform.address
      );
      const order = await cryptoPlatform.orders(orderID);
      const contractorActiveOrders =
        await cryptoPlatform.getContractorActiveOrders(contractor.address);
      expect(cryptoPlatformBalanceAfter).to.be.equal(
        cryptoPlatformBalanceBefore.add(price)
      );
      expect(customerBalanceAfter).to.be.equal(
        customerBalanceBefore.sub(price)
      );
      expect(order.status).to.be.equal(1);
      expect(order.contractor).to.be.equal(contractor.address);
      expect(order.deadline).to.be.equal(deadline);
      expect(order.price).to.be.equal(price);
      expect(
        contractorActiveOrders[contractorActiveOrders.length - 1]
      ).to.be.equal(orderID);
    });
    it("should judge order", async () => {
      const customerPercent = BigNumber.from("5000");
      const contractorPercent = BigNumber.from("5000");
      const orderID = await cryptoPlatform.ordersCount();
      const order = await cryptoPlatform.orders(orderID);
      const contractorBalanceBefore = await usdc.balanceOf(order.contractor);
      const cryptoPlatformBalanceBefore = await usdc.balanceOf(
        cryptoPlatform.address
      );
      const feeReceiverBalanceBefore = await usdc.balanceOf(
        feeReceiver.address
      );
      const customerBalanceBefore = await usdc.balanceOf(deployer.address);
      await cryptoPlatform
        .connect(judge)
        .judjeOrder(orderID, contractorPercent, customerPercent);
      const contractorBalanceAfter = await usdc.balanceOf(order.contractor);
      const cryptoPlatformBalanceAfter = await usdc.balanceOf(
        cryptoPlatform.address
      );
      const feeReceiverBalanceAfter = await usdc.balanceOf(feeReceiver.address);
      const customerBalanceAfter = await usdc.balanceOf(deployer.address);

      expect(cryptoPlatformBalanceAfter).to.be.equal(
        cryptoPlatformBalanceBefore.sub(order.price)
      );
      const fee = order.price
        .mul(await cryptoPlatform.feePercent())
        .div(await cryptoPlatform.FEE_PRECISION());
      const priceWithoutFee = order.price.sub(fee);
      const customerAmount = priceWithoutFee
        .mul(customerPercent)
        .div(BigNumber.from("10000"));
      const contractorAmount = priceWithoutFee
        .mul(contractorPercent)
        .div(BigNumber.from("10000"));
      expect(feeReceiverBalanceAfter).to.be.equal(
        feeReceiverBalanceBefore.add(fee)
      );
      expect(contractorBalanceAfter).to.be.equal(
        contractorBalanceBefore.add(contractorAmount)
      );
      expect(customerBalanceAfter).to.be.equal(
        customerBalanceBefore.add(customerAmount)
      );

      const orderAfter = await cryptoPlatform.orders(orderID);
      expect(orderAfter.status).to.be.equal(4);

      const customerActiveOrders = await cryptoPlatform.getCustomerActiveOrders(
        deployer.address
      );
      const contractorActiveOrders =
        await cryptoPlatform.getContractorActiveOrders(order.contractor);
      expect(customerActiveOrders.length).to.be.equal(0);
      expect(contractorActiveOrders.length).to.be.equal(0);
    });

    it("should judge order with 0% to contractor with ERC20", async () => {
      const orderID = (await cryptoPlatform.ordersCount()).add(
        BigNumber.from(1)
      );
      await cryptoPlatform.createOrder(
        usdc.address,
        "title",
        "https://www.some.com"
      );
      await usdc
        .connect(deployer)
        .approve(cryptoPlatform.address, ethers.utils.parseUnits("1000", 6));
      const contractor = accounts[0];
      const deadline = (await getCurrentTimeStamp()) + 86400;
      const price = ethers.utils.parseUnits("100", 6);
      await cryptoPlatform.startOrderExecution(
        orderID,
        contractor.address,
        deadline,
        price
      );
      const customerPercent = BigNumber.from("10000");
      const contractorPercent = BigNumber.from("0");
      const order = await cryptoPlatform.orders(orderID);
      const contractorBalanceBefore = await usdc.balanceOf(order.contractor);
      const cryptoPlatformBalanceBefore = await usdc.balanceOf(
        cryptoPlatform.address
      );
      const feeReceiverBalanceBefore = await usdc.balanceOf(
        feeReceiver.address
      );
      const customerBalanceBefore = await usdc.balanceOf(deployer.address);
      await cryptoPlatform
        .connect(judge)
        .judjeOrder(orderID, contractorPercent, customerPercent);
      const contractorBalanceAfter = await usdc.balanceOf(order.contractor);
      const cryptoPlatformBalanceAfter = await usdc.balanceOf(
        cryptoPlatform.address
      );
      const feeReceiverBalanceAfter = await usdc.balanceOf(feeReceiver.address);
      const customerBalanceAfter = await usdc.balanceOf(deployer.address);
      expect(cryptoPlatformBalanceAfter).to.be.equal(
        cryptoPlatformBalanceBefore.sub(order.price)
      );
      const fee = order.price
        .mul(await cryptoPlatform.feePercent())
        .div(await cryptoPlatform.FEE_PRECISION());
      const priceWithoutFee = order.price.sub(fee);
      const customerAmount = priceWithoutFee
        .mul(customerPercent)
        .div(BigNumber.from("10000"));
      const contractorAmount = priceWithoutFee
        .mul(contractorPercent)
        .div(BigNumber.from("10000"));
      expect(feeReceiverBalanceAfter).to.be.equal(
        feeReceiverBalanceBefore.add(fee)
      );
      expect(contractorBalanceAfter).to.be.equal(
        contractorBalanceBefore.add(contractorAmount)
      );
      expect(customerBalanceAfter).to.be.equal(
        customerBalanceBefore.add(customerAmount)
      );
      const orderAfter = await cryptoPlatform.orders(orderID);
      expect(orderAfter.status).to.be.equal(4);
      const customerActiveOrders = await cryptoPlatform.getCustomerActiveOrders(
        deployer.address
      );
      const contractorActiveOrders =
        await cryptoPlatform.getContractorActiveOrders(order.contractor);
      expect(customerActiveOrders.length).to.be.equal(0);
      expect(contractorActiveOrders.length).to.be.equal(0);
    });
    it("should judge order with 0% to customer with ERC20", async () => {
      const orderID = (await cryptoPlatform.ordersCount()).add(
        BigNumber.from(1)
      );
      await cryptoPlatform.createOrder(
        usdc.address,
        "title",
        "https://www.some.com"
      );
      await usdc
        .connect(deployer)
        .approve(cryptoPlatform.address, ethers.utils.parseUnits("1000", 6));
      const contractor = accounts[0];
      const deadline = (await getCurrentTimeStamp()) + 86400;
      const price = ethers.utils.parseUnits("100", 6);
      await cryptoPlatform.startOrderExecution(
        orderID,
        contractor.address,
        deadline,
        price
      );
      const customerPercent = BigNumber.from("0");
      const contractorPercent = BigNumber.from("10000");
      const order = await cryptoPlatform.orders(orderID);
      const contractorBalanceBefore = await usdc.balanceOf(order.contractor);
      const cryptoPlatformBalanceBefore = await usdc.balanceOf(
        cryptoPlatform.address
      );
      const feeReceiverBalanceBefore = await usdc.balanceOf(
        feeReceiver.address
      );
      const customerBalanceBefore = await usdc.balanceOf(deployer.address);
      await cryptoPlatform
        .connect(judge)
        .judjeOrder(orderID, contractorPercent, customerPercent);
      const contractorBalanceAfter = await usdc.balanceOf(order.contractor);
      const cryptoPlatformBalanceAfter = await usdc.balanceOf(
        cryptoPlatform.address
      );
      const feeReceiverBalanceAfter = await usdc.balanceOf(feeReceiver.address);
      const customerBalanceAfter = await usdc.balanceOf(deployer.address);
      expect(cryptoPlatformBalanceAfter).to.be.equal(
        cryptoPlatformBalanceBefore.sub(order.price)
      );
      const fee = order.price
        .mul(await cryptoPlatform.feePercent())
        .div(await cryptoPlatform.FEE_PRECISION());
      const priceWithoutFee = order.price.sub(fee);
      const customerAmount = priceWithoutFee
        .mul(customerPercent)
        .div(BigNumber.from("10000"));
      const contractorAmount = priceWithoutFee
        .mul(contractorPercent)
        .div(BigNumber.from("10000"));
      expect(feeReceiverBalanceAfter).to.be.equal(
        feeReceiverBalanceBefore.add(fee)
      );
      expect(contractorBalanceAfter).to.be.equal(
        contractorBalanceBefore.add(contractorAmount)
      );
      expect(customerBalanceAfter).to.be.equal(
        customerBalanceBefore.add(customerAmount)
      );
      const orderAfter = await cryptoPlatform.orders(orderID);
      expect(orderAfter.status).to.be.equal(4);
      const customerActiveOrders = await cryptoPlatform.getCustomerActiveOrders(
        deployer.address
      );
      const contractorActiveOrders =
        await cryptoPlatform.getContractorActiveOrders(order.contractor);
      expect(customerActiveOrders.length).to.be.equal(0);
      expect(contractorActiveOrders.length).to.be.equal(0);
    });
    it("should judge order with 0% to contractor with native token", async () => {
      const orderID = (await cryptoPlatform.ordersCount()).add(
        BigNumber.from(1)
      );
      await cryptoPlatform.createOrder(
        ethers.constants.AddressZero,
        "title",
        "https://www.some.com"
      );
      const contractor = accounts[0];
      const deadline = (await getCurrentTimeStamp()) + 86400;
      const price = ethers.utils.parseEther("1");
      await cryptoPlatform.startOrderExecution(
        orderID,
        contractor.address,
        deadline,
        price,
        { value: price }
      );
      const customerPercent = BigNumber.from("10000");
      const contractorPercent = BigNumber.from("0");
      const order = await cryptoPlatform.orders(orderID);
      const contractorBalanceBefore = await ethers.provider.getBalance(
        order.contractor
      );
      const cryptoPlatformBalanceBefore = await ethers.provider.getBalance(
        cryptoPlatform.address
      );
      const feeReceiverBalanceBefore = await ethers.provider.getBalance(
        feeReceiver.address
      );
      const customerBalanceBefore = await ethers.provider.getBalance(
        deployer.address
      );
      await cryptoPlatform
        .connect(judge)
        .judjeOrder(orderID, contractorPercent, customerPercent);
      const contractorBalanceAfter = await ethers.provider.getBalance(
        order.contractor
      );
      const cryptoPlatformBalanceAfter = await ethers.provider.getBalance(
        cryptoPlatform.address
      );
      const feeReceiverBalanceAfter = await ethers.provider.getBalance(
        feeReceiver.address
      );
      const customerBalanceAfter = await ethers.provider.getBalance(
        deployer.address
      );
      expect(cryptoPlatformBalanceAfter).to.be.equal(
        cryptoPlatformBalanceBefore.sub(order.price)
      );
      const fee = order.price
        .mul(await cryptoPlatform.feePercent())
        .div(await cryptoPlatform.FEE_PRECISION());
      const priceWithoutFee = order.price.sub(fee);
      const customerAmount = priceWithoutFee
        .mul(customerPercent)
        .div(BigNumber.from("10000"));
      const contractorAmount = priceWithoutFee
        .mul(contractorPercent)
        .div(BigNumber.from("10000"));
      expect(feeReceiverBalanceAfter).to.be.equal(
        feeReceiverBalanceBefore.add(fee)
      );
      expect(contractorBalanceAfter).to.be.equal(
        contractorBalanceBefore.add(contractorAmount)
      );
      expect(customerBalanceAfter).to.be.equal(
        customerBalanceBefore.add(customerAmount)
      );
      const orderAfter = await cryptoPlatform.orders(orderID);
      expect(orderAfter.status).to.be.equal(4);
      const customerActiveOrders = await cryptoPlatform.getCustomerActiveOrders(
        deployer.address
      );
      const contractorActiveOrders =
        await cryptoPlatform.getContractorActiveOrders(order.contractor);
      expect(customerActiveOrders.length).to.be.equal(0);
      expect(contractorActiveOrders.length).to.be.equal(0);
    });
    it("should judge order with 0% to customer with native token", async () => {
      const orderID = (await cryptoPlatform.ordersCount()).add(
        BigNumber.from(1)
      );
      await cryptoPlatform.createOrder(
        ethers.constants.AddressZero,
        "title",
        "https://www.some.com"
      );
      const contractor = accounts[0];
      const deadline = (await getCurrentTimeStamp()) + 86400;
      const price = ethers.utils.parseEther("1");
      await cryptoPlatform.startOrderExecution(
        orderID,
        contractor.address,
        deadline,
        price,
        { value: price }
      );
      const customerPercent = BigNumber.from("0");
      const contractorPercent = BigNumber.from("10000");
      const order = await cryptoPlatform.orders(orderID);
      const contractorBalanceBefore = await ethers.provider.getBalance(
        order.contractor
      );
      const cryptoPlatformBalanceBefore = await ethers.provider.getBalance(
        cryptoPlatform.address
      );
      const feeReceiverBalanceBefore = await ethers.provider.getBalance(
        feeReceiver.address
      );
      const customerBalanceBefore = await ethers.provider.getBalance(
        deployer.address
      );
      await cryptoPlatform
        .connect(judge)
        .judjeOrder(orderID, contractorPercent, customerPercent);
      const contractorBalanceAfter = await ethers.provider.getBalance(
        order.contractor
      );
      const cryptoPlatformBalanceAfter = await ethers.provider.getBalance(
        cryptoPlatform.address
      );
      const feeReceiverBalanceAfter = await ethers.provider.getBalance(
        feeReceiver.address
      );
      const customerBalanceAfter = await ethers.provider.getBalance(
        deployer.address
      );
      expect(cryptoPlatformBalanceAfter).to.be.equal(
        cryptoPlatformBalanceBefore.sub(order.price)
      );
      const fee = order.price
        .mul(await cryptoPlatform.feePercent())
        .div(await cryptoPlatform.FEE_PRECISION());
      const priceWithoutFee = order.price.sub(fee);
      const customerAmount = priceWithoutFee
        .mul(customerPercent)
        .div(BigNumber.from("10000"));
      const contractorAmount = priceWithoutFee
        .mul(contractorPercent)
        .div(BigNumber.from("10000"));
      expect(feeReceiverBalanceAfter).to.be.equal(
        feeReceiverBalanceBefore.add(fee)
      );
      expect(contractorBalanceAfter).to.be.equal(
        contractorBalanceBefore.add(contractorAmount)
      );
      expect(customerBalanceAfter).to.be.equal(
        customerBalanceBefore.add(customerAmount)
      );
      const orderAfter = await cryptoPlatform.orders(orderID);
      expect(orderAfter.status).to.be.equal(4);
      const customerActiveOrders = await cryptoPlatform.getCustomerActiveOrders(
        deployer.address
      );
      const contractorActiveOrders =
        await cryptoPlatform.getContractorActiveOrders(order.contractor);
      expect(customerActiveOrders.length).to.be.equal(0);
      expect(contractorActiveOrders.length).to.be.equal(0);
    });
  });
  describe("Success flow with native token and judge", () => {
    it("should create order", async () => {
      const orderID = (await cryptoPlatform.ordersCount()).add(
        BigNumber.from(1)
      );
      await cryptoPlatform.createOrder(
        ethers.constants.AddressZero,
        "title",
        "https://www.some.com"
      );
      const order = await cryptoPlatform.orders(orderID);
      const userActiveOrders = await cryptoPlatform.getCustomerActiveOrders(
        deployer.address
      );
      expect(order.id).to.be.equal(orderID);
      expect(order.customer).to.be.equal(deployer.address);
      expect(order.title).to.be.equal("title");
      expect(order.descriptionLink).to.be.equal("https://www.some.com");
      expect(order.status).to.be.equal(0);
      expect(order.paymentToken).to.be.equal(ethers.constants.AddressZero);
      expect(order.price).to.be.equal(0);
      expect(order.contractor).to.be.equal(ethers.constants.AddressZero);
      expect(order.deadline).to.be.equal(0);
      expect(userActiveOrders[userActiveOrders.length - 1]).to.be.equal(
        orderID
      );
    });
    it("should start order", async () => {
      const contractor = accounts[0];
      const orderID = await cryptoPlatform.ordersCount();
      const deadline = (await getCurrentTimeStamp()) + 86400;
      const price = ethers.utils.parseEther("1");
      const customerBalanceBefore = await ethers.provider.getBalance(
        deployer.address
      );
      const cryptoPlatformBalanceBefore = await ethers.provider.getBalance(
        cryptoPlatform.address
      );
      await cryptoPlatform.startOrderExecution(
        orderID,
        contractor.address,
        deadline,
        price,
        { value: price }
      );
      const customerBalanceAfter = await ethers.provider.getBalance(
        deployer.address
      );
      const cryptoPlatformBalanceAfter = await ethers.provider.getBalance(
        cryptoPlatform.address
      );
      const order = await cryptoPlatform.orders(orderID);
      const contractorActiveOrders =
        await cryptoPlatform.getContractorActiveOrders(contractor.address);
      expect(cryptoPlatformBalanceAfter).to.be.equal(
        cryptoPlatformBalanceBefore.add(price)
      );
      expect(customerBalanceAfter).to.be.lt(customerBalanceBefore);
      expect(order.status).to.be.equal(1);
      expect(order.contractor).to.be.equal(contractor.address);
      expect(order.deadline).to.be.equal(deadline);
      expect(order.price).to.be.equal(price);
      expect(
        contractorActiveOrders[contractorActiveOrders.length - 1]
      ).to.be.equal(orderID);
    });
    it("should judge order", async () => {
      const customerPercent = BigNumber.from("4000");
      const contractorPercent = BigNumber.from("6000");
      const orderID = await cryptoPlatform.ordersCount();
      const order = await cryptoPlatform.orders(orderID);
      const contractorBalanceBefore = await ethers.provider.getBalance(
        order.contractor
      );
      const cryptoPlatformBalanceBefore = await ethers.provider.getBalance(
        cryptoPlatform.address
      );
      const feeReceiverBalanceBefore = await ethers.provider.getBalance(
        feeReceiver.address
      );
      const customerBalanceBefore = await ethers.provider.getBalance(
        deployer.address
      );
      await cryptoPlatform
        .connect(judge)
        .judjeOrder(orderID, contractorPercent, customerPercent);
      const contractorBalanceAfter = await ethers.provider.getBalance(
        order.contractor
      );
      const cryptoPlatformBalanceAfter = await ethers.provider.getBalance(
        cryptoPlatform.address
      );
      const feeReceiverBalanceAfter = await ethers.provider.getBalance(
        feeReceiver.address
      );
      const customerBalanceAfter = await ethers.provider.getBalance(
        deployer.address
      );

      expect(cryptoPlatformBalanceAfter).to.be.equal(
        cryptoPlatformBalanceBefore.sub(order.price)
      );
      const fee = order.price
        .mul(await cryptoPlatform.feePercent())
        .div(await cryptoPlatform.FEE_PRECISION());
      const priceWithoutFee = order.price.sub(fee);
      const customerAmount = priceWithoutFee
        .mul(customerPercent)
        .div(BigNumber.from("10000"));
      const contractorAmount = priceWithoutFee
        .mul(contractorPercent)
        .div(BigNumber.from("10000"));
      expect(feeReceiverBalanceAfter).to.be.equal(
        feeReceiverBalanceBefore.add(fee)
      );
      expect(contractorBalanceAfter).to.be.equal(
        contractorBalanceBefore.add(contractorAmount)
      );
      expect(customerBalanceAfter).to.be.equal(
        customerBalanceBefore.add(customerAmount)
      );

      const orderAfter = await cryptoPlatform.orders(orderID);
      expect(orderAfter.status).to.be.equal(4);

      const customerActiveOrders = await cryptoPlatform.getCustomerActiveOrders(
        deployer.address
      );
      const contractorActiveOrders =
        await cryptoPlatform.getContractorActiveOrders(order.contractor);
      expect(customerActiveOrders.length).to.be.equal(0);
      expect(contractorActiveOrders.length).to.be.equal(0);
    });
  });
  describe("Cancel order", () => {
    it("should cancel order", async () => {
      const orderID = (await cryptoPlatform.ordersCount()).add(
        BigNumber.from(1)
      );
      await cryptoPlatform.createOrder(
        ethers.constants.AddressZero,
        "title",
        "https://www.some.com"
      );
      await cryptoPlatform.cancelOrderByCustomer(orderID);
      const order = await cryptoPlatform.orders(orderID);
      const userActiveOrders = await cryptoPlatform.getCustomerActiveOrders(
        deployer.address
      );
      expect(order.status).to.be.equal(3);
      expect(userActiveOrders.length).to.be.equal(0);
    });
    it("should revert cancel order if not customer", async () => {
      const orderID = (await cryptoPlatform.ordersCount()).add(
        BigNumber.from(1)
      );
      await cryptoPlatform.createOrder(
        ethers.constants.AddressZero,
        "title",
        "https://www.some.com"
      );
      await expect(
        cryptoPlatform.connect(accounts[0]).cancelOrderByCustomer(orderID)
      ).to.be.revertedWith(
        `OnlyCustomer(${orderID}, "${accounts[0].address}", "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266")`
      );
    });
    it("should revert cancel order if order in progress", async () => {
      const id = (await cryptoPlatform.ordersCount()).add(BigNumber.from(1));
      console.log(id.toString());
      await cryptoPlatform.createOrder(
        usdc.address,
        "title",
        "https://www.some.com"
      );

      const contractor = accounts[0];
      const orderID = await cryptoPlatform.ordersCount();
      const deadline = (await getCurrentTimeStamp()) + 86400;
      const price = ethers.utils.parseUnits("100", 6);
      await cryptoPlatform.startOrderExecution(
        orderID,
        contractor.address,
        deadline,
        price
      );
      await expect(
        cryptoPlatform.cancelOrderByCustomer(orderID)
      ).to.be.revertedWith(`CancelationForbidden(${orderID})`);
    });
  });
  describe("Approve order checks", async () => {
    it("should revert approve order if invalid order id", async () => {
      const orderID = BigNumber.from("100");
      await expect(cryptoPlatform.approveOrder(orderID)).to.be.revertedWith(
        `OrderDoesNotExist(${orderID})`
      );
    });
    it("should revert approve order if caller not a customer", async () => {
      const orderID = (await cryptoPlatform.ordersCount()).add(
        BigNumber.from(1)
      );
      await cryptoPlatform.createOrder(
        ethers.constants.AddressZero,
        "title",
        "https://www.some.com"
      );
      await cryptoPlatform.startOrderExecution(
        orderID,
        accounts[0].address,
        (await getCurrentTimeStamp()) + 86400,
        ethers.utils.parseEther("1"),
        { value: ethers.utils.parseEther("1") }
      );
      await expect(
        cryptoPlatform.connect(accounts[0]).approveOrder(orderID)
      ).to.be.revertedWith(
        `OnlyCustomer(${orderID}, "${accounts[0].address}", "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266")`
      );
    });
    it("should revert approve order if order not in progress", async () => {
      const orderID = (await cryptoPlatform.ordersCount()).add(
        BigNumber.from(1)
      );
      await cryptoPlatform.createOrder(
        ethers.constants.AddressZero,
        "title",
        "https://www.some.com"
      );
      await expect(cryptoPlatform.approveOrder(orderID)).to.be.revertedWith(
        `OrderNotInProgress(${orderID})`
      );
    });
  });
  describe("Start order checks", async () => {
    it("should revert start order if caller not a customer", async () => {
      const orderID = (await cryptoPlatform.ordersCount()).add(
        BigNumber.from(1)
      );
      await cryptoPlatform.createOrder(
        ethers.constants.AddressZero,
        "title",
        "https://www.some.com"
      );
      await expect(
        cryptoPlatform
          .connect(accounts[0])
          .startOrderExecution(
            orderID,
            accounts[0].address,
            (await getCurrentTimeStamp()) + 86400,
            ethers.utils.parseEther("1"),
            { value: ethers.utils.parseEther("1") }
          )
      ).to.be.revertedWith(
        `OnlyCustomer(${orderID}, "${accounts[0].address}", "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266")`
      );
    });
    it("should revert start order if order statuse != Created", async () => {
      const orderID = BigNumber.from(1);
      await expect(
        cryptoPlatform.startOrderExecution(
          orderID,
          accounts[0].address,
          (await getCurrentTimeStamp()) + 86400,
          ethers.utils.parseEther("1"),
          { value: ethers.utils.parseEther("1") }
        )
      ).to.be.revertedWith(
        `OrderAlreadyAssigned(${orderID}, "${accounts[0].address}")`
      );
    });
    it("should revert start order if deadline < now", async () => {
      const orderID = (await cryptoPlatform.ordersCount()).add(
        BigNumber.from(1)
      );
      await cryptoPlatform.createOrder(
        ethers.constants.AddressZero,
        "title",
        "https://www.some.com"
      );
      await expect(
        cryptoPlatform.startOrderExecution(
          orderID,
          accounts[0].address,
          (await getCurrentTimeStamp()) - 86400,
          ethers.utils.parseEther("1"),
          { value: ethers.utils.parseEther("1") }
        )
      ).to.be.revertedWith(`IncorrectDeadline("_deadline")`);
    });
    it("should revert start order if contractor address is zero", async () => {
      const orderID = (await cryptoPlatform.ordersCount()).add(
        BigNumber.from(1)
      );
      await cryptoPlatform.createOrder(
        ethers.constants.AddressZero,
        "title",
        "https://www.some.com"
      );
      await expect(
        cryptoPlatform.startOrderExecution(
          orderID,
          ethers.constants.AddressZero,
          (await getCurrentTimeStamp()) + 86400,
          ethers.utils.parseEther("1"),
          { value: ethers.utils.parseEther("1") }
        )
      ).to.be.revertedWith(`ZeroAddress("_contractor")`);
    });
    it("should revert start order if price is zero", async () => {
      const orderID = (await cryptoPlatform.ordersCount()).add(
        BigNumber.from(1)
      );
      await cryptoPlatform.createOrder(
        ethers.constants.AddressZero,
        "title",
        "https://www.some.com"
      );
      await expect(
        cryptoPlatform.startOrderExecution(
          orderID,
          accounts[0].address,
          (await getCurrentTimeStamp()) + 86400,
          ethers.constants.Zero,
          { value: ethers.constants.Zero }
        )
      ).to.be.revertedWith(`ZeroValue("_price")`);
    });
  });
  describe("Judje order checks", async () => {
    it("should revert judge order if not judge", async () => {
      const customerPercent = BigNumber.from("5000");
      const contractorPercent = BigNumber.from("5000");
      const orderID = await cryptoPlatform.ordersCount();
      await expect(
        cryptoPlatform.judjeOrder(orderID, contractorPercent, customerPercent)
      ).to.be.reverted;
    });
    it("should revert judge order if order not in progress", async () => {
      const customerPercent = BigNumber.from("5000");
      const contractorPercent = BigNumber.from("5000");
      const orderID = BigNumber.from(1);
      await expect(
        cryptoPlatform
          .connect(judge)
          .judjeOrder(orderID, contractorPercent, customerPercent)
      ).to.be.revertedWith(`OrderNotInProgress(${orderID})`);
    });
    it("should revert judge order if percent sum > 10000", async () => {
      const customerPercent = BigNumber.from("5000");
      const contractorPercent = BigNumber.from("5001");
      const orderID = await cryptoPlatform.ordersCount();
      await expect(
        cryptoPlatform
          .connect(judge)
          .judjeOrder(orderID, contractorPercent, customerPercent)
      ).to.be.revertedWith(
        `IncorrectPercent("_contractorPercent + _customerPercent")`
      );
    });
  });
  describe("Flow with zero fee", () => {
    it("should not charge fee in aprvove order - ERC20", async () => {
      await cryptoPlatform.connect(judge).updateFeePercent(0);
      const orderID = (await cryptoPlatform.ordersCount()).add(
        BigNumber.from(1)
      );
      await cryptoPlatform.createOrder(
        usdc.address,
        "title",
        "https://www.some.com"
      );
      await usdc
        .connect(deployer)
        .approve(cryptoPlatform.address, ethers.utils.parseUnits("1000", 6));
      const contractor = accounts[0];
      const deadline = (await getCurrentTimeStamp()) + 86400;
      const price = ethers.utils.parseUnits("100", 6);

      await cryptoPlatform.startOrderExecution(
        orderID,
        contractor.address,
        deadline,
        price
      );
      const contractorBalanceBefore = await usdc.balanceOf(contractor.address);
      const cryptoPlatformBalanceBefore = await usdc.balanceOf(
        cryptoPlatform.address
      );
      const feeReceiverBalanceBefore = await usdc.balanceOf(
        feeReceiver.address
      );
      await cryptoPlatform.approveOrder(orderID);
      const contractorBalanceAfter = await usdc.balanceOf(contractor.address);
      const cryptoPlatformBalanceAfter = await usdc.balanceOf(
        cryptoPlatform.address
      );
      const feeReceiverBalanceAfter = await usdc.balanceOf(feeReceiver.address);
      expect(cryptoPlatformBalanceAfter).to.be.equal(
        cryptoPlatformBalanceBefore.sub(price)
      );
      expect(feeReceiverBalanceAfter).to.be.equal(feeReceiverBalanceBefore);
      expect(contractorBalanceAfter).to.be.equal(
        contractorBalanceBefore.add(price)
      );
    });
    it("should not charge fee in aprvove order - native token", async () => {
      await cryptoPlatform.connect(judge).updateFeePercent(0);
      const orderID = (await cryptoPlatform.ordersCount()).add(
        BigNumber.from(1)
      );
      await cryptoPlatform.createOrder(
        ethers.constants.AddressZero,
        "title",
        "https://www.some.com"
      );
      const contractor = accounts[0];
      const deadline = (await getCurrentTimeStamp()) + 86400;
      const price = ethers.utils.parseEther("1");
      await cryptoPlatform.startOrderExecution(
        orderID,
        contractor.address,
        deadline,
        price,
        { value: price }
      );
      const contractorBalanceBefore = await ethers.provider.getBalance(
        contractor.address
      );
      const cryptoPlatformBalanceBefore = await ethers.provider.getBalance(
        cryptoPlatform.address
      );
      const feeReceiverBalanceBefore = await ethers.provider.getBalance(
        feeReceiver.address
      );
      await cryptoPlatform.approveOrder(orderID);
      const contractorBalanceAfter = await ethers.provider.getBalance(
        contractor.address
      );
      const cryptoPlatformBalanceAfter = await ethers.provider.getBalance(
        cryptoPlatform.address
      );
      const feeReceiverBalanceAfter = await ethers.provider.getBalance(
        feeReceiver.address
      );
      expect(cryptoPlatformBalanceAfter).to.be.equal(
        cryptoPlatformBalanceBefore.sub(price)
      );
      expect(feeReceiverBalanceAfter).to.be.equal(feeReceiverBalanceBefore);
      expect(contractorBalanceAfter).to.be.equal(
        contractorBalanceBefore.add(price)
      );
    });
    it("should not charge fee in judge order - ERC20", async () => {
      await cryptoPlatform.connect(judge).updateFeePercent(0);
      await cryptoPlatform.createOrder(
        usdc.address,
        "title",
        "https://www.some.com"
      );
      await cryptoPlatform.startOrderExecution(
        await cryptoPlatform.ordersCount(),
        accounts[0].address,
        (await getCurrentTimeStamp()) + 86400,
        ethers.utils.parseUnits("100", 6)
      );
      const customerPercent = BigNumber.from("5000");
      const contractorPercent = BigNumber.from("5000");
      const orderID = await cryptoPlatform.ordersCount();
      const order = await cryptoPlatform.orders(orderID);
      const contractorBalanceBefore = await usdc.balanceOf(order.contractor);
      const cryptoPlatformBalanceBefore = await usdc.balanceOf(
        cryptoPlatform.address
      );
      const feeReceiverBalanceBefore = await usdc.balanceOf(
        feeReceiver.address
      );
      const customerBalanceBefore = await usdc.balanceOf(deployer.address);
      await cryptoPlatform
        .connect(judge)
        .judjeOrder(orderID, contractorPercent, customerPercent);
      const contractorBalanceAfter = await usdc.balanceOf(order.contractor);
      const cryptoPlatformBalanceAfter = await usdc.balanceOf(
        cryptoPlatform.address
      );
      const feeReceiverBalanceAfter = await usdc.balanceOf(feeReceiver.address);
      const customerBalanceAfter = await usdc.balanceOf(deployer.address);

      expect(cryptoPlatformBalanceAfter).to.be.equal(
        cryptoPlatformBalanceBefore.sub(order.price)
      );
      expect(feeReceiverBalanceAfter).to.be.equal(feeReceiverBalanceBefore);
      expect(contractorBalanceAfter).to.be.equal(
        contractorBalanceBefore.add(
          order.price.mul(contractorPercent).div(10000)
        )
      );
      expect(customerBalanceAfter).to.be.equal(
        customerBalanceBefore.add(order.price.mul(customerPercent).div(10000))
      );
    });
    it("should not charge fee in judge order - native token", async () => {
      await cryptoPlatform.connect(judge).updateFeePercent(0);
      await cryptoPlatform.createOrder(
        ethers.constants.AddressZero,
        "title",
        "https://www.some.com"
      );
      await cryptoPlatform.startOrderExecution(
        await cryptoPlatform.ordersCount(),
        accounts[0].address,
        (await getCurrentTimeStamp()) + 86400,
        ethers.utils.parseEther("1"),
        { value: ethers.utils.parseEther("1") }
      );
      const customerPercent = BigNumber.from("5000");
      const contractorPercent = BigNumber.from("5000");
      const orderID = await cryptoPlatform.ordersCount();
      const order = await cryptoPlatform.orders(orderID);
      const contractorBalanceBefore = await ethers.provider.getBalance(
        order.contractor
      );
      const cryptoPlatformBalanceBefore = await ethers.provider.getBalance(
        cryptoPlatform.address
      );
      const feeReceiverBalanceBefore = await ethers.provider.getBalance(
        feeReceiver.address
      );
      const customerBalanceBefore = await ethers.provider.getBalance(
        deployer.address
      );
      await cryptoPlatform
        .connect(judge)
        .judjeOrder(orderID, contractorPercent, customerPercent);
      const contractorBalanceAfter = await ethers.provider.getBalance(
        order.contractor
      );
      const cryptoPlatformBalanceAfter = await ethers.provider.getBalance(
        cryptoPlatform.address
      );
      const feeReceiverBalanceAfter = await ethers.provider.getBalance(
        feeReceiver.address
      );
      const customerBalanceAfter = await ethers.provider.getBalance(
        deployer.address
      );

      expect(cryptoPlatformBalanceAfter).to.be.equal(
        cryptoPlatformBalanceBefore.sub(order.price)
      );
      expect(feeReceiverBalanceAfter).to.be.equal(feeReceiverBalanceBefore);
      expect(contractorBalanceAfter).to.be.equal(
        contractorBalanceBefore.add(
          order.price.mul(contractorPercent).div(10000)
        )
      );
      expect(customerBalanceAfter).to.be.equal(
        customerBalanceBefore.add(order.price.mul(customerPercent).div(10000))
      );
    });
  });

  describe("Reverts", () => {
    it("should revert create order if invalid title", async () => {
      await expect(
        cryptoPlatform.createOrder(
          ethers.constants.AddressZero,
          "",
          "https://www.some.com"
        )
      ).to.be.revertedWith('ZeroValue("_title")');
    });
    it("should revert create order if invalid description url", async () => {
      await expect(
        cryptoPlatform.createOrder(ethers.constants.AddressZero, "title", "")
      ).to.be.revertedWith('ZeroValue("_descriptionLink")');
    });
    it("should revert create order if passed unsupported token", async () => {
      await expect(
        cryptoPlatform.createOrder(
          deployer.address,
          "title",
          "https://www.some.com"
        )
      ).to.be.revertedWith(`UnSupportedPaymentToken("${deployer.address}")`);
    });
  });
  describe("Admin functions", () => {
    it("should update fee percent", async () => {
      const newFeePercent = BigNumber.from("1000");
      await cryptoPlatform.connect(judge).updateFeePercent(newFeePercent);
      expect(await cryptoPlatform.feePercent()).to.be.equal(newFeePercent);
    });
    it("should revert update fee percent if not judge", async () => {
      const newFeePercent = BigNumber.from("1000");
      await expect(cryptoPlatform.updateFeePercent(newFeePercent)).to.be
        .reverted;
    });
    it("should revert update fee percent if percent > 10000", async () => {
      const newFeePercent = BigNumber.from("10001");
      await expect(
        cryptoPlatform.connect(judge).updateFeePercent(newFeePercent)
      ).to.be.revertedWith(`IncorrectPercent("_feePercent")`);
    });
    it("should update fee receiver", async () => {
      const newFeeReceiver = accounts[0].address;
      await cryptoPlatform.connect(judge).updateFeeReceiver(newFeeReceiver);
      expect(await cryptoPlatform.feeReceiver()).to.be.equal(newFeeReceiver);
    });
    it("should revert update fee receiver if not judge", async () => {
      const newFeeReceiver = accounts[0].address;
      await expect(cryptoPlatform.updateFeeReceiver(newFeeReceiver)).to.be
        .reverted;
    });
    it("should add payment token", async () => {
      const newToken = accounts[0].address;
      await cryptoPlatform.connect(judge).addPaymentToken(newToken);
      const tokens = await cryptoPlatform.getPaymentTokens();
      expect(tokens[tokens.length - 1]).to.be.equal(newToken);
    });
    it("should revert add payment token if not judge", async () => {
      const newToken = accounts[0].address;
      await expect(
        cryptoPlatform.connect(accounts[1]).addPaymentToken(newToken)
      ).to.be.reverted;
    });
    it("should revert add payment token if token already added", async () => {
      const newToken = accounts[0].address;
      await expect(
        cryptoPlatform.connect(judge).addPaymentToken(newToken)
      ).to.be.revertedWith("Already added");
    });
    it("should remove payment token", async () => {
      const token = accounts[0].address;
      await cryptoPlatform.connect(judge).removePaymentToken(token);
      const tokens = await cryptoPlatform.getPaymentTokens();
      expect(tokens[tokens.length - 1]).to.not.be.equal(token);
    });
    it("should revert remove payment token if not admin", async () => {
      const token = accounts[0].address;
      await expect(
        cryptoPlatform.connect(accounts[1]).removePaymentToken(token)
      ).to.be.reverted;
    });
    it("should revert remove payment token if token not added", async () => {
      const token = accounts[0].address;
      await expect(
        cryptoPlatform.connect(judge).removePaymentToken(token)
      ).to.be.revertedWith("Not added");
    });
    it("should update order contractor by admin", async () => {
      const orderID = (await cryptoPlatform.ordersCount()).add(
        BigNumber.from(1)
      );
      await cryptoPlatform.createOrder(
        usdc.address,
        "title",
        "https://www.some.com"
      );
      await cryptoPlatform.startOrderExecution(
        orderID,
        accounts[0].address,
        (await getCurrentTimeStamp()) + 86400,
        ethers.utils.parseUnits("100", 6)
      );

      const newContractor = accounts[1].address;
      await cryptoPlatform
        .connect(judge)
        .updateOrderContractor(orderID, newContractor);
      const order = await cryptoPlatform.orders(orderID);
      expect(order.contractor).to.be.equal(newContractor);
    });
    it("should revert update contractor if caller not admin", async () => {
      const orderID = (await cryptoPlatform.ordersCount()).add(
        BigNumber.from(1)
      );
      await cryptoPlatform.createOrder(
        usdc.address,
        "title",
        "https://www.some.com"
      );
      await cryptoPlatform.startOrderExecution(
        orderID,
        accounts[0].address,
        (await getCurrentTimeStamp()) + 86400,
        ethers.utils.parseUnits("100", 6)
      );

      const newContractor = accounts[1].address;
      await expect(cryptoPlatform.updateOrderContractor(orderID, newContractor))
        .to.be.reverted;
    });
    it("should revert update contractor if order not in progress", async () => {
      const orderID = BigNumber.from(1);
      const newContractor = accounts[1].address;
      await expect(
        cryptoPlatform
          .connect(judge)
          .updateOrderContractor(orderID, newContractor)
      ).to.be.revertedWith(`OrderNotInProgress(${orderID})`);
    });
    it("should revert update contractor if contractor address is zero", async () => {
      const orderID = (await cryptoPlatform.ordersCount()).add(
        BigNumber.from(1)
      );
      await cryptoPlatform.createOrder(
        ethers.constants.AddressZero,
        "title",
        "https://www.some.com"
      );
      await cryptoPlatform.startOrderExecution(
        orderID,
        accounts[0].address,
        (await getCurrentTimeStamp()) + 86400,
        ethers.utils.parseEther("1"),
        { value: ethers.utils.parseEther("1") }
      );
      const newContractor = ethers.constants.AddressZero;
      await expect(
        cryptoPlatform
          .connect(judge)
          .updateOrderContractor(orderID, newContractor)
      ).to.be.revertedWith(`ZeroAddress("_contractor")`);
    });
    it("should revert emergencyWithdraw if not admin", async () => {
      await expect(
        cryptoPlatform
          .connect(accounts[3])
          .emergencyWithdraw(
            usdc.address,
            deployer.address,
            ethers.utils.parseEther("1")
          )
      ).to.be.reverted;
    });
  });

  describe("Pause flow", async () => {
    it("should pause contract", async () => {
      await cryptoPlatform.connect(judge).pausePlatform();
      expect(await cryptoPlatform.paused()).to.be.equal(true);
    });
    it("should revert create order if contract paused", async () => {
      await expect(
        cryptoPlatform.createOrder(
          ethers.constants.AddressZero,
          "title",
          "https://www.some.com"
        )
      ).to.be.revertedWith("EnforcedPause()");
    });
    it("should revert start order if contract paused", async () => {
      await expect(
        cryptoPlatform.startOrderExecution(
          await cryptoPlatform.ordersCount(),
          accounts[0].address,
          (await getCurrentTimeStamp()) + 86400,
          ethers.utils.parseEther("1"),
          { value: ethers.utils.parseEther("1") }
        )
      ).to.be.revertedWith("EnforcedPause()");
    });
    it("should revert approve order if contract paused", async () => {
      await expect(
        cryptoPlatform.approveOrder(await cryptoPlatform.ordersCount())
      ).to.be.revertedWith("EnforcedPause()");
    });
    it("should revert cancel order by customer if contract paused", async () => {
      await expect(
        cryptoPlatform.cancelOrderByCustomer(await cryptoPlatform.ordersCount())
      ).to.be.revertedWith("EnforcedPause()");
    });
    it("should revert judge order if contract paused", async () => {
      await expect(
        cryptoPlatform
          .connect(judge)
          .judjeOrder(
            await cryptoPlatform.ordersCount(),
            BigNumber.from("5000"),
            BigNumber.from("5000")
          )
      ).to.be.revertedWith("EnforcedPause()");
    });
    it("should revert update order contractor if contract paused", async () => {
      await expect(
        cryptoPlatform
          .connect(judge)
          .updateOrderContractor(
            await cryptoPlatform.ordersCount(),
            accounts[0].address
          )
      ).to.be.revertedWith("EnforcedPause()");
    });
    it("should emergency withdraw ERC20", async () => {
      await usdc.transfer(
        cryptoPlatform.address,
        ethers.utils.parseUnits("100", 6)
      );
      const balanceBefore = await usdc.balanceOf(cryptoPlatform.address);
      const receiverBalanceBefore = await usdc.balanceOf(deployer.address);
      await cryptoPlatform
        .connect(judge)
        .emergencyWithdraw(usdc.address, deployer.address, balanceBefore);
      const balanceAfter = await usdc.balanceOf(cryptoPlatform.address);
      const receiverBalanceAfter = await usdc.balanceOf(deployer.address);
      expect(balanceAfter).to.be.equal(0);
      expect(receiverBalanceAfter).to.be.equal(
        receiverBalanceBefore.add(balanceBefore)
      );
    });
    it("should emergency withdraw native token", async () => {
      const balanceBefore = await ethers.provider.getBalance(
        cryptoPlatform.address
      );
      const receiverBalanceBefore = await ethers.provider.getBalance(
        deployer.address
      );
      await cryptoPlatform
        .connect(judge)
        .emergencyWithdraw(
          ethers.constants.AddressZero,
          deployer.address,
          balanceBefore
        );
      const balanceAfter = await ethers.provider.getBalance(
        cryptoPlatform.address
      );
      const receiverBalanceAfter = await ethers.provider.getBalance(
        deployer.address
      );
      expect(balanceAfter).to.be.equal(0);
      expect(receiverBalanceAfter).to.be.equal(
        receiverBalanceBefore.add(balanceBefore)
      );
    });
    it("should revert emergency withdraw if not admin", async () => {
      await expect(
        cryptoPlatform
          .connect(accounts[0])
          .emergencyWithdraw(
            ethers.constants.AddressZero,
            deployer.address,
            ethers.utils.parseEther("1")
          )
      ).to.be.reverted;
    });
    it("should revert pause if not admin", async () => {
      await expect(cryptoPlatform.pausePlatform()).to.be.reverted;
    });
    it("should revert unpause if not admin", async () => {
      await expect(cryptoPlatform.unpausePlatform()).to.be.reverted;
    });
    it("should unpause contract", async () => {
      await cryptoPlatform.connect(judge).unpausePlatform();
      expect(await cryptoPlatform.paused()).to.be.equal(false);
    });
  });
  describe("Failed Native transfer", () => {
    it("should revert if native transfer failed", async () => {
      const receiverFactory = await ethers.getContractFactory(
        "TestNativeReceiver"
      );
      const receiver = await receiverFactory.deploy();

      const orderID = (await cryptoPlatform.ordersCount()).add(
        BigNumber.from(1)
      );
      await cryptoPlatform.createOrder(
        ethers.constants.AddressZero,
        "title",
        "https://www.some.com"
      );
      const contractor = accounts[0];
      const deadline = (await getCurrentTimeStamp()) + 86400;
      const price = ethers.utils.parseEther("1");
      await cryptoPlatform.startOrderExecution(
        orderID,
        contractor.address,
        deadline,
        price,
        { value: price }
      );

      await cryptoPlatform.connect(judge).updateFeePercent(500);
      await cryptoPlatform.connect(judge).updateFeeReceiver(receiver.address);
      await expect(cryptoPlatform.approveOrder(orderID)).to.be.revertedWith(
        "TransferFailed()"
      );
    });
  });
});
