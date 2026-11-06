# Sponsor plan — re-evaluated November 7, 2026

The user selected **ENS naming** and **Base monster NFTs**. NFT minting by itself is not an integration with any Mumbai prize sponsor. The Base ERC721 collection is deployed at `0xda218e0ab0f6c3da9fc3b0b8fc467fb9cde8a88c` using the user-approved existing airdrop issuer. This alone does not establish sponsor award eligibility.

| Priority | Track | Product idea and remaining evidence |
| --- | --- | --- |
| 1 | [ENS: Best Use of ENSv2](https://ethglobal.com/events/mumbai/prizes/ens), $7,000 pool | Portable captain/ship identities: reciprocal ENS records plus a navigator with permission to edit only the ship logbook key. Read, publish, grant, revoke and logbook UI are implemented. Demonstrate actual registered ENSv2 names, a successful delegated write and a rejected write after revocation on Ethereum mainnet. A plain name label or a Base-only custom naming contract does not satisfy this track. |
| 2 | [Arkiv: Build on Arkiv, from scratch](https://ethglobal.com/events/mumbai/prizes/arkiv), $4,000 pool | A public expedition/monster-discovery explorer that reads and filters Arkiv entities. Keep private certificates off the public index. Store minimal receipt hashes and public encounter data with documented ownership/expiry. No Arkiv code yet. Requires current-testnet writes, user-visible reads and `/arkiv/` judging files; logs alone are excluded. |
| 3, conditional | [Ethereum Foundation: Best CROPS App](https://ethglobal.com/events/mumbai/prizes/ethereum-foundation), $3,500 pool | A verifiable receipt viewer/issuer with an honest account of centralized authority, linkable chip identifiers and recovery limits. Current minting still trusts our server, and hosted metadata needs our domain. Requires a demonstrated structural CROPS benefit, documentation and demo; do not claim censorship resistance merely because an NFT exists. |

## Other candidates

- [World IDKit](https://ethglobal.com/events/mumbai/prizes/world), $2,500 pool: plausible for scarce rewards with a human eligibility gate, but not necessary for ordinary collectible minting. Needs a successful credential check and a denied/cancelled path, verified server-side. No integration yet.
- [Chainlink CRE](https://ethglobal.com/events/mumbai/prizes/chainlink), $1,500: possible for verified encounter → reward orchestration, but adds a second workflow to the existing issuer. Requires a meaningful blockchain/external-system workflow and successful CLI simulation or deployment. No integration yet.
- [Hedera No Solidity Allowed](https://ethglobal.com/events/mumbai/prizes/hedera), $2,000: previously shortlisted. Now conflicts with the selected Solidity ERC721/Base direction; it requires no Solidity and at least two native Hedera services. Do not spend an application slot on our current implementation.
- [0G Physical AI](https://ethglobal.com/events/mumbai/prizes/0g): a device signing game decisions is insufficient. Requires substantive 0G decision-loop calls, episode logs/request IDs on 0G Storage and a safe stop. No AI loop exists here.
- Uniswap, 1inch, Definitive, Arc and Whitechain would require meaningful trading, finance, stablecoin-payment or Studio flows. Turning game credits into paid tokens just to fit a prize is outside this plan.

## Names and network choices

The user requested `starcaptain` and `starship` and explicitly chose **Base, not Sepolia**, for NFTs. Mainnet registrar availability queries on November 7 found `starcaptain.eth` available and `starship.eth` unavailable; those results can change and no name was bought. Proposed names are `starcaptain.eth` and `starship.starcaptain.eth`, subject to namespace setup. The user subsequently chose to keep ENS prepared and finish Base NFTs first; no ENS purchase is authorized by that choice.

ENS resolution/management is rooted in Ethereum; the NFT collection lives on Base. The UI switches the wallet explicitly for the relevant operation. ENS documentation describes a mainnet transition while the prize page says ENSv2 is live: confirm the selected names use a writable ENSv2 Permissioned Resolver before spending on setup. An ENSv1 mirror resolver is not the write target. The integration does not silently fall back to ENSv1 or claim that ordinary ENSv1 writes qualify.

## Submission checks

[Official Mumbai submission guide](https://ethglobal.com/events/mumbai/info/details): up to three partner programs, with multiple tracks from one sponsor counting as one selection. Preserve Classic provenance, Git history and AI/reuse disclosures. An existing sponsor shortlist is not a completed integration. The published guide lists November 7, 2026 at 09:00 IST; check the live dashboard for organizer changes.

Current priority, per the user: finish the Base monster collection using the existing airdrop proof issuer; leave ENS prepared. After live NFT setup, demonstrate ENS with controlled names if the user resumes that work, then consider Arkiv. A contract deployed on Base does not by itself satisfy ENS, Arkiv or another sponsor's requirements.
