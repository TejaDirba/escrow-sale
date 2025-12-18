const EscrowSale = artifacts.require("EscrowSale");

module.exports = async function (deployer) {
  const price = 1000;      // 1000 wei
  const courierFee = 100;  // 100 wei

  await deployer.deploy(EscrowSale, price, courierFee);
};
