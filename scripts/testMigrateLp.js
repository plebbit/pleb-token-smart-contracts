const { ethers, upgrades } = require("hardhat");

async function main() {
    // ======== CONFIG ========

    // Your proxy address
    const PROXY = "0xea81dab2e0ecbc6b5c4172de4c22b6ef6e55bd8f";

    // Uniswap V2 Router
    const ROUTER = "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D";

    // Your Uniswap pair
    const PAIR = "0xbc628f41b8f791f8527fbc6563fbb0d786b33c84";

    // token0/token1 from the pair
    const TOKEN0 = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2";
    const TOKEN1 = "0xEA81DaB2e0EcBc6B5c4172DE4c22B6Ef6E55Bd8f";

    // Address that currently has DEFAULT_ADMIN_ROLE (or can grant roles)
    const ADMIN = "0x4a09b1efef421055fee00cd79894df71f175853d";

    // Address that will execute migrateLp()
    const MIGRATOR = "0x5Bc4FF33f86E0272be53Fa25861294489AB2FE2a";

    // ========================

    // Impersonate the admin
    await hre.network.provider.request({
        method: "hardhat_impersonateAccount",
        params: [ADMIN],
    });

    const admin = await ethers.getSigner(ADMIN);

    // Give the impersonated account ETH
    // await hre.network.provider.send("hardhat_setBalance", [
    //     ADMIN,
    //     "0x1000000000000000000", // 1 ETH
    // ]);

    const token = await ethers.getContractAt("TokenV5", PROXY);

    // const MIGRATOR_ROLE = await token.MIGRATOR_ROLE();

    // console.log("Granting migrator role...");
    // await (await token.connect(admin).grantRole(MIGRATOR_ROLE, MIGRATOR)).wait();

    // Stop impersonating admin
    await hre.network.provider.request({
        method: "hardhat_stopImpersonatingAccount",
        params: [ADMIN],
    });

    // Impersonate migrator
    await hre.network.provider.request({
        method: "hardhat_impersonateAccount",
        params: [MIGRATOR],
    });

    // await hre.network.provider.send("hardhat_setBalance", [
    //     MIGRATOR,
    //     "0x1000000000000000000",
    // ]);

    const migrator = await ethers.getSigner(MIGRATOR);

    console.log("Pair balance before:",
        (await token.balanceOf(PAIR)).toString());

    console.log("Contract balance before:",
        (await token.balanceOf(PROXY)).toString());

    console.log("Calling migrateLp()...");

    const tx = await token.connect(migrator).migrateLp(
        ROUTER,
        PAIR,
        TOKEN0,
        TOKEN1
    );

    const receipt = await tx.wait();

    console.log("Gas used:", receipt.gasUsed.toString());

    console.log("Pair balance after:",
        (await token.balanceOf(PAIR)).toString());

    console.log("Contract balance after:",
        (await token.balanceOf(PROXY)).toString());

    console.log("Migration complete.");
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});

/*
Run it against a mainnet fork:

```bash
npx hardhat node --fork https://eth-mainnet.g.alchemy.com/v2/YOUR_API_KEY
```

In another terminal:

```bash
npx hardhat run scripts/test-migrate-lp.js --network localhost
```

If you already have a `hardhat.config.js` fork configuration, you can instead run:

```bash
npx hardhat run scripts/test-migrate-lp.js --network hardhat
```
*/