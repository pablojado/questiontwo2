// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import {VaultV1} from "./VaultV1.sol";

/// @custom:oz-upgrades-unsafe-allow missing-initializer
contract VaultV2 is VaultV1 {
    function version() external pure returns (string memory) {
        return "V2";
    }

    function doubleRewardMultiplier() external onlyOwner {
        uint256 old = rewardMultiplier;
        rewardMultiplier = rewardMultiplier * 2;
        emit RewardMultiplierUpdated(old, rewardMultiplier);
    }
}
