"""Strict, shared-format action parsing; no hardware imports so it can be tested on a host."""

FIELDS = ("origin", "session", "challenge", "chip", "action", "from", "target", "cost", "sequence", "expires", "nonce")
WORLDS = {"sol": "Sol", "kepler": "Kepler", "vega": "Vega", "lyra": "Lyra"}
ARTIFACTS = {"sol": "Lunar archive", "kepler": "Ocean prism", "vega": "Stellar compass", "lyra": "Echo capsule"}


def _hex(value, length):
    return len(value) == length and all(c in "0123456789abcdef" for c in value)


def parse_action(text):
    if not isinstance(text, str) or len(text) > 1024 or any(ord(c) > 126 or (ord(c) < 32 and c != "\n") for c in text):
        raise ValueError("not a Starproof action")
    lines = text.split("\n")
    if len(lines) != len(FIELDS) + 1 or lines[0] != "starproof/v1":
        raise ValueError("wrong action format")
    fields = {}
    for name, line in zip(FIELDS, lines[1:]):
        if not line.startswith(name + "="):
            raise ValueError("wrong action fields")
        fields[name] = line[len(name) + 1:]
    origin = fields["origin"]
    if not (origin.startswith("http://localhost:") or origin.startswith("http://127.0.0.1:")):
        raise ValueError("use the local Starproof demo")
    port = origin.rsplit(":", 1)[1]
    if not port.isdigit() or not 1 <= int(port) <= 65535:
        raise ValueError("bad origin")
    for name, length in (("session", 32), ("challenge", 32), ("chip", 64), ("nonce", 64)):
        if not _hex(fields[name], length):
            raise ValueError("bad " + name)
    for name in ("sequence", "expires"):
        value = fields[name]
        if not value.isdigit() or len(value) > 11 or str(int(value)) != value:
            raise ValueError("bad " + name)
    action, source, target = fields["action"], fields["from"], fields["target"]
    if source not in WORLDS or target not in WORLDS:
        raise ValueError("unknown destination")
    if action not in ("launch", "jump", "claim"):
        raise ValueError("not a strategic action")
    if fields["cost"] != ("1" if action == "jump" else "0"):
        raise ValueError("unexpected fuel cost")
    if action == "launch" and (source != "sol" or target != "sol" or fields["sequence"] != "0"):
        raise ValueError("bad launch")
    if action == "jump" and source == target:
        raise ValueError("choose another system")
    if action == "claim" and source != target:
        raise ValueError("claim in the current system")
    return fields


def certificate_der(blob):
    for offset in range(min(17, len(blob) - 4)):
        if blob[offset] != 0x30:
            continue
        first = blob[offset + 1]
        count = (first & 127) if first & 128 else 0
        if count > 3:
            continue
        length = first if not count else 0
        for i in range(count):
            length = length * 256 + blob[offset + 2 + i]
        end = offset + 2 + count + length
        if length >= 200 and end <= len(blob):
            return blob[offset:end]
    raise ValueError("cannot read chip certificate")
