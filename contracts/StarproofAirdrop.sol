// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Ownable2Step} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @notice The issuer verifies chip proofs offchain; this contract enforces one fixed payout per chip ID.
contract StarproofAirdrop is EIP712, Ownable2Step, Pausable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    IERC20 public constant TOKEN = IERC20(0x469F27BC9CA19d78455867aAFc7aA4186d3cCccC);
    uint256 public constant CLAIM_AMOUNT = 1000 ether; // The verified STARPROOF token has 18 decimals.
    bytes32 public constant CAMPAIGN_ID = keccak256("starproof-airdrop-v1");
    bytes32 public constant CLAIM_TYPEHASH = keccak256(
        "Claim(bytes32 campaignId,bytes32 deviceId,address recipient,address token,uint256 amount,uint256 deadline)"
    );

    address public issuer;
    mapping(bytes32 deviceId => bool) public claimed;

    error InvalidConfiguration();
    error InvalidClaim();
    error AlreadyClaimed();
    error ExpiredClaim();
    error InvalidAuthorization();
    error IncorrectPayout();

    event Claimed(bytes32 indexed deviceId, address indexed recipient, uint256 amount);
    event IssuerChanged(address indexed previousIssuer, address indexed newIssuer);

    constructor(address admin, address proofIssuer) EIP712("StarproofAirdrop", "1") Ownable(admin) {
        if (proofIssuer == address(0) || address(TOKEN).code.length == 0
            || IERC20Metadata(address(TOKEN)).decimals() != 18) revert InvalidConfiguration();
        issuer = proofIssuer;
    }

    function claimDigest(bytes32 deviceId, address recipient, uint256 deadline) public view returns (bytes32) {
        return _hashTypedDataV4(keccak256(abi.encode(
            CLAIM_TYPEHASH, CAMPAIGN_ID, deviceId, recipient, address(TOKEN), CLAIM_AMOUNT, deadline
        )));
    }

    function claim(bytes32 deviceId, address recipient, uint256 deadline, bytes calldata authorization)
        external nonReentrant whenNotPaused
    {
        if (deviceId == bytes32(0) || recipient.code.length == 0) revert InvalidClaim();
        if (claimed[deviceId]) revert AlreadyClaimed();
        if (block.timestamp > deadline) revert ExpiredClaim();
        if (ECDSA.recover(claimDigest(deviceId, recipient, deadline), authorization) != issuer) {
            revert InvalidAuthorization();
        }
        uint256 beforeBalance = TOKEN.balanceOf(recipient);
        claimed[deviceId] = true;
        TOKEN.safeTransfer(recipient, CLAIM_AMOUNT);
        if (TOKEN.balanceOf(recipient) - beforeBalance != CLAIM_AMOUNT) revert IncorrectPayout();
        emit Claimed(deviceId, recipient, CLAIM_AMOUNT);
    }

    function pause() external onlyOwner { _pause(); }
    function unpause() external onlyOwner { _unpause(); }

    function setIssuer(address proofIssuer) external onlyOwner whenPaused {
        if (proofIssuer == address(0)) revert InvalidConfiguration();
        emit IssuerChanged(issuer, proofIssuer);
        issuer = proofIssuer;
    }
}
