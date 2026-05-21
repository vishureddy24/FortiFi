// SPDX-License-Identifier: MIT
pragma solidity >=0.4.22 <0.9.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/Pausable.sol";

interface ILendingProtocol {
    function addTokensForLending(string calldata name, address tokenAddress, uint256 LTV, uint256 borrowStableRate) external;
    function setRiskController(address _riskController) external;
    function pause() external;
    function unpause() external;
}

contract GovernanceController is Ownable {
    
    enum ProposalStatus { PENDING, ACTIVE, EXECUTED, CANCELLED }

    struct Proposal {
        uint256 id;
        address target;
        bytes data;
        string description;
        uint256 votesFor;
        uint256 votesAgainst;
        uint256 endTime;
        ProposalStatus status;
        bool executed;
    }

    mapping(uint256 => Proposal) public proposals;
    mapping(uint256 => mapping(address => bool)) public hasVoted;
    uint256 public proposalCount;
    uint256 public votingPeriod = 3 days;
    uint256 public quorum = 10; // Simple quorum for MVP

    event ProposalCreated(uint256 id, string description);
    event Voted(uint256 proposalId, address voter, bool support);
    event ProposalExecuted(uint256 id);

    function createProposal(address _target, bytes calldata _data, string calldata _description) external {
        proposalCount++;
        proposals[proposalCount] = Proposal({
            id: proposalCount,
            target: _target,
            data: _data,
            description: _description,
            votesFor: 0,
            votesAgainst: 0,
            endTime: block.timestamp + votingPeriod,
            status: ProposalStatus.ACTIVE,
            executed: false
        });

        emit ProposalCreated(proposalCount, _description);
    }

    function vote(uint256 _proposalId, bool _support) external {
        Proposal storage proposal = proposals[_proposalId];
        require(block.timestamp < proposal.endTime, "Voting ended");
        require(!hasVoted[_proposalId][msg.sender], "Already voted");

        if (_support) {
            proposal.votesFor++;
        } else {
            proposal.votesAgainst++;
        }

        hasVoted[_proposalId][msg.sender] = true;
        emit Voted(_proposalId, msg.sender, _support);
    }

    function executeProposal(uint256 _proposalId) external {
        Proposal storage proposal = proposals[_proposalId];
        require(block.timestamp >= proposal.endTime, "Voting still active");
        require(!proposal.executed, "Already executed");
        require(proposal.votesFor > proposal.votesAgainst, "Proposal failed");
        require(proposal.votesFor >= quorum, "Quorum not reached");

        (bool success, ) = proposal.target.call(proposal.data);
        require(success, "Execution failed");

        proposal.executed = true;
        proposal.status = ProposalStatus.EXECUTED;

        emit ProposalExecuted(_proposalId);
    }
}
