# Starproof hackathon submission

## Short description (83 characters; maximum 100)

A space game and toolkit for hardware-signed decisions using Wedgie’s Trust M chip.

## Description (531 characters; minimum 280)

Starproof turns space exploration into a hands-on demo of hardware-signed game actions. Pilot a rocket across 20 worlds, meet 18 strange neighbors, recover artifacts and manage your fuel. A connected Wedgie uses its OPTIGA Trust M chip to sign your expedition’s launch. Configurable switches choose whether travel, artifact collection, refuelling and scavenging also need device confirmation. The game is a playable reference for our reusable Wedgie toolkit, helping developers add certified-chip signatures to browser experiences.

## How it’s made (1402 characters; minimum 280)

We built Starproof with vanilla JavaScript, HTML/CSS and Canvas for the game, Node.js 24 for the authoritative API, and MicroPython for the Wedgie app. Web Serial connects the browser to the device. Each signed action binds the mission, origin, destination, cost, sequence, expiry and a random challenge. The device validates the action and asks for physical green-button approval; the server verifies its P-256 signature and Infineon factory certificate chain. This establishes participation by a certified Trust M chip.

We extracted the transport, action protocol and certificate verifier into wedgie-actions, and published the installable device app separately. First-run installation uses pinned GitHub source and SHA-256 checksums. We reused Wedgie’s MIT USB helpers and 3D model with Three.js, and built the game’s procedural planets, monsters and effects around them. The project was built with Codex assistance.

Vercel hosts the browser and API; private Upstash Redis stores missions and atomically consumes challenges. Two notable hacks keep the device usable: USB cancellation remains responsive inside approval prompts, and installation reconnects to the same board after a USB restart. The joystick doubles as a flight controller, while the idle device screen displays live game stats. Demo switches allow selected unsigned actions, explicitly labeled in the diary; launch remains signed.

## Submission assets

- [Cover image — 1600×900](../public/media/starproof-cover.png)
- [Open Graph image — 1200×630](../public/media/starproof-og.png)
- [Favicon — SVG](../public/favicon.svg) and [ICO](../public/favicon.ico)
- Live project: https://starproof-wedgie.vercel.app
