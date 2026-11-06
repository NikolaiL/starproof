# Starproof hackathon submission

## Short description (93 characters; maximum 100)

A space game and developer toolkit for Wedgie-signed actions and one-claim-per-chip airdrops.

## Description (798 characters; minimum 280)

Starproof turns space exploration into a hands-on demo of hardware-signed game actions. Pilot a rocket across 20 worlds, meet 18 strange neighbors, recover artifacts and manage your fuel. A connected Wedgie uses its OPTIGA Trust M chip to sign your expedition’s launch. Configurable switches choose whether travel, artifact collection, refuelling and scavenging also need device confirmation. The game is a playable reference for our reusable Wedgie toolkit.

A live airdrop demo also lets each verified chip claim 1,000 STARPROOF on Base to a selected Safe without switching device apps. The browser and MicroPython source show developers how to implement the full flow: on-device approval, certified-chip proofs, server verification, gas-sponsored submission and permanent onchain claim tracking.

## How it’s made (2187 characters; minimum 280)

We built Starproof with vanilla JavaScript, HTML/CSS and Canvas for the game, Node.js 24 for the authoritative API, and MicroPython for the Wedgie app. Web Serial connects the browser to the device. Each signed action binds the mission, origin, destination, cost, sequence, expiry and a random challenge. The device validates the action and asks for physical green-button approval; the server verifies its P-256 signature and Infineon factory certificate chain. This establishes participation by a certified Trust M chip.

We extracted the transport, action protocol and certificate verifier into wedgie-actions, and published the installable device app separately. First-run installation uses pinned GitHub source and SHA-256 checksums. We reused Wedgie’s MIT USB helpers and 3D model with Three.js, and built the game’s procedural planets, monsters and effects around them. The project was built with Codex assistance.

Vercel hosts the browser and API; private Upstash Redis stores missions and atomically consumes challenges. Two notable hacks keep the device usable: USB cancellation remains responsive inside approval prompts, and installation reconnects to the same board after a USB restart. The joystick doubles as a flight controller, while the idle device screen displays live game stats. Demo switches allow selected unsigned actions, explicitly labeled in the diary; launch remains signed.

The live airdrop reuses the initialized Safe key and certified factory key inside the Starproof app. Two physical approval screens review the token and full receiving address. The Node API verifies both P-256 proofs, derives the Safe signer and checks ownership against canonical Safe 1.4.1 bytecode. It issues an EIP-712 authorization for a Solidity distributor built with OpenZeppelin, using viem and Alchemy on Base. A campaign-scoped hash of the factory public key prevents repeat claims even if the recipient or browser session changes. The contract pays exactly 1,000 tokens and records the chip claim permanently; Redis persists relay transactions before broadcast. We tested the real token and Safe contracts on a local Base fork, then verified a live device-approved payout.

## Submission assets

- [Cover image — 1600×900](../public/media/starproof-cover.png)
- [Open Graph image — 1200×630](../public/media/starproof-og.png)
- [Favicon — SVG](../public/favicon.svg) and [ICO](../public/favicon.ico)
- Live project: https://starproof-wedgie.vercel.app
