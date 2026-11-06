# Starproof token launch draft

Status: proposed branding. No token has been deployed. Network, contract address, token administrator, reward recipients, liquidity configuration and airdrop funding are not configured.

## Clanker form

| Field | Draft value |
| --- | --- |
| Name | Starproof |
| Symbol | STARPROOF |
| Image | [starproof-token.png](../public/media/starproof-token.png) |
| Public image URL | https://starproof-wedgie.vercel.app/media/starproof-token.png |
| Website | https://starproof-wedgie.vercel.app |
| Source | https://github.com/NikolaiL/starproof |

Description:

> Starproof brings hardware-signed decisions to a playful space-exploration game. Meet strange neighbors, discover new worlds, and build with Wedgie.

The full ticker ties the token directly to the project. Token names and symbols do not identify a deployment uniquely; use the final chain and contract address after launch.

## Image

![Starproof token avatar: jelly-piloted rocket, stars and a secure-chip badge](../public/media/starproof-token.png)

The PNG is 1024×1024 and 536,208 bytes, below the [Clanker deploy form’s 1 MB PNG/JPEG limit](https://clanker.world/deploy), checked November 6, 2026. The dark starfield, lime circular frame, jelly pilot and rocket extend the existing Starproof artwork. The main artwork stays within the circular avatar area; small decorative stars reach outside the frame. No text needs to remain readable at thumbnail size.

[Editable SVG source](../public/media/starproof-token.svg). Composed from the project’s original `launch-crew.svg` with its existing palette and star mark, then exported with resvg-js. No image-generation model or external stock artwork was used.

## Planned hardware airdrop

The proposed reward is 1,000 tokens per verified Trust M chip, paid to a user-selected Safe. Launching this token does not implement or fund that claim flow. The separate distributor requires an explicit token allocation and the proof-verification and permanent claim design in [AIRDROP_DESIGN.md](AIRDROP_DESIGN.md). Do not describe claims as live until that integration is deployed and tested.
