# EscrowSale

Šiame projekte sukurta ir ištestuota išmanioji sutartis (**smart contract**) `EscrowSale` ir paprasta decentralizuota aplikacija (**DApp**), veikianti Ethereum testiniame tinkle **Sepolia**.

Tikslas – pademonstruoti:

* kaip realus verslo scenarijus (prekių pardavimas su kurjerio pristatymu) perkeliamas į smart contract logiką;
* kaip kontraktas testuojamas lokaliai (Truffle) ir testnete (Sepolia);
* kaip su juo bendraujama per web UI (ethers.js + MetaMask);
* kaip rezultatai matomi ir tikrinami per Etherscan logus.

---

## Technologijos

* **Solidity** 0.8.20
* **Truffle** v5 (`truffle develop`)
* **Remix IDE**
* **MetaMask** (Sepolia testnet)
* **Etherscan** (`sepolia.etherscan.io`)
* **ethers.js** 6.x (front-end)

---

## Verslo scenarijus

Sistema modeliuoja internetinį pardavimą su kurjerio pristatymu:

* **Seller**
  Deploy’ina kontraktą ir nustato:

  * prekės kainą `price`;
  * kurjerio mokestį `courierFee`.
    Nori gauti `price` tik po sėkmingo pristatymo.

* **Buyer**
  Per kontraktą iš karto sumoka `price + courierFee`.
  Kol pirkėjas nepatvirtina gavimo, pinigai laikomi kontrakte.

* **Courier**
  Pristato prekę ir gavus pirkėjo patvirtinimą gauna `courierFee`.

* **EscrowSale**
  Laiko lėšas, saugo adresus, tikrina būsenas ir galiausiai paskirsto `price` ir `courierFee` atitinkamiems dalyviams.

### Tipinė eiga

1. Seller deploy’ina kontraktą su `price` ir `courierFee` → būsena **Created**.
2. Buyer kviečia `registerBuyer()`.
3. Courier kviečia `registerCourier()`.
4. Buyer kviečia `fundPurchase()` ir perveda `price + courierFee` → būsena **Funded**.
5. Courier kviečia `markShipped()` → būsena **Shipped**.
6. Buyer kviečia `confirmDelivered()` → būsena **Delivered**.
7. Seller arba Buyer kviečia `complete()`:

   * `price` pervedamas seller;
   * `courierFee` pervedamas courier;
   * būsena → **Completed**.

### Alternatyvos

* `cancelBySeller()` iš **Created** → **Cancelled** (dar nėra lėšų).
* `refundBuyer()` iš **Funded** → **Cancelled**, visas balansas grąžinamas buyer.

---

## Kontrakto dizainas

### Enum ir būsenų mašina

```solidity
enum State { Created, Funded, Shipped, Delivered, Completed, Cancelled }
State public state;
```

Trumpai:

* `Created` – kontraktas sukurtas, dar neapmokėta.
* `Funded` – pirkėjas sumokėjo `price + courierFee`.
* `Shipped` – kurjeris pažymėjo išsiuntimą.
* `Delivered` – pirkėjas patvirtino gavimą.
* `Completed` – lėšos išmokėtos.
* `Cancelled` – sandoris nutrauktas.

`enum` čia yra baigtinė būsenų aibė – kontraktas gali būti tik vienoje iš šių stadijų, o perėjimus griežtai kontroliuoja funkcijos + `require`.

### Kintamieji ir konstruktorius

```solidity
address public seller;
address public buyer;
address public courier;

uint256 public price;
uint256 public courierFee;

constructor(uint256 _price, uint256 _courierFee) {
    seller = msg.sender;
    price = _price;
    courierFee = _courierFee;
    state = State.Created;
}
```

* `seller` – tas adresas, kuris deploy’ino kontraktą.
* `price`, `courierFee` – nustatomi deploy metu (WEI).

### Modifier’iai (prieigos kontrolė + būsena)

```solidity
modifier onlyBuyer()   { require(msg.sender == buyer,   "Not buyer");   _; }
modifier onlySeller()  { require(msg.sender == seller,  "Not seller");  _; }
modifier onlyCourier() { require(msg.sender == courier, "Not courier"); _; }

modifier inState(State _state) {
    require(state == _state, "Invalid state");
    _;
}
```

* **Access control** – kas gali kviesti:

  * buyer: `fundPurchase`, `confirmDelivered`;
  * courier: `markShipped`;
  * seller: `cancelBySeller`, `refundBuyer`;
  * seller arba buyer: `complete`.
* **State validation** – kada gali kviesti:

  * pvz. `markShipped` leidžiamas tik iš `Funded`,
  * `complete` – tik iš `Delivered` ir t. t.

### Pagrindinės funkcijos (santrauka)

* `registerBuyer()` – nustato pirkėjo adresą, leidžiama tik kartą (`Buyer already set` apsauga).
* `registerCourier()` – nustato kurjerio adresą, leidžiama tik kartą.
* `fundPurchase()` – tik buyer, būsena `Created`, reikalauja `msg.value == price + courierFee`, keičia būseną į `Funded`.
* `markShipped()` – tik courier, iš `Funded` → `Shipped`.
* `confirmDelivered()` – tik buyer, iš `Shipped` → `Delivered`.
* `complete()` – seller arba buyer, iš `Delivered`:

  * keičia būseną į `Completed`;
  * perveda `price` seller ir `courierFee` courier.
* `cancelBySeller()` – tik seller, iš `Created` → `Cancelled`.
* `refundBuyer()` – tik seller, iš `Funded` → `Cancelled`, grąžina visą `address(this).balance` buyer.

Kontraktas taip pat emituoja event’us (pvz. `Funded`, `Shipped`, `Completed`), kurie matomi Etherscan `Logs` skiltyje.

---

## Testavimas su Truffle

Trumpai:

* sukurtas Truffle projektas (`truffle init`);
* `EscrowSale.sol` įdėtas į `contracts/`;
* migracija `2_deploy_escrow.js` deploy’ina kontraktą su paprastomis reikšmėmis (pvz. `price = 1000`, `courierFee = 100`).

Lokali grandinė:

```bash
truffle develop
truffle(develop)> compile
truffle(develop)> migrate --reset
```

Interaktyvus testavimas Truffle konsolėje:

```js
const instance = await EscrowSale.deployed()
const accounts = await web3.eth.getAccounts()

await instance.registerBuyer({ from: accounts[1] })
await instance.registerCourier({ from: accounts[2] })
await instance.fundPurchase({ from: accounts[1], value: 1100 })
await instance.markShipped({ from: accounts[2] })
await instance.confirmDelivered({ from: accounts[1] })
await instance.complete({ from: accounts[0] })

(await instance.state()).toString() // 4 (Completed)
```

Papildomai parašytas automatinis testas `test/escrow.test.js`, kuris prasuką pilną seką ir tikrina, kad galutinė būsena yra `Completed`.
`truffle test` → **1 passing**.

---

## Deploy į Sepolia ir Etherscan

Deploy atliktas per Remix + MetaMask:

* `Environment: Injected Provider - MetaMask`
* Tinklas: **Sepolia test network**
* Kontraktas: `EscrowSale`
* Konstruktoriaus parametrai (WEI):

  * `_price = 1000000000000000` (0.001 ETH)
  * `_courierFee = 500000000000000` (0.0005 ETH)

Pavyzdinis deployed kontrakto adresas (Sepolia):

```text
0x627FED1407E15faF1D237e466d7603eB8bDC771
```

Etherscan rodo:

* kvietimus `Register Buyer`, `Register Courier`, `Fund Purchase`, `Mark Shipped`, `Confirm Delivered`, `Complete`;
* **internal transactions**, kai `complete()` perveda lėšas seller ir courier;
* event’us (`Funded`, `Completed`, …) `Logs` skiltyje.

---

## DApp: ethers.js + MetaMask

Front-end susideda iš:

* `index.html` – paprastas UI (mygtukai, įvesties laukai, „Current state“ tekstas).
* `app.js` – logika:

  * jungiasi prie MetaMask:

    ```js
    await ethereum.request({ method: 'eth_requestAccounts' })
    ```

  * kuria provider ir contract objektą:

    ```js
    const provider = new ethers.BrowserProvider(window.ethereum)
    const signer = await provider.getSigner()
    const contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, signer)
    ```

Mygtukai kviečia kontrakto funkcijas (`registerBuyer`, `registerCourier`, `fundPurchase`, `markShipped`, `confirmDelivered`, `complete`). Po kiekvieno `tx.wait()` UI vėl kviečia `contract.state()` ir atnaujina rodomą būseną.

Jei pažeidžiamos `require` sąlygos (pvz. pakartotinis `registerBuyer`), DApp gauna `execution reverted: "..."` klaidą iš MetaMask/ethers ir parodo ją vartotojui.

---

## Sekų diagrama (verslo lygis)

### Dalyviai:

*	Seller
*	Buyer
*	Courier
*	EscrowSale (kontraktas)

### Loginė seka:
1.	Seller → EscrowSale: `deploy(_price, _courierFee)` → **Created**
    - Kontraktas sukuriamas, būsena Created.
2.	Buyer → EscrowSale: `registerBuyer()`
    - Išsaugomas pirkėjo adresas, patvirtinama, kad vėliau tik jis galės mokėti ir patvirtinti pristatymą.
3.	Courier → EscrowSale: `registerCourier()`
    - Išsaugomas kurjerio adresas.
4.	Buyer → EscrowSale: `fundPurchase(value = price + courierFee)` → **Funded**
    - Pinigai patenka į kontraktą, būsena → Funded.
5.	Courier → EscrowSale: `markShipped()` → **Shipped**
    - Pažymima, kad siunta išsiųsta, būsena → Shipped.
6.	Buyer → EscrowSale: `confirmDelivered()` → **Delivered**
    - Pirkėjas patvirtina, kad prekę gavo, būsena → Delivered.
7.	Seller (arba Buyer) → EscrowSale: `complete()` → **Completed**
    - Kontraktas:
        - perveda price pardavėjui,
        - perveda courierFee kurjeriui,
        - nustato state = Completed. 

![alt text](image-3.png)

---

## Išvados ir galimi patobulinimai

Padaryta:

* sutartis, modeliuojanti realų escrow scenarijų su trimis rolėmis ir enum būsenų mašina;
* lokaliai ištestuotas kontraktas (Truffle, automatiniai testai);
* deploy į Sepolia ir patikrinimas per Etherscan;
* veikiančios DApp prototipas su ethers.js ir MetaMask.
