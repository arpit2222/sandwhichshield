// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title MockDEX
 * @dev A dummy DEX strictly for hackathon demonstration purposes.
 * It simulates a swap and emits a standard event so the indexer can detect it.
 */
contract MockDEX {
    string public name = "Mock DEX (Sandwich Target)";

    event Swap(
        address indexed sender,
        uint amount0In,
        uint amount1In,
        uint amount0Out,
        uint amount1Out,
        address indexed to
    );

    /**
     * @notice Simulates a token swap to generate event logs for the indexer.
     * @param amount0In Fake input token 0
     * @param amount1In Fake input token 1
     * @param amount0Out Fake output token 0
     * @param amount1Out Fake output token 1
     * @param to Recipient address
     */
    function executeSwap(
        uint amount0In,
        uint amount1In,
        uint amount0Out,
        uint amount1Out,
        address to
    ) external {
        // In a real DEX, token transfers and k-constant math happens here.
        // For the demo, we just emit the Swap event.
        emit Swap(msg.sender, amount0In, amount1In, amount0Out, amount1Out, to);
    }
}
