// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract EscrowSale {
    enum State { Created, Funded, Shipped, Delivered, Completed, Cancelled }

    address payable public seller;
    address payable public buyer;
    address payable public courier;

    uint256 public price;
    uint256 public courierFee;
    State public state;

    event Funded(address indexed buyer, uint256 amount);
    event Shipped(address indexed courier);
    event Delivered(address indexed buyer);
    event Completed(address indexed seller, address indexed courier);
    event Cancelled();
    event Refunded(address indexed buyer, uint256 amount);

    constructor(
        uint256 _price,
        uint256 _courierFee
    ) {
        seller = payable(msg.sender);
        price = _price;
        courierFee = _courierFee;
        state = State.Created;
    }

    modifier onlyBuyer() {
        require(msg.sender == buyer, "Not buyer");
        _;
    }

    modifier onlySeller() {
        require(msg.sender == seller, "Not seller");
        _;
    }

    modifier onlyCourier() {
        require(msg.sender == courier, "Not courier");
        _;
    }

    modifier inState(State _state) {
        require(state == _state, "Invalid state");
        _;
    }

    // Prisiregistruoja pirkėjas (tas, kas kviečia funkciją)
    function registerBuyer() external {
        require(buyer == address(0), "Buyer already set");
        buyer = payable(msg.sender);
    }

    // Prisiregistruoja kurjeris
    function registerCourier() external {
        require(courier == address(0), "Courier already set");
        courier = payable(msg.sender);
    }

    // Buyer i kontrakta sumoka price + courierFee
    function fundPurchase()
        external
        payable
        onlyBuyer
        inState(State.Created)
    {
        require(msg.value == price + courierFee, "Incorrect value");
        state = State.Funded;
        emit Funded(msg.sender, msg.value);
    }

    // Courier pazymi, kad issiunte
    function markShipped()
        external
        onlyCourier
        inState(State.Funded)
    {
        state = State.Shipped;
        emit Shipped(msg.sender);
    }

    // Buyer patvirtina pristatyma
    function confirmDelivered()
        external
        onlyBuyer
        inState(State.Shipped)
    {
        state = State.Delivered;
        emit Delivered(msg.sender);
    }

    // Galutinis uzdarymas: ismoka seller ir courier
    function complete()
        external
        inState(State.Delivered)
    {
        require(
            msg.sender == buyer || msg.sender == seller,
            "Not authorized"
        );

        uint256 sellerAmount = price;
        uint256 courierAmount = courierFee;
        uint256 bal = address(this).balance;

        require(
            bal == sellerAmount + courierAmount,
            "Unexpected balance"
        );

        state = State.Completed;

        (bool okSeller, ) = seller.call{value: sellerAmount}("");
        require(okSeller, "Pay seller failed");

        (bool okCourier, ) = courier.call{value: courierAmount}("");
        require(okCourier, "Pay courier failed");

        emit Completed(seller, courier);
    }

    // Seller gali atšaukti, kol dar niekas nesufundino
    function cancelBySeller()
        external
        onlySeller
        inState(State.Created)
    {
        state = State.Cancelled;
        emit Cancelled();
    }

    // Seller grazina pinigus buyer, jei jau Funded
    function refundBuyer()
        external
        onlySeller
        inState(State.Funded)
    {
        state = State.Cancelled;

        uint256 amount = address(this).balance;

        (bool ok, ) = buyer.call{value: amount}("");
        require(ok, "Refund failed");

        emit Refunded(buyer, amount);
    }
}