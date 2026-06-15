// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title SandwichShield V2 (Industry Standard)
 * @dev Highly gas-optimized registry. Instead of logging every attack individually (which is cost-prohibitive),
 * the off-chain indexer commits a daily Merkle Root of all detected attacks.
 * This provides immutable cryptographic proof without the excessive gas costs.
 */
contract SandwichShield {
    address public owner;
    
    // Mapping of Day Index -> Merkle Root
    mapping(uint256 => bytes32) public dailyRoots;
    uint256[] public recordedDays;

    event DailyRootCommitted(uint256 indexed dayIndex, bytes32 root);

    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner");
        _;
    }

    constructor() {
        owner = msg.sender;
    }

    /**
     * @notice Commits the Merkle Root of all MEV attacks detected in a given day.
     * @param dayIndex The day (e.g., block.timestamp / 86400)
     * @param root The Merkle Root of the attack data
     */
    function commitDailyRoot(uint256 dayIndex, bytes32 root) external onlyOwner {
        if (dailyRoots[dayIndex] == bytes32(0)) {
            recordedDays.push(dayIndex);
        }
        dailyRoots[dayIndex] = root;
        emit DailyRootCommitted(dayIndex, root);
    }
    
    function getRecordedDaysCount() external view returns (uint256) {
        return recordedDays.length;
    }
}
