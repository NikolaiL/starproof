# Starproof post-submission changes

This changelog uses the commit that added the original [hackathon submission copy](https://github.com/NikolaiL/starproof/blob/356e81c0816202c4a96b83bdbd3827d3f5330753/docs/HACKATHON_SUBMISSION.md) as its baseline. That snapshot already had the 20-world game, Wedgie-signed actions, the reusable signing toolkit, and per-mission demo confirmation settings.

## Hardware drop on Base

Each verified Trust M chip can claim 1,000 STARPROOF once to a supported Safe. Starproof reuses the initialized Safe and factory keys and asks for physical approval of the token and full recipient address. The server verifies both proofs and Safe ownership, then relays the claim. The distributor permanently records which chips have claimed. Players can still look up their Safes after claiming. [Design and confirmed payout](docs/AIRDROP_DESIGN.md)

## Monster NFTs on Base

A signed artifact recovery on a monster world unlocks one ERC-721 mint per chip and world. The server revalidates the receipt and issues a mint voucher. The player selects a browser wallet and approves the mint using the existing encounter receipt. The Jelly Sentinel mint was confirmed on Base. [Implementation and mint evidence](README.md#monster-collectibles)

## Arkiv Expedition Atlas

Players can publish a milestone derived from a signed flight receipt using a funded Rabdi wallet. The atlas reads public entries, filters them by star system, and shows the publishing wallet. Entries expire after seven days. The first verified publication records a visit to Orion. [Atlas schema](arkiv/schema.md) · [Publication evidence](README.md#arkiv-expedition-atlas)

## Flight controls and Wedgie display

The flight camera keeps the rocket in view during joystick movement, and planet actions stay anchored as the map pans or zooms. The green button opens planet info, and travel starts from the browser. The desktop HUD groups ship resources and connection status, and the connected-device menu has a separate disconnect control. Wedgie app 0.5.1 matches the browser HUD with lime fuel, amber credits, and pink artifact rows. [Device release commit](https://github.com/NikolaiL/wedgie-starproof/commit/824dd688d63d7b190d2fe6ad910fc552f8ad43fe)

## Main page order

1. Map
2. Demo Admin Settings
3. Hardware Drop
4. Monster NFTs
5. Captain’s Diary
6. Arkiv Expedition Atlas

The demo switches sit directly below the map, and the diary appears immediately before the public atlas. The same order applies to the page layout and keyboard navigation.

Codex assisted with the implementation and documentation. See the [Classic provenance disclosure](README.md#provenance-and-classic-disclosure) for reused components.
