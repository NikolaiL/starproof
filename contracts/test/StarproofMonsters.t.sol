// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;
import {Test} from "forge-std/Test.sol";
import {StarproofMonsters} from "../StarproofMonsters.sol";
contract StarproofMonstersTest is Test {
    StarproofMonsters monsters;
    bytes32 constant DEVICE = keccak256("test chip");
    uint256 constant KEY = 0xA11CE;
    address recipient = address(0xB0B);
    function setUp() public { monsters = new StarproofMonsters(vm.addr(KEY), "https://example.test/monsters/"); }
    function proof(uint8 world, address to, uint256 deadline) internal view returns (bytes memory) {
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(KEY, monsters.encounterDigest(DEVICE, world, to, deadline));
        return abi.encodePacked(r, s, v);
    }
    function testMintTransferAndPermanentWorldLimit() public {
        uint256 deadline = block.timestamp + 300;
        bytes memory signed = proof(2, recipient, deadline);
        uint256 id = monsters.mint(DEVICE, 2, recipient, deadline, signed);
        assertEq(monsters.ownerOf(id), recipient);
        assertEq(monsters.tokenURI(id), "https://example.test/monsters/2.json");
        vm.prank(recipient); monsters.transferFrom(recipient, address(0xCAFE), id);
        vm.expectRevert(StarproofMonsters.AlreadyCollected.selector);
        monsters.mint(DEVICE, 2, recipient, deadline, signed);
        monsters.mint(DEVICE, 3, recipient, deadline, proof(3, recipient, deadline));
    }
    function testRecipientPlanetChainContractAndExpiryAreBound() public {
        uint256 deadline = block.timestamp + 300;
        bytes memory signed = proof(2, recipient, deadline);
        vm.expectRevert(StarproofMonsters.InvalidAuthorization.selector);
        monsters.mint(DEVICE, 2, address(0xCAFE), deadline, signed);
        vm.expectRevert(StarproofMonsters.InvalidAuthorization.selector);
        monsters.mint(DEVICE, 3, recipient, deadline, signed);
        StarproofMonsters other = new StarproofMonsters(vm.addr(KEY), "https://example.test/");
        vm.expectRevert(StarproofMonsters.InvalidAuthorization.selector);
        other.mint(DEVICE, 2, recipient, deadline, signed);
        vm.chainId(block.chainid + 1);
        vm.expectRevert(StarproofMonsters.InvalidAuthorization.selector);
        monsters.mint(DEVICE, 2, recipient, deadline, signed);
        vm.warp(deadline + 1);
        vm.expectRevert(StarproofMonsters.ExpiredEncounter.selector);
        monsters.mint(DEVICE, 2, recipient, deadline, signed);
    }
    function testWorldWithoutMonsterAndBadIssuerAreRejected() public {
        uint256 deadline = block.timestamp + 300;
        bytes memory signed = proof(4, recipient, deadline);
        vm.expectRevert(StarproofMonsters.InvalidEncounter.selector);
        monsters.mint(DEVICE, 4, recipient, deadline, signed);
        vm.expectRevert(StarproofMonsters.InvalidEncounter.selector);
        new StarproofMonsters(address(0), "https://example.test/");
    }
}
