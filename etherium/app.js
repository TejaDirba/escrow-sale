//const CONTRACT_ADDRESS = "0xA8f37188F6FF0A053D34B4B1156097cb6BDCF47d";
const CONTRACT_ADDRESS = "0x627FED1407E15faF1D237e466d76038eB8bDC771";

const ABI = [
	{
		"inputs": [
			{
				"internalType": "uint256",
				"name": "_price",
				"type": "uint256"
			},
			{
				"internalType": "uint256",
				"name": "_courierFee",
				"type": "uint256"
			}
		],
		"stateMutability": "nonpayable",
		"type": "constructor"
	},
	{
		"anonymous": false,
		"inputs": [],
		"name": "Cancelled",
		"type": "event"
	},
	{
		"anonymous": false,
		"inputs": [
			{
				"indexed": true,
				"internalType": "address",
				"name": "seller",
				"type": "address"
			},
			{
				"indexed": true,
				"internalType": "address",
				"name": "courier",
				"type": "address"
			}
		],
		"name": "Completed",
		"type": "event"
	},
	{
		"anonymous": false,
		"inputs": [
			{
				"indexed": true,
				"internalType": "address",
				"name": "buyer",
				"type": "address"
			}
		],
		"name": "Delivered",
		"type": "event"
	},
	{
		"anonymous": false,
		"inputs": [
			{
				"indexed": true,
				"internalType": "address",
				"name": "buyer",
				"type": "address"
			},
			{
				"indexed": false,
				"internalType": "uint256",
				"name": "amount",
				"type": "uint256"
			}
		],
		"name": "Funded",
		"type": "event"
	},
	{
		"anonymous": false,
		"inputs": [
			{
				"indexed": true,
				"internalType": "address",
				"name": "buyer",
				"type": "address"
			},
			{
				"indexed": false,
				"internalType": "uint256",
				"name": "amount",
				"type": "uint256"
			}
		],
		"name": "Refunded",
		"type": "event"
	},
	{
		"anonymous": false,
		"inputs": [
			{
				"indexed": true,
				"internalType": "address",
				"name": "courier",
				"type": "address"
			}
		],
		"name": "Shipped",
		"type": "event"
	},
	{
		"inputs": [],
		"name": "buyer",
		"outputs": [
			{
				"internalType": "address payable",
				"name": "",
				"type": "address"
			}
		],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [],
		"name": "cancelBySeller",
		"outputs": [],
		"stateMutability": "nonpayable",
		"type": "function"
	},
	{
		"inputs": [],
		"name": "complete",
		"outputs": [],
		"stateMutability": "nonpayable",
		"type": "function"
	},
	{
		"inputs": [],
		"name": "confirmDelivered",
		"outputs": [],
		"stateMutability": "nonpayable",
		"type": "function"
	},
	{
		"inputs": [],
		"name": "courier",
		"outputs": [
			{
				"internalType": "address payable",
				"name": "",
				"type": "address"
			}
		],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [],
		"name": "courierFee",
		"outputs": [
			{
				"internalType": "uint256",
				"name": "",
				"type": "uint256"
			}
		],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [],
		"name": "fundPurchase",
		"outputs": [],
		"stateMutability": "payable",
		"type": "function"
	},
	{
		"inputs": [],
		"name": "markShipped",
		"outputs": [],
		"stateMutability": "nonpayable",
		"type": "function"
	},
	{
		"inputs": [],
		"name": "price",
		"outputs": [
			{
				"internalType": "uint256",
				"name": "",
				"type": "uint256"
			}
		],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [],
		"name": "refundBuyer",
		"outputs": [],
		"stateMutability": "nonpayable",
		"type": "function"
	},
	{
		"inputs": [],
		"name": "registerBuyer",
		"outputs": [],
		"stateMutability": "nonpayable",
		"type": "function"
	},
	{
		"inputs": [],
		"name": "registerCourier",
		"outputs": [],
		"stateMutability": "nonpayable",
		"type": "function"
	},
	{
		"inputs": [],
		"name": "seller",
		"outputs": [
			{
				"internalType": "address payable",
				"name": "",
				"type": "address"
			}
		],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [],
		"name": "state",
		"outputs": [
			{
				"internalType": "enum EscrowSale.State",
				"name": "",
				"type": "uint8"
			}
		],
		"stateMutability": "view",
		"type": "function"
	}
];

const STATE_LABELS = [
  "0 - Created",
  "1 - Funded",
  "2 - Shipped",
  "3 - Delivered",
  "4 - Completed",
  "5 - Cancelled"
];

let provider;
let signer;
let contract;

async function connect() {
  try {
    if (!window.ethereum) {
      alert("MetaMask not found");
      return;
    }

    await window.ethereum.request({ method: "eth_requestAccounts" });

    provider = new ethers.BrowserProvider(window.ethereum);
    signer = await provider.getSigner();
    const addr = await signer.getAddress();

    document.getElementById("account").innerText = "Connected: " + addr;
    document.getElementById("contractAddress").innerText = CONTRACT_ADDRESS;

    contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, signer);

    await refreshState();
  } catch (err) {
    console.error(err);
    alert("Connect error: " + (err.message || err));
  }
}

async function refreshState() {
  if (!contract) return;
  try {
    const s = await contract.state();
    const n = Number(s);
    const label = STATE_LABELS[n] ?? n.toString();
    document.getElementById("state").innerText = label;
  } catch (err) {
    console.error(err);
  }
}

async function txWrapper(fn) {
  if (!contract) {
    alert("Connect MetaMask first");
    return;
  }
  try {
    const tx = await fn();
    console.log("Tx sent:", tx.hash);
    await tx.wait();
    console.log("Tx mined");
    await refreshState();
  } catch (err) {
    console.error(err);
    alert("Transaction error: " + (err.error?.message || err.message || err));
  }
}

async function registerBuyer() {
  await txWrapper(() => contract.registerBuyer());
}

async function registerCourier() {
  await txWrapper(() => contract.registerCourier());
}

async function fundPurchase() {
  const amountStr = document.getElementById("fundAmount").value.trim();
  if (!amountStr) {
    alert("Enter amount in wei");
    return;
  }
  const value = BigInt(amountStr);
  await txWrapper(() => contract.fundPurchase({ value }));
}

async function markShipped() {
  await txWrapper(() => contract.markShipped());
}

async function confirmDelivered() {
  await txWrapper(() => contract.confirmDelivered());
}

async function completeSale() {
  await txWrapper(() => contract.complete());
}

// event handlers
document.getElementById("connect").onclick = connect;
document.getElementById("btnRegisterBuyer").onclick = registerBuyer;
document.getElementById("btnRegisterCourier").onclick = registerCourier;
document.getElementById("btnFund").onclick = fundPurchase;
document.getElementById("btnShip").onclick = markShipped;
document.getElementById("btnDelivered").onclick = confirmDelivered;
document.getElementById("btnComplete").onclick = completeSale;