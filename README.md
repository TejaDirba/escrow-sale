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

Sistema modeliuoja internetinę prekybą (su kurjerio pristatymu):

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