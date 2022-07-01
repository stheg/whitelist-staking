//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.13;

import "./Configurable.sol";

contract ReferralProgram is Configurable {
    struct User {
        uint64 regDate;
        address referral;
    }

    error RegisteredAlready();
    error ReferralIsNotRegistered();

    uint256 private constant _100_PERCENT = 10000; // 100%

    uint16 private _ref1PercentOnSale = 500; // 5%
    uint16 private _ref2PercentOnSale = 300; // 3%
    uint16 private _ref1PercentOnTrade = 250; // 2.5%
    uint16 private _ref2PercentOnTrade = 250; // 2.5%
    uint192 internal _platformBonusAccumulated;
    mapping(address => User) private _accounts;

    function getAccountInfo() external view returns (User memory) {
        return _accounts[msg.sender];
    }

    function getAccumulatedPlatformBonus() external view returns (uint256) {
        return _platformBonusAccumulated;
    }

    function getReferralPercent(bool trading, bool ref1)
        external
        view
        returns (uint256 percent)
    {
        if (trading) {
            if (ref1) percent = _ref1PercentOnTrade;
            else percent = _ref2PercentOnTrade;
        } else {
            if (ref1) percent = _ref1PercentOnSale;
            else percent = _ref2PercentOnSale;
        }
        return percent;
    }

    function setReferralPercent(
        bool trading,
        bool ref1,
        uint16 percent
    ) external onlyRole(CONFIGURATOR_ROLE) {
        if (trading) {
            if (ref1) _ref1PercentOnTrade = percent;
            else _ref2PercentOnTrade = percent;
        } else {
            if (ref1) _ref1PercentOnSale = percent;
            else _ref2PercentOnSale = percent;
        }
    }

    function register(address referral) external {
        if (_accounts[msg.sender].regDate > 0) revert RegisteredAlready();
        if (referral != address(0) && _accounts[referral].regDate == 0)
            revert ReferralIsNotRegistered();

        _accounts[msg.sender] = User(uint64(block.timestamp), referral);
    }

    function _applyReferralProgram(
        address buyer,
        uint256 totalSpentEther,
        bool tradeRound
    ) internal returns (uint256 totalReward) {
        uint256 percent1 = tradeRound
            ? _ref1PercentOnTrade
            : _ref1PercentOnSale;
        uint256 percent2 = tradeRound
            ? _ref2PercentOnTrade
            : _ref2PercentOnSale;

        uint256 reward1 = (totalSpentEther * percent1) / _100_PERCENT;
        uint256 reward2 = (totalSpentEther * percent2) / _100_PERCENT;

        totalReward = reward1 + reward2;

        address ref1 = _accounts[buyer].referral;
        if (ref1 == address(0)) {
            _platformBonusAccumulated += uint128(reward1 + reward2);
            return totalReward;
        }

        payable(ref1).transfer(reward1);

        address ref2 = _accounts[ref1].referral;
        if (ref2 == address(0)) {
            _platformBonusAccumulated += uint128(reward2);
            return totalReward;
        }

        payable(ref2).transfer(reward2);

        return totalReward;
    }
}
