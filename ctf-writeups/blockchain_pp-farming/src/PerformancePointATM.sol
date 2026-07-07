// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract PerformancePointATM {
    mapping(address => uint256) public scores;

    constructor() payable {
    }

    function donatePP(address _to) public payable {
        scores[_to] = scores[_to] + msg.value;
    }

    function checkPP(address _who) public view returns (uint256 score) {
        return scores[_who];
    }

    function withdrawPP() public {
        uint256 score = scores[msg.sender];
        require(score > 0, "Nothing to withdraw");
        (bool result, ) = msg.sender.call{value: score}("");
        require(result, "Transfer failed");
        scores[msg.sender] = 0;
    }

    function isSolved() view public returns (bool) {
        return address(this).balance == 0;
    }

    receive() external payable {}
}
