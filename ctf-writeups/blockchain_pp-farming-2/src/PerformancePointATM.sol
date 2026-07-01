// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract PerformancePointHelper{
    uint256 id_number;
    address public atm;
    bool public helping;
    constructor() {
        id_number = 0;
        helping = true;
    }
    function processWithdrawal(address payable recipient, uint256 amount) external returns (bool) {
        (bool success, ) = recipient.call{value: amount}("");
        return success;
    }
    function setATM(address _atm) public {
        atm = _atm;
    }
    function stopHelping() public {
        helping = false;
    }
    function startHelping() public {
        helping = true;
    }
}

contract PerformancePointATM {
    mapping(address => uint256) public scores;
    address public performancePointHelper;
    bool public locked;
    constructor(address _performancePointHelper) payable {
        performancePointHelper = _performancePointHelper;
    }

    modifier noReentrancy() {
        require(!locked, "Reentrancy detected");
        locked = true;
        _;
        locked = false;
    }

    function donatePP(address _to) public payable {
        scores[_to] = scores[_to] + msg.value;
    }

    function checkPP(address _who) public view returns (uint256 score) {
        return scores[_who];
    }

    function withdrawPP() public noReentrancy {
        uint256 score = scores[msg.sender];
        require(score > 0, "Nothing to withdraw");
        
        // Uses delegatecall to helper for withdrawal
        (bool success, ) = performancePointHelper.delegatecall(
            abi.encodeWithSignature("processWithdrawal(address,uint256)", msg.sender, score)
        );
        
        require(success, "Transfer failed");
        scores[msg.sender] = 0;
    }


    function isSolved() view public returns (bool) {
        return address(this).balance == 0;
    }

    receive() external payable {}

    // Calls proxy contract
    fallback() external payable {
        address _impl = performancePointHelper;

        bytes4 selector = msg.sig;
        
        // Block withdrawing without proxy
        bytes4 initSelector = bytes4(keccak256("processWithdrawal(address,uint256)"));
        require(selector != initSelector, "processWithdrawal blocked");

        assembly {
            let ptr := mload(0x40) // Get free memory pointer
            calldatacopy(ptr, 0, calldatasize()) // Copy calldata to memory

            let success := delegatecall(gas(), _impl, ptr, calldatasize(), 0, 0) // Delegatecall
            returndatacopy(ptr, 0, returndatasize()) // Copy return data

            if iszero(success) {
                revert(ptr, returndatasize()) // Revert if delegatecall failed
            }
            return(ptr, returndatasize()) // Return data if successful
        }
    }
}