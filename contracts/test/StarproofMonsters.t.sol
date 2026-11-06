// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;
import {Test} from "forge-std/Test.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
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
interface IPermissionedResolver {
    struct Grant { address account; uint256 roleBitmap; }
    function initialize(Grant[] calldata grants, bytes[] calldata calls) external;
    function setText(bytes calldata name, string calldata key, string calldata value) external;
    function grantSetterRoles(bytes calldata setter, address account) external returns (bool);
    function revokeRoles(uint256 resource, uint256 roleBitmap, address account) external returns (bool);
    function resolve(bytes calldata name, bytes calldata data) external view returns (bytes memory);
}
contract ENSv2ForkTest is Test {
    function testRealResolverDelegationAndRevocation() public {
        string memory url = vm.envOr("SEPOLIA_FORK_URL", string(""));
        if (bytes(url).length == 0) { vm.skip(true); return; }
        vm.createSelectFork(url);
        address implementation = address(0x115eb53F0c60696633855F90b138178Fb40b2b2C);
        assertGt(implementation.code.length, 0, "official Sepolia ENSv2 resolver must exist");
        IPermissionedResolver.Grant[] memory grants = new IPermissionedResolver.Grant[](1);
        grants[0] = IPermissionedResolver.Grant(address(this), (1 << 4) | (uint256(1 << 4) << 128));
        IPermissionedResolver resolver = IPermissionedResolver(address(new ERC1967Proxy(implementation,
            abi.encodeCall(IPermissionedResolver.initialize, (grants, new bytes[](0))))));
        bytes memory name = hex"0473686970076578616d706c650365746800";
        string memory key = "games.starproof.logbook";
        address navigator = address(0xB0B);
        resolver.setText(name, "games.starproof.captain", "captain.example.eth");
        resolver.grantSetterRoles(abi.encodeCall(IPermissionedResolver.setText, (name, key, "")), navigator);
        vm.prank(navigator); resolver.setText(name, key, "Reached Kepler");
        assertEq(abi.decode(resolver.resolve(name, abi.encodeWithSignature("text(bytes32,string)", bytes32(0), key)), (string)), "Reached Kepler");
        vm.prank(navigator); vm.expectRevert(); resolver.setText(name, "games.starproof.captain", "impostor.eth");
        resolver.revokeRoles(uint256(keccak256(bytes(key))), 1 << 4, navigator);
        vm.prank(navigator); vm.expectRevert(); resolver.setText(name, key, "Unauthorized update");
    }
}
