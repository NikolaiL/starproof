# Sponsor plan — re-evaluated November 7, 2026

The user removed ENS from the product and sponsor plan. Starproof retains the certified-chip gameplay, signed encounter receipts, Base monster collection and STARPROOF airdrop. No alternative sponsor integration below is implemented yet. Base is not a listed Mumbai sponsor; deploying ERC721s or paying an airdrop does not qualify for another sponsor by itself.

## Recommended shortlist

| Priority | Track and pool | Fit for Starproof | Qualification gap |
| --- | --- | --- | --- |
| 1 | [Arkiv: Build on Arkiv (from scratch)](https://ethglobal.com/events/mumbai/prizes/arkiv), $4,000 | A shared discovery atlas: publish recovered encounters and let players filter discoveries by planet, monster species and collector. Other clients can query the public dataset without our Redis or API. | Current-testnet writes plus a user-visible feature that reads them. README needs writer addresses and a reproducible query. Required files: `/arkiv/schema.md`, `friction.md`, `reach.md`, `why-arkiv.md`, `how-you-use-arkiv.md`. Public licensed source and AI disclosure. An unread log or installed SDK does not count. |
| 2 | [Ethereum Foundation: Best Use of Anon-RPC](https://ethglobal.com/events/mumbai/prizes/ethereum-foundation), $5,000 | Browse Base collection ownership and confirm mints with private RPC reads; keep transaction signing in the player's wallet. | App-owned RPC reads through Anon-RPC by default, working end to end. Current reads use the injected wallet or server RPC. Prove a real anonymizing transport works with Base; disclose coverage, bootstrap exposure and latency. The reference passthrough worker does not anonymize traffic. |
| 3 | [Chainlink: Best workflow with CRE](https://ethglobal.com/events/mumbai/prizes/chainlink), $1,500 | Orchestrate verified encounter → reward eligibility using the gameplay API and Base state. | A meaningfully used CRE workflow combining a blockchain with an external API/system, with a successful CRE CLI simulation or live deployment. Simulation is accepted for this specific track. The existing issuer is not CRE, and CRE does not independently attest a physical button press. |

**Recommendation: Arkiv first.** A discovery browser belongs in the game without inventing a paid economy, a second identity system or an AI agent. Keep private mission state in Redis. Publish only minimal public encounter data and receipt digests, not certificates, full signed receipts or chip identifiers. A digest is not independently verifiable proof. Define entity wallet ownership, edit rights and expiry; expiring an atlas entry must not revoke a Base NFT. Arkiv does not remove trust in our encounter issuer.

Anon-RPC is a feasibility candidate, not a tested integration here. Its [official browser guide](https://ethereum.github.io/anon-rpc/wallets/) supplies anonymous fetch for a chosen RPC URL, with a sandbox and bootstrap. Validate a real privacy transport before selecting the prize. Private reads do not hide public Base transactions or the wallet/mission links already known by our server. Document which browser and server traffic is covered.

## Optional or conditional tracks

- [Arkiv + Swarm bonus (from scratch)](https://ethglobal.com/events/mumbai/prizes/arkiv), $500: put useful encounter art or discovery bundles on Swarm, reference them from Arkiv, and actually read them in the atlas. Requires both networks, `/arkiv/swarm.md`, a working entity/reference pair, postage batch and upload service details, reproducible upload/read code and a visible demo use. Storage setup/payment is additional work. It can be won on top of an Arkiv track and does not consume another partner selection.
- [World: Best Use of IDKit](https://ethglobal.com/events/mumbai/prizes/world), $2,500: fits an optional tournament or scarce reward requiring person-level eligibility beyond one certified chip. Requires a supported credential verified on the backend/onchain, successful and denied/cancelled/ineligible paths, and an integration debrief. Adds onboarding and a new product rule; do not gate ordinary flight or existing earned NFTs merely to fit a sponsor.
- [Ethereum Foundation: Best CROPS App](https://ethglobal.com/events/mumbai/prizes/ethereum-foundation), $3,500: an independent expedition-receipt verifier that works without Starproof's server could build on the existing proof toolkit. Requires a structural CROPS property, a README section titled `CROPS` explaining all four letters/dependencies, a demo of at most three minutes showing the moment that property matters, and no client trackers. The mission server, proof issuer and hosted metadata remain dependencies. One EF prize per project; EF decides placement, so this is an alternative to Anon-RPC rather than an extra expected payout.

## Leave out for the current product

- ENS: explicitly removed; no parent purchase, registration or naming integration planned.
- [Hedera No Solidity Allowed](https://ethglobal.com/events/mumbai/prizes/hedera): requires no Solidity and at least two native services. The game uses Solidity on Base. Other Hedera tracks require agent payments or financial asset/stablecoin lifecycles not present here.
- [0G](https://ethglobal.com/events/mumbai/prizes/0g): Private Computer needs inference central to the main flow. Physical AI needs a real 0G decision loop, episode logs on 0G Storage, replay/hardware demo and safe stop. Hardware signatures or static aliens alone do not meet those requirements.
- [Uniswap](https://ethglobal.com/events/mumbai/prizes/uniswap-foundation), [1inch](https://ethglobal.com/events/mumbai/prizes/1inch), [Definitive](https://ethglobal.com/events/mumbai/prizes/definitive): need meaningful protocol/trading functionality absent from the current game.
- [Arc](https://ethglobal.com/events/mumbai/prizes/arc) and [Whitechain](https://ethglobal.com/events/mumbai/prizes/whitechain): require specific Studio, stablecoin settlement, commerce or finance flows. Do not add paid fuel or trading solely to fit a prize.
- Chainlink CCIP: its $3,500 track requires CCIP inside contracts causing a blockchain state change. The CRE simulation allowance does not establish CCIP qualification; Base-only NFTs do not count.

## Submission constraints

The README documents a new **Classic** project created November 6. Preserve that provenance, reused-code attribution, Git history and AI disclosure. Do not select Continuity-only variants unless the organizer actually changes the cohort. Adding sponsors to a newly created game does not make it a Continuity project.

The [official Mumbai submission guide](https://ethglobal.com/events/mumbai/info/details) permits up to three partner selections. Arkiv explicitly counts its tracks plus Swarm bonus as one selection. Do not fill slots without functional integrations. The published deadline is **November 7, 2026 at 09:00 IST**; verify the dashboard for organizer changes. The general video uploader requires 2–4 minutes; 2–3 minutes also fits EF's tighter limit.

Next decision: prove the Arkiv atlas first; evaluate Anon-RPC or CRE only after a concrete feasibility check. No prize is claimed as qualified by this plan.
