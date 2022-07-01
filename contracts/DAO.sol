//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.13;

import "./StakingPlatform.sol";

contract DAO is StakingPlatform {
    enum Status {
        InProcess,
        Finished,
        Rejected,
        Cancelled
    }

    struct Proposal {
        uint8 status;
        uint64 startDate; //it's ok until (Jul 21 2554)
        address recipient;
        uint128 votesFor;
        uint128 votesAgainst;
        bytes funcSignature;
        string description;
    }

    event ProposalAdded(address indexed addedBy, uint256 indexed id);
    event ProposalFinished(uint256 indexed id, uint8 indexed status);

    bytes32 public constant CHAIRPERSON_ROLE = keccak256("chairperson");

    uint64 private _minimumQuorum = 1000;
    uint24 private _votingPeriodDuration = 7 days; //~6 months max
    uint32 private _proposalCounter = 1; //0 is reserved for _latestVoting logic
    mapping(uint256 => Proposal) private _proposals;
    mapping(address => mapping(uint256 => bool)) private _voted;
    mapping(address => uint256) private _latestVoting;
    mapping(address => mapping(uint256 => uint256)) private _allowance;

    constructor(
        address chairperson,
        address voteToken,
        address rewardToken
    ) StakingPlatform(voteToken, rewardToken) {
        _setRoleAdmin(CHAIRPERSON_ROLE, DEFAULT_ADMIN_ROLE);
        _grantRole(CHAIRPERSON_ROLE, chairperson);
    }

    modifier proposalExists(uint256 pId) {
        require(pId > 0 && pId < _proposalCounter, "DAO: no such voting");
        _;
    }

    modifier voteGuard(address voter, uint256 pId) {
        require(!_voted[msg.sender][pId], "DAO: voted already");
        _voted[msg.sender][pId] = true;
        _;
    }

    function getVotingDuration() external view returns (uint24) {
        return _votingPeriodDuration;
    }

    function getProposal(uint256 id) external view returns (Proposal memory) {
        return _proposals[id];
    }

    function unstake() public virtual override {
        uint256 amount = _stakes[msg.sender].amount;
        require(amount > 0, "DAO: nothing to unstake");

        uint256 latestVotingId = _latestVoting[msg.sender];
        if (latestVotingId > 0) {
            // check if user voted
            require(
                _proposals[latestVotingId].status != uint8(Status.InProcess),
                "DAO: tokens are frozen"
            );
        }

        super.unstake();
    }

    function addProposal(
        address recipient,
        bytes memory funcSignature,
        string memory description
    ) external onlyRole(CHAIRPERSON_ROLE) {
        uint256 pId = _proposalCounter++;
        Proposal storage p = _proposals[pId];
        p.funcSignature = funcSignature;
        p.description = description;
        p.recipient = recipient;
        p.startDate = uint64(block.timestamp);

        emit ProposalAdded(msg.sender, pId);
    }

    function vote(uint32 pId, bool agree)
        external
        proposalExists(pId)
        voteGuard(msg.sender, pId)
    {
        uint128 availableAmount = uint128(_checkAmount(msg.sender, pId));

        Proposal storage p = _proposals[pId];
        require( //now < finishDate
            block.timestamp < p.startDate + _votingPeriodDuration,
            "DAO: voting period ended"
        );

        // because of the common voting period for all proposals,
        // it's enough to keep the last voting.
        // all votings before will finish before the last one.
        uint256 latestVotingId = _latestVoting[msg.sender];
        if (pId > latestVotingId) _latestVoting[msg.sender] = pId; //this is needed for unstake

        if (agree) p.votesFor += availableAmount;
        else p.votesAgainst += availableAmount;
    }

    function finish(uint256 pId) external proposalExists(pId) {
        Proposal storage p = _proposals[pId];
        require( //now > finishDate
            block.timestamp > p.startDate + _votingPeriodDuration,
            "DAO: voting is in process"
        );
        require(p.status == uint8(Status.InProcess), "DAO: handled already");
        Status resultStatus;
        if (p.votesFor + p.votesAgainst < _minimumQuorum) {
            resultStatus = Status.Cancelled;
        } else {
            resultStatus = p.votesFor > p.votesAgainst
                ? Status.Finished
                : Status.Rejected;
        }
        p.status = uint8(resultStatus);

        emit ProposalFinished(pId, p.status);
        if (resultStatus != Status.Finished) return;

        (bool success, ) = p.recipient.call(p.funcSignature);
        require(success, "DAO: recipient call error");
    }

    function delegate(address aDelegate, uint256 pId)
        external
        proposalExists(pId)
        voteGuard(msg.sender, pId)
    {
        require(!_voted[aDelegate][pId], "DAO: delegate voted already");
        _allowance[aDelegate][pId] += _checkAmount(msg.sender, pId);
    }

    function _checkAmount(address voter, uint256 pId)
        private
        view
        returns (uint256)
    {
        uint256 availableAmount = _stakes[voter].amount +
            _allowance[voter][pId];
        require(availableAmount > 0, "DAO: no deposit");
        return availableAmount;
    }
}
