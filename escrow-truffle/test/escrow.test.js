const EscrowSale = artifacts.require("EscrowSale");

contract("EscrowSale", (accounts) => {
  const [seller, buyer, courier] = accounts;
  const price = 1000;
  const fee = 100;

  let instance;

  beforeEach(async () => {
    instance = await EscrowSale.new(price, fee, { from: seller });
  });

  it("should complete full flow", async () => {
    await instance.registerBuyer({ from: buyer });
    await instance.registerCourier({ from: courier });
    await instance.fundPurchase({ from: buyer, value: price + fee });
    await instance.markShipped({ from: courier });
    await instance.confirmDelivered({ from: buyer });
    await instance.complete({ from: seller });

    const state = await instance.state();
    assert.equal(state.toNumber(), 4, "State should be Completed");
  });
});
