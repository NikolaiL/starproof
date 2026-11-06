// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Test} from "forge-std/Test.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {StarproofAirdrop} from "../StarproofAirdrop.sol";

contract MockToken is ERC20 {
    bool public fail;
    bool public takeFee;
    constructor() ERC20("Starproof", "STARPROOF") {}
    function mint(address to, uint256 amount) external { _mint(to, amount); }
    function mode(bool shouldFail, bool fee) external { fail = shouldFail; takeFee = fee; }
    function transfer(address to, uint256 amount) public override returns (bool) {
        if (fail) return false;
        return super.transfer(to, takeFee ? amount - 1 : amount);
    }
}
contract Recipient {}

contract StarproofAirdropTest is Test {
    uint256 constant ISSUER_KEY = 0xA11CE;
    address constant TOKEN = 0x469F27BC9CA19d78455867aAFc7aA4186d3cCccC;
    address constant TOKEN_DEPLOYER = 0x8D6230427a37986D25Fe4D5B3d0aaEF1b924fEd6;
    bytes32 constant DEVICE = keccak256("a canonical factory-key claim ID");
    StarproofAirdrop drop;
    MockToken token;
    address recipient;

    function setUp() public {
        MockToken implementation = new MockToken();
        vm.etch(TOKEN, address(implementation).code);
        token = MockToken(TOKEN);
        drop = new StarproofAirdrop(address(this), vm.addr(ISSUER_KEY));
        token.mint(address(drop), 10_000 ether);
        recipient = address(new Recipient());
    }

    function authorization(bytes32 device, address to, uint256 deadline) internal view returns (bytes memory) {
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(ISSUER_KEY, drop.claimDigest(device, to, deadline));
        return abi.encodePacked(r, s, v);
    }

    function testFixedRewardAndPermanentDeviceClaim() public {
        uint256 deadline = block.timestamp + 120;
        drop.claim(DEVICE, recipient, deadline, authorization(DEVICE, recipient, deadline));
        assertEq(token.balanceOf(recipient), 1000 ether);
        assertTrue(drop.claimed(DEVICE));
        address anotherSafe = address(new Recipient());
        bytes memory proof = authorization(DEVICE, anotherSafe, deadline);
        vm.expectRevert(StarproofAirdrop.AlreadyClaimed.selector);
        drop.claim(DEVICE, anotherSafe, deadline, proof);
    }

    function testRecipientSubstitutionAndWrongIssuerFail() public {
        uint256 deadline = block.timestamp + 120;
        bytes memory proof = authorization(DEVICE, recipient, deadline);
        address substitute = address(new Recipient());
        vm.expectRevert(StarproofAirdrop.InvalidAuthorization.selector);
        drop.claim(DEVICE, substitute, deadline, proof);
        vm.expectRevert(StarproofAirdrop.InvalidAuthorization.selector);
        drop.claim(keccak256("another chip"), recipient, deadline, proof);
        vm.expectRevert(StarproofAirdrop.InvalidAuthorization.selector);
        drop.claim(DEVICE, recipient, deadline + 1, proof);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(0xB0B, drop.claimDigest(DEVICE, recipient, deadline));
        vm.expectRevert(StarproofAirdrop.InvalidAuthorization.selector);
        drop.claim(DEVICE, recipient, deadline, abi.encodePacked(r, s, v));
        assertFalse(drop.claimed(DEVICE));
    }

    function testExpiredAndInvalidRecipientsFail() public {
        uint256 deadline = block.timestamp + 120;
        bytes memory proof = authorization(DEVICE, recipient, deadline);
        vm.warp(deadline + 1);
        vm.expectRevert(StarproofAirdrop.ExpiredClaim.selector);
        drop.claim(DEVICE, recipient, deadline, proof);
        vm.expectRevert(StarproofAirdrop.InvalidClaim.selector);
        drop.claim(DEVICE, address(0xB0B), deadline, proof);
    }

    function testTransferFailuresAndTaxPreserveEligibilityAndBalances() public {
        uint256 deadline = block.timestamp + 120;
        bytes memory proof = authorization(DEVICE, recipient, deadline);
        token.mode(true, false);
        vm.expectRevert(); drop.claim(DEVICE, recipient, deadline, proof);
        assertFalse(drop.claimed(DEVICE));
        token.mode(false, true);
        vm.expectRevert(StarproofAirdrop.IncorrectPayout.selector);
        drop.claim(DEVICE, recipient, deadline, proof);
        assertFalse(drop.claimed(DEVICE));
        assertEq(token.balanceOf(recipient), 0);
        assertEq(token.balanceOf(address(drop)), 10_000 ether);
        token.mode(false, false);
        drop.claim(DEVICE, recipient, deadline, proof);
        assertEq(token.balanceOf(recipient), 1000 ether);
    }

    function testAuthorizationCannotReplayOnAnotherContractOrChain() public {
        uint256 deadline = block.timestamp + 120;
        bytes memory proof = authorization(DEVICE, recipient, deadline);
        StarproofAirdrop other = new StarproofAirdrop(address(this), vm.addr(ISSUER_KEY));
        vm.expectRevert(StarproofAirdrop.InvalidAuthorization.selector);
        other.claim(DEVICE, recipient, deadline, proof);
        vm.chainId(block.chainid + 1);
        vm.expectRevert(StarproofAirdrop.InvalidAuthorization.selector);
        drop.claim(DEVICE, recipient, deadline, proof);
    }

    function testOnlyAdminCanPauseAndRotateIssuer() public {
        vm.prank(address(0xB0B)); vm.expectRevert(); drop.pause();
        vm.expectRevert(); drop.setIssuer(address(0xB0B));
        drop.pause();
        uint256 deadline = block.timestamp + 120;
        bytes memory proof = authorization(DEVICE, recipient, deadline);
        vm.expectRevert(); drop.claim(DEVICE, recipient, deadline, proof);
        drop.setIssuer(address(0xB0B));
        drop.unpause();
        vm.expectRevert(StarproofAirdrop.InvalidAuthorization.selector);
        drop.claim(DEVICE, recipient, deadline, proof);
    }

    function testForkActualStarproofTokenPayout() public {
        string memory url = vm.envOr("BASE_FORK_URL", string(""));
        if (bytes(url).length == 0) { vm.skip(true); return; }
        vm.createSelectFork(url);
        StarproofAirdrop actualDrop = new StarproofAirdrop(address(this), vm.addr(ISSUER_KEY));
        address actualRecipient = address(new Recipient());
        vm.prank(TOKEN_DEPLOYER);
        assertTrue(MockToken(TOKEN).transfer(address(actualDrop), 2000 ether));
        uint256 deadline = block.timestamp + 120;
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(ISSUER_KEY, actualDrop.claimDigest(DEVICE, actualRecipient, deadline));
        actualDrop.claim(DEVICE, actualRecipient, deadline, abi.encodePacked(r, s, v));
        assertEq(MockToken(TOKEN).balanceOf(actualRecipient), 1000 ether);
        assertTrue(actualDrop.claimed(DEVICE));
    }
}
