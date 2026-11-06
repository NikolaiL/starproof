// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import {Strings} from "@openzeppelin/contracts/utils/Strings.sol";

/// @notice The issuer verifies existing game receipts offchain, not inside this contract.
contract StarproofMonsters is ERC721, EIP712 {
    address public immutable issuer;
    string public metadataBase;
    mapping(uint256 => uint8) public worldOf;
    bytes32 public constant MINT_TYPEHASH = keccak256(
        "Encounter(bytes32 deviceId,uint8 worldId,address recipient,uint256 deadline)"
    );
    error InvalidEncounter();
    error InvalidAuthorization();
    error ExpiredEncounter();
    error AlreadyCollected();

    constructor(address proofIssuer, string memory baseURI)
        ERC721("Starproof Monsters", "MONSTER") EIP712("StarproofMonsters", "1")
    {
        if (proofIssuer == address(0) || bytes(baseURI).length == 0) revert InvalidEncounter();
        issuer = proofIssuer;
        metadataBase = baseURI;
    }

    function encounterDigest(bytes32 deviceId, uint8 worldId, address recipient, uint256 deadline)
        public view returns (bytes32)
    {
        return _hashTypedDataV4(keccak256(abi.encode(MINT_TYPEHASH, deviceId, worldId, recipient, deadline)));
    }

    function mint(bytes32 deviceId, uint8 worldId, address recipient, uint256 deadline, bytes calldata proof)
        external returns (uint256 tokenId)
    {
        if (deviceId == bytes32(0) || recipient == address(0) || worldId < 2 || worldId > 20 || worldId == 4)
            revert InvalidEncounter();
        if (block.timestamp > deadline) revert ExpiredEncounter();
        if (ECDSA.recover(encounterDigest(deviceId, worldId, recipient, deadline), proof) != issuer)
            revert InvalidAuthorization();
        tokenId = uint256(keccak256(abi.encode(deviceId, worldId)));
        if (_ownerOf(tokenId) != address(0)) revert AlreadyCollected();
        worldOf[tokenId] = worldId;
        _safeMint(recipient, tokenId);
    }

    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        _requireOwned(tokenId);
        return string.concat(metadataBase, Strings.toString(worldOf[tokenId]), ".json");
    }
}
