// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";

contract VaultV1 is Initializable, UUPSUpgradeable, OwnableUpgradeable {
    struct Position {
        uint256 principal;
        uint256 lastUpdated;
    }

    uint256 public rewardMultiplier;
    uint256 public totalEthLocked;
    uint256 private reentrancyLock;

    mapping(address => Position) internal positions;
    mapping(address => uint256) internal accruedRewards;

    event Deposited(address indexed user, uint256 amount);
    event Withdrawn(address indexed user, uint256 amount);
    event RewardClaimed(address indexed user, uint256 amount);
    event RewardMultiplierUpdated(uint256 oldMultiplier, uint256 newMultiplier);

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    modifier nonReentrant() {
        require(reentrancyLock == 1, "reentrant call");
        reentrancyLock = 2;
        _;
        reentrancyLock = 1;
    }

    function initialize(uint256 initialRewardMultiplier, address initialOwner) external initializer {
        __Ownable_init(initialOwner);

        require(initialRewardMultiplier > 0, "multiplier=0");
        rewardMultiplier = initialRewardMultiplier;
        reentrancyLock = 1;
    }

    function deposit() external payable nonReentrant {
        require(msg.value > 0, "amount=0");
        _accrue(msg.sender);

        positions[msg.sender].principal += msg.value;
        totalEthLocked += msg.value;

        emit Deposited(msg.sender, msg.value);
    }

    function withdraw(uint256 amount) external nonReentrant {
        require(amount > 0, "amount=0");
        _accrue(msg.sender);

        Position storage userPosition = positions[msg.sender];
        require(userPosition.principal >= amount, "insufficient principal");

        userPosition.principal -= amount;
        totalEthLocked -= amount;

        (bool ok, ) = payable(msg.sender).call{value: amount}("");
        require(ok, "transfer failed");

        emit Withdrawn(msg.sender, amount);
    }

    function claimRewards() external nonReentrant {
        _accrue(msg.sender);

        uint256 reward = accruedRewards[msg.sender];
        require(reward > 0, "reward=0");
        require(address(this).balance >= reward, "insufficient vault liquidity");

        accruedRewards[msg.sender] = 0;

        (bool ok, ) = payable(msg.sender).call{value: reward}("");
        require(ok, "transfer failed");

        emit RewardClaimed(msg.sender, reward);
    }

    function setRewardMultiplier(uint256 newRewardMultiplier) external onlyOwner {
        require(newRewardMultiplier > 0, "multiplier=0");
        uint256 old = rewardMultiplier;
        rewardMultiplier = newRewardMultiplier;
        emit RewardMultiplierUpdated(old, newRewardMultiplier);
    }

    function principalOf(address user) external view returns (uint256) {
        return positions[user].principal;
    }

    function accruedRewardOf(address user) external view returns (uint256) {
        return _pendingReward(user);
    }

    function _pendingReward(address user) internal view returns (uint256) {
        Position memory userPosition = positions[user];
        if (userPosition.principal == 0) {
            return accruedRewards[user];
        }

        uint256 elapsed = block.timestamp - userPosition.lastUpdated;
        uint256 incremental = (userPosition.principal * rewardMultiplier * elapsed) / 1e18 / 365 days;
        return accruedRewards[user] + incremental;
    }

    function _accrue(address user) internal {
        Position storage userPosition = positions[user];

        if (userPosition.principal == 0) {
            userPosition.lastUpdated = block.timestamp;
            return;
        }

        uint256 elapsed = block.timestamp - userPosition.lastUpdated;
        if (elapsed > 0) {
            uint256 incremental = (userPosition.principal * rewardMultiplier * elapsed) / 1e18 / 365 days;
            accruedRewards[user] += incremental;
            userPosition.lastUpdated = block.timestamp;
        }
    }

    function _authorizeUpgrade(address) internal override onlyOwner {}
}
