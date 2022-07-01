//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.13;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./Whitelist.sol";
import "./Configurable.sol";

contract StakingPlatform is Configurable, Whitelist {
    struct Stake {
        uint128 amount;
        uint128 reward;
        uint128 lastStakeDate;
        uint128 lastRewardDate;
    }

    /// @notice Informs that reward rate is changed
    event RewardRateChanged(
        uint8 indexed rewardPercentage,
        address indexed changedBy
    );
    /// @notice Informs that reward delay is changed
    event RewardDelayChanged(
        uint32 indexed rewardDelay,
        address indexed changedBy
    );
    /// @notice Informs that unstake delay is changed
    event UnstakeDelayChanged(
        uint32 indexed unstakeDelay,
        address indexed changedBy
    );

    //uint32 covers 136 years, it's more than enough for delays
    uint32 private _rewardDelay = 7 days;
    uint32 private _unstakeDelay = 20 minutes;
    uint8 private _rewardPercentage = 3;
    address private _stakingToken;
    address private _rewardToken;

    mapping(address => Stake) internal _stakes;

    constructor(address stakingToken, address rewardToken) {
        _stakingToken = stakingToken;
        _rewardToken = rewardToken;
    }

    /// @notice Returns current Reward Percentage
    function getRewardPercentage() external view returns (uint256) {
        return _rewardPercentage;
    }

    /// @notice Returns current Reward Delay.
    /// @notice Shows how long Claim cannot be called since last Stake.
    /// @notice Shows how long a period which will be rewarded afterthat
    function getRewardDelay() external view returns (uint256) {
        return _rewardDelay;
    }

    /// @notice Returns current Unstake Delay.
    /// @notice Shows how long Unstake cannot be called since last Stake
    function getUnstakeDelay() external view returns (uint256) {
        return _unstakeDelay;
    }

    function getDetails() external view returns (Stake memory) {
        return _stakes[msg.sender];
    }

    /// @notice Returns address of the current staking token
    function getStakingToken() external view returns (address) {
        return address(_stakingToken);
    }

    /// @notice Returns address of the current reward token
    function getRewardToken() external view returns (address) {
        return address(_rewardToken);
    }

    /// @notice Allows to change Reward Percentage.
    /// @notice Emits `RewardRateChanged` event
    function setRewardPercentage(uint8 newRewardPercentage)
        public
        onlyRole(CONFIGURATOR_ROLE)
    {
        _rewardPercentage = newRewardPercentage;
        emit RewardRateChanged(newRewardPercentage, msg.sender);
    }

    /// @notice Allows to change Reward Delay.
    /// @notice Emits `RewardDelayChanged` event
    function setRewardDelay(uint32 newRewardDelay)
        public
        onlyRole(CONFIGURATOR_ROLE)
    {
        _rewardDelay = newRewardDelay;
        emit RewardDelayChanged(newRewardDelay, msg.sender);
    }

    /// @notice Allows to change Unstake Delay.
    /// @notice Emits UnstakeDelayChanged` event
    function setUnstakeDelay(uint32 newUnstakeDelay)
        public
        onlyRole(CONFIGURATOR_ROLE)
    {
        _unstakeDelay = newUnstakeDelay;
        emit UnstakeDelayChanged(newUnstakeDelay, msg.sender);
    }

    /// @notice Allows to change the reward token
    function setRewardToken(address newRewardToken)
        public
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        _rewardToken = newRewardToken;
    }

    /// @notice Allows to change the staking token
    function setStakingToken(address newStakingToken)
        public
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        _stakingToken = newStakingToken;
    }

    /// @notice Calculates reward based on currently staked amount, if possible
    /// @notice Updates the state: dates & amounts
    /// @notice Transfers from the sender the specified amount of tokens,
    /// which should be already approved by the sender
    function stake(uint128 amount, bytes32[] memory proof)
        public
        virtual
        senderFromWhitelist(proof)
    {
        Stake storage staking = _stakes[msg.sender];
        uint128 calculatedReward = _calculateCurrentReward(
            staking.amount,
            _getRewardPeriodsNumber(staking.lastRewardDate)
        );

        staking.lastRewardDate = uint64(block.timestamp);
        staking.lastStakeDate = uint64(block.timestamp);
        staking.reward += calculatedReward;
        staking.amount += amount;

        IERC20(_stakingToken).transferFrom(msg.sender, address(this), amount);
    }

    function unstake() public virtual {
        Stake storage staking = _stakes[msg.sender];
        require(
            staking.amount > 0 &&
                block.timestamp > staking.lastStakeDate + _unstakeDelay,
            "Cannot unstake yet"
        );
        uint128 stakedAmount = staking.amount;
        staking.amount = 0;

        uint64 periods = _getRewardPeriodsNumber(staking.lastRewardDate);
        uint128 calculatedReward = _calculateCurrentReward(
            stakedAmount,
            periods
        );

        staking.reward += calculatedReward;
        staking.lastRewardDate =
            staking.lastRewardDate +
            periods *
            _rewardDelay;

        IERC20(_stakingToken).transfer(msg.sender, stakedAmount);
    }

    /// @notice Checks if it is possible to calculate a reward.
    /// @notice Calculates and transfer calculated amount of reward tokens
    function claim() public {
        Stake storage staking = _stakes[msg.sender];
        bool canBeClaimed = staking.lastRewardDate > 0 &&
            block.timestamp > staking.lastRewardDate + _rewardDelay;
        require(canBeClaimed || staking.reward > 0, "Nothing to claim yet");

        uint128 totalReward = staking.reward;
        uint64 periods = _getRewardPeriodsNumber(staking.lastRewardDate);

        staking.reward = 0;
        staking.lastRewardDate =
            staking.lastRewardDate +
            periods *
            _rewardDelay;

        totalReward += _calculateCurrentReward(staking.amount, periods);
        IERC20(_rewardToken).transfer(msg.sender, totalReward);
    }

    /// @dev Gives number of period which should be rewarded since given date
    function _getRewardPeriodsNumber(uint128 lastRewardDate)
        private
        view
        returns (uint64)
    {
        return uint64((block.timestamp - lastRewardDate) / _rewardDelay);
    }

    /// @dev Gives reward for current reward rate and given amount and periods
    function _calculateCurrentReward(
        uint128 stakedAmount,
        uint64 numberOfPeriods
    ) private view returns (uint128) {
        uint128 periodPrice = (stakedAmount * _rewardPercentage) / 100;
        return numberOfPeriods * periodPrice;
    }
}
