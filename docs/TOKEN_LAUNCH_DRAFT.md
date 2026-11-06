# Starproof token

Status: token deployed on Base mainnet and verified through direct contract reads and Clanker’s deployment record. The hardware airdrop is live, with its first 1,000-token claim confirmed onchain.

## Token details

| Field | Value |
| --- | --- |
| Name | Starproof |
| Symbol | STARPROOF |
| Network | Base mainnet · chain 8453 |
| Contract | `0x469F27BC9CA19d78455867aAFc7aA4186d3cCccC` |
| Decimals | 18 |
| Token administrator | `0x8D6230427a37986D25Fe4D5B3d0aaEF1b924fEd6` |
| Clanker | https://clanker.world/clanker/0x469F27BC9CA19d78455867aAFc7aA4186d3cCccC |
| Explorer | https://basescan.org/token/0x469F27BC9CA19d78455867aAFc7aA4186d3cCccC |
| Image | [starproof-token.png](../public/media/starproof-token.png) |
| Public image URL | https://starproof-wedgie.vercel.app/media/starproof-token.png |
| Website | https://starproof-wedgie.vercel.app |
| Source | https://github.com/NikolaiL/starproof |

Description:

> Starproof brings hardware-signed decisions to a playful space-exploration game. Meet strange neighbors, discover new worlds, and build with Wedgie.

The full ticker ties the token directly to the project. Token names and symbols do not identify a deployment uniquely; use the chain and contract address above.

## Image

![Starproof token avatar: jelly-piloted rocket, stars and a secure-chip badge](../public/media/starproof-token.png)

The PNG is 1024×1024 and 536,208 bytes, below the [Clanker deploy form’s 1 MB PNG/JPEG limit](https://clanker.world/deploy), checked November 6, 2026. The dark starfield, lime circular frame, jelly pilot and rocket extend the existing Starproof artwork. The main artwork stays within the circular avatar area; small decorative stars reach outside the frame. No text needs to remain readable at thumbnail size.

[Editable SVG source](../public/media/starproof-token.svg). Composed from the project’s original `launch-crew.svg` with its existing palette and star mark, then exported with resvg-js. No image-generation model or external stock artwork was used.

## Live hardware airdrop

The reward is 1,000 tokens per verified Trust M chip, paid once to a user-selected Safe. The [distributor](https://basescan.org/address/0x2c53e2bdf05e085fbff8f53585104db446fd39d0#code) was funded with 1,000,000 tokens; its [first live payout](https://basescan.org/tx/0x30f59545bbf780c35aa72c18ab4c6e44f1a5c42a40d9351c0bfed78268194640) sent exactly 1,000 tokens and consumed that chip’s claim. See the browser, device and contract flow in [AIRDROP_DESIGN.md](AIRDROP_DESIGN.md).

Deployment transaction: [BaseScan](https://basescan.org/tx/0xc3a7de237b4e9e26bb0ebe4775c2429818323a6e492ae63894f876a232d97569). Clanker identifies it as a tax-token deployment. Two ordinary transfers and a distributor payout delivered the exact requested amount on a local fork at Base block 53,986,156. Trading fees and dividend settings are separate from the fixed hardware-drop payout.
