# escrow-sale

Šiame darbe sukurta ir ištestuota išmanioji sutartis (smart contract) „EscrowSale“ bei paprasta decentralizuota aplikacija (DApp), veikianti Ethereum testiniame tinkle Sepolia.  
Pagrindinis tikslas – pademonstruoti:  
      kaip verslo scenarijus (prekių pardavimas su kurjerio pristatymu) perkeliamas į smart contract logiką;  
      kaip šis kontraktas:  
          testuojamas lokaliame blockchain’e naudojant Truffle;  
          deploy’inamas į viešą testnet (Sepolia) per Remix + MetaMask;  
          naudojamas realiu laiku per web UI (ethers.js pagrindu su MetaMask integracija);  
          analizuojamas per Etherscan logus ir internal transakcijas.  

Naudotos technologijos:  
    Solidity 0.8.20  
    Truffle v5 + vidinis „truffle develop“ tinklas  
    Remix IDE  
    MetaMask (Sepolia testnet)  
    Etherscan (sepolia.etherscan.io)  
    ethers.js 6.x front-end dalyje  

________________________________________
2. Verslo scenarijus ir dalyviai  
   
Sistema modeliuoja situaciją, kai prekė parduodama internetu ir pristatoma per kurjerį. Siekiama užtikrinti, kad nei pirkėjas, nei pardavėjas negalėtų „pasisavinti“ pinigų vienišališkai – naudomas escrow mechanizmas.  
**Dalyviai**:  
•	Seller (pardavėjas)  
Sukuria kontraktą ir nustato:  
o	prekės kainą price,  
o	kurjerio mokestį courierFee.  
Pardavėjas nori gauti price tik tada, kai prekė tikrai pristatyta.  
•	Buyer (pirkėjas)  
Per kontraktą sumoka iškart:  
o	price – už prekę,  
o	courierFee – kurjeriui.  
Kol prekė nepristatyta ir pirkėjas to nepatvirtina, pinigai laikomi kontrakte.  
•	Courier (kurjeris)  
Pristato prekę ir tikisi gauti courierFee, kai pirkėjas patvirtins gavimą.  
•	EscrowSale smart contract  
Veikia kaip patikimas tarpininkas (escrow):  
o	laiko lėšas,  
o	saugo dalyvių adresus,  
o	tikrina būsenas ir leidžiamas operacijas,  
o	galutiniame žingsnyje automatiškai paskirsto lėšas pardavėjui ir kurjeriui.  
**Tipinis scenarijus**:   
1.	Pardavėjas deploy’ina kontraktą su price ir courierFee (būsena Created).  
2.	Pirkėjas prisiregistruoja kaip buyer.  
3.	Kurjeris prisiregistruoja kaip courier.  
4.	Pirkėjas perveda price + courierFee į kontraktą (būsena Funded).  
5.	Kurjeris pažymi, kad siunta išsiųsta (Shipped).  
6.	Pirkėjas patvirtina, kad prekę gavo (Delivered).  
7.	Paspaudus complete():  
o	kontraktas išmoka price pardavėjui;  
o	išmoka courierFee kurjeriui;  
o	būsena tampa Completed.  
**Alternatyvūs scenarijai**:  
•	Pardavėjas gali atšaukti sandorį prieš apmokėjimą (cancelBySeller), būsena Cancelled.  
•	Jei pirkėjas jau apmokėjo, pardavėjas gali grąžinti visą balansą pirkėjui (refundBuyer), būsena Cancelled.  
________________________________________
3. Kontrakto architektūra (Solidity)
3.1. Būsenų mašina
Naudojamas enum State, kuris apibrėžia visą kontrakto gyvenimo ciklą:
enum State { Created, Funded, Shipped, Delivered, Completed, Cancelled }
State public state;
Būsenų reikšmės:
•	0 – Created – sukurtas, pirkėjas dar nemokėjo.
•	1 – Funded – pirkėjas pervedė price + courierFee.
•	2 – Shipped – kurjeris pažymėjo išsiuntimą.
•	3 – Delivered – pirkėjas patvirtino gavimą.
•	4 – Completed – atsiskaitymas įvykdytas.
•	5 – Cancelled – sandoris atšauktas.
Visos „kritinės“ funkcijos turi inState(State.XX) modifier, kuris neleidžia jų kviesti neteisingu metu.
3.2. Dalyvių adresai ir sumos
Kontrakte saugoma:
address public seller;
address public buyer;
address public courier;

uint256 public price;
uint256 public courierFee;
Konstruktorius:
constructor(uint256 _price, uint256 _courierFee) {
    seller = msg.sender;
    price = _price;
    courierFee = _courierFee;
    state = State.Created;
}
•	seller – tas, kas deploy’ina kontraktą (MetaMask account, su kuriuo buvo darytas deploy).
•	Sumos _price ir _courierFee yra iškart nustatomos deploy metu (WEI vienetais).
3.3. Modifier’iai ir saugumas
Pagrindiniai modifier’iai:
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
Faktinė prasmė:
•	Access control:
o	tik buyer gali kviesti fundPurchase ir confirmDelivered;
o	tik courier – markShipped;
o	tik seller – cancelBySeller ir refundBuyer;
o	complete gali kviesti pirkėjas arba pardavėjas (kaip aprašyta kontrakte).
•	State validation:
o	neleidžia, pvz., markShipped prieš apmokėjimą, nes reikalinga būsena Funded;
o	neleidžia pakartotinai keisti pirkėjo (buyer already set).
3.4. Pagrindinės funkcijos
Santrauka:
•	registerBuyer()
Leidžia vieną kartą nustatyti pirkėjo adresą:
o	require(buyer == address(0), "Buyer already set");
o	buyer = payable(msg.sender);
•	registerCourier()
Nustato kurjerio adresą:
o	require(courier == address(0), "Courier already set");
o	courier = payable(msg.sender);
•	fundPurchase()
Kvietėjas – tik buyer.
Reikalauja: msg.value == price + courierFee ir būsena Created.
Sėkmės atveju:
o	lėšos (price + courierFee) patenka į kontraktą,
o	būsena → Funded.
•	markShipped()
Tik courier, būsena turi būti Funded.
Sėkmės atveju: būsena → Shipped.
•	confirmDelivered()
Tik buyer, būsena turi būti Shipped.
Sėkmės atveju: būsena → Delivered.
•	complete()
Leidžiama kvietėjui (seller arba buyer) esant Delivered.
Viduje:
o	būsena → Completed,
o	apskaičiuojamos sumos sellerAmount = price, courierAmount = courierFee,
o	atliekami du pervedimai:
o	(bool okSeller, ) = seller.call{value: sellerAmount}("");
o	...
o	(bool okCourier, ) = courier.call{value: courierAmount}("");
•	cancelBySeller()
Tik seller, būsena turi būti Created.
Nustato state = Cancelled. Lėšų dar nėra, todėl papildomų veiksmų nereikia.
•	refundBuyer()
Tik seller, būsena Funded.
Nustato state = Cancelled ir grąžina visą kontrakto balansą pirkėjui:
•	(bool ok, ) = buyer.call{value: address(this).balance}("");
3.5. Event’ai
Kontraktas emituoja event’us (pvz. Funded, Shipped, Completed), kurie:
•	matomi Etherscan → Logs skiltyje;
•	gali būti naudojami DApp’e realaus laiko atnaujinimams (šioje versijoje tik stebimi per Etherscan).
________________________________________
4. Truffle: lokali blockchain aplinka ir testai
4.1. Projekto inicializavimas
Sukurtas atskiras Truffle projektas (escrow-truffle):
•	truffle init
•	contracts/:
o	EscrowSale.sol
o	Migrations.sol
•	migrations/:
o	1_initial_migration.js
o	2_deploy_escrow.js
•	test/:
o	escrow.test.js
•	truffle-config.js su:
•	networks: {
•	  development: {
•	    host: "127.0.0.1",
•	    port: 9545,
•	    network_id: "*",
•	  },
•	},
•	compilers: {
•	  solc: { version: "0.8.20" },
•	}
2_deploy_escrow.js deploy’ina kontraktą su paprastomis WEI reikšmėmis:
const price = 1000;
const courierFee = 100;
4.2. Lokalus tinklas
Paleista:
truffle develop
> compile
> migrate --reset
Truffle develop sukuria 10 lokalių paskyrų ir privates raktus, kontraktas įdiegtas į lokalią grandinę.
4.3. Interaktyvus testavimas
Truffle konsolėje:
const instance = await EscrowSale.deployed()
const accounts = await web3.eth.getAccounts()

// 0 - Created
await instance.registerBuyer({ from: accounts[1] })
await instance.registerCourier({ from: accounts[2] })
await instance.fundPurchase({ from: accounts[1], value: 1100 })
await instance.markShipped({ from: accounts[2] })
await instance.confirmDelivered({ from: accounts[1] })
await instance.complete({ from: accounts[0] })

// turi grąžinti 4 (Completed)
(await instance.state()).toString()
Gauta galutinė būsena 4, kas patvirtina, kad visas ciklas veikia ir lokaliai.
4.4. Automatizuotas testas
Sukurtas testas test/escrow.test.js:
•	Deploy’ina naują EscrowSale instanciją.
•	Kartoją pilną seka (registerBuyer → registerCourier → fundPurchase → markShipped → confirmDelivered → complete).
•	Tikrina, kad state == Completed.
truffle test rezultatas:
•	„1 passing“, t. y. automatinis testas praeina.
________________________________________
5. Deploy į Sepolia ir Etherscan analizė
5.1. Deploy per Remix + MetaMask
Žingsniai:
1.	Remix: Deploy & Run Transactions → Environment: Injected Provider - MetaMask.
2.	MetaMask pasirinktas tinklas: Sepolia test network.
3.	Kontraktas: EscrowSale.
4.	Konstruktoriaus parametrai (WEI):
o	_price = 1000000000000000 (0.001 ETH)
o	_courierFee = 500000000000000 (0.0005 ETH)
5.	Deploy → MetaMask transakcijos patvirtinimas.
Po deploy:
•	kontrakto adresas (naudotas galutinei DApp versijai):
0x627FED1407E15faF1D237e466d7603eB8bDC771.
5.2. Etherscan tranzakcijos
Etherscan’e galima matyti:
•	Sandorio istoriją kontrakto adresu:
o	Register Buyer
o	Register Courier
o	Fund Purchase
o	Mark Shipped
o	Confirm Delivered
o	Complete
Pavyzdžiai:
•	Fund Purchase transakcija:
o	From: pirkėjo adresas (0x3D8BDf18C40f2B2d8e1057B9f38Bf6a4B2219555).
o	To: kontraktas EscrowSale (0x627F...).
o	Value: 0.0015 ETH.
o	Logs: event Funded su pirkėjo adresu ir suma.
•	Complete transakcija:
o	From: tas pats naudotojas (seller/buyer).
o	Internal Transactions:
	0.001 ETH → seller adresas;
	0.0005 ETH → courier adresas.
o	Logs: event Completed, kuriame nurodytas seller ir courier.
Tai patvirtina, kad kontraktas realiai perveda lėšas testiniame tinkle pagal aprašytą logiką.
________________________________________
6. DApp (front-end) su ethers.js
6.1. Struktūra
DApp sudaryta iš dviejų failų:
•	index.html – vartotojo sąsaja (mygtukai, įvesties laukai, „Current state“ tekstas).
•	app.js – logika, kuri:
o	jungiasi prie MetaMask (window.ethereum);
o	kuria ethers.BrowserProvider;
o	inicijuoja new ethers.Contract(CONTRACT_ADDRESS, ABI, signer).
Pradiniame puslapio įkėlime:
•	kontrakto adresas iš JS parodomas tekste;
•	būsena užklausiama per contract.state() ir paverčiama į žmogiškus pavadinimus (Created, Funded, …).
6.2. Sąveika su MetaMask ir kontraktu
Naudotojo veiksmai:
1.	Connect MetaMask
o	kviečiamas ethereum.request({ method: 'eth_requestAccounts' })
o	MetaMask atidaro „Connect to this site“, po patvirtinimo DApp žino prisijungusį adresą.
2.	Register Buyer / Register Courier
o	contract.registerBuyer() / contract.registerCourier()
o	MetaMask atsidaro su transakcijos patvirtinimu.
3.	Fund Purchase
o	vartotojas įveda sumą WEI (tipiškai price + courierFee);
o	DApp kviečia contract.fundPurchase({ value: amount }).
4.	Mark Shipped / Confirm Delivered / Complete
o	atitinkami mygtukai kviečia kontrakto funkcijas;
o	po kiekvienos transakcijos DApp vėl perskaito state() ir atnaujina tekstą „Current state: X – “.
Kiekvieną kartą, kai kvietimas pažeidžia kontrakto logiką (pvz. iš naujo bandoma kviesti registerBuyer jau turint buyer), MetaMask/ethers grąžina klaidą execution reverted: "Buyer already set" ir DApp parodo ją alert() langu – tai padeda vartotojui suprasti, kokia verslo taisyklė buvo pažeista.
________________________________________
7. Sekų diagrama
7.1. Verslo seka (roles → contract)
Dalyviai:
•	Seller
•	Buyer
•	Courier
•	EscrowSale (kontraktas)
Loginė seka:
1.	Seller → EscrowSale: deploy(_price, _courierFee)
Kontraktas sukuriamas, būsena Created.
2.	Buyer → EscrowSale: registerBuyer()
Išsaugomas pirkėjo adresas, patvirtinama, kad vėliau tik jis galės mokėti ir patvirtinti pristatymą.
3.	Courier → EscrowSale: registerCourier()
Išsaugomas kurjerio adresas.
4.	Buyer → EscrowSale: fundPurchase(value = price + courierFee)
Pinigai patenka į kontraktą, būsena → Funded.
5.	Courier → EscrowSale: markShipped()
Pažymima, kad siunta išsiųsta, būsena → Shipped.
6.	Buyer → EscrowSale: confirmDelivered()
Pirkėjas patvirtina, kad prekę gavo, būsena → Delivered.
7.	Seller (arba Buyer) → EscrowSale: complete()
Kontraktas:
o	perveda price pardavėjui,
o	perveda courierFee kurjeriui,
o	nustato state = Completed.
<img width="714" height="578" alt="image" src="https://github.com/user-attachments/assets/0c68ff44-4432-4575-92a7-67564660ee68" />


7.2. Techninė seka (User–DApp–MetaMask–Blockchain)
Jei reikia antro, techninio vaizdo:
•	Vartotojas spaudžia mygtuką Fund Purchase DApp’e.
•	app.js per ethers.Contract suformuoja transakciją.
•	Transakcija nusiunčiama MetaMask (provideris).
•	MetaMask rodo confirm, pasirašo transakciją ir išsiunčia į Sepolia RPC node.
•	Node vykdo kontrakto kodą, atnaujina būseną, emituoja event’us.
•	DApp po tx.wait() vėl kviečia contract.state() ir atnaujina UI.
________________________________________
8. Išvados ir galimi patobulinimai
Padaryta:
•	Sukurtas išmanusis kontraktas, modeliuojantis realų escrow scenarijų su trimis rolėmis ir aiškia būsenų mašina.
•	Lokaliai ištestuota su Truffle (interaktyviai ir per truffle test).
•	Deploy’intas į viešą testnet (Sepolia), naudotas realus MetaMask wallet adresas.
•	Per Etherscan patvirtinta, kad:
o	Fund Purchase teisingai įkelia price + courierFee į kontraktą;
o	Complete transakcija sukuria dvi vidines transakcijas (pinigų pervedimus seller ir courier);
o	event’ai (Funded, Completed ir pan.) atsispindi loguose.
•	Sukurtas veikiančios DApp prototipas su ethers.js, kuris:
o	prisijungia prie MetaMask,
o	kviečia pagrindines kontrakto funkcijas,
o	realiu laiku rodo kontrakto būseną.
Galimi patobulinimai:
•	Pridėti timeout mechanizmą (pvz. jei pirkėjas per X dienų nepatvirtina pristatymo, atsiranda ginčo režimas).
•	Įdiegti papildomą rolę arbitrator/admin, kuris galėtų išspręsti ginčus.
•	Pridėti istorijos saugojimą / event stream’o prenumeravimą DApp’e, kad visos būsenų perėjimų datos būtų matomos UI.
•	Išplėsti kontraktą, kad palaikytų kelis užsakymus viename kontrakte (mapping nuo orderId → struktūros vietoj vieno „globalaus“ sandorio).
