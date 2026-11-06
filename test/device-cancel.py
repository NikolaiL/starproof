import json
import sys
import types

sys.path.insert(0, __import__("os").environ["STARPROOF_DEVICE_DIR"])
text = json.load(sys.stdin)["text"]
sent, signed = [], []


class Keys:
    def __init__(self, physical=False):
        assert physical

    def pressed(self):
        return []


def ask(*args, **kwargs):
    for _ in range(10):
        assert kwargs["keys"].pressed() == []
    raise AssertionError("the pending prompt was not cancelled")


sys.modules["lcd"] = types.SimpleNamespace(Keys=Keys)
sys.modules["ui"] = types.SimpleNamespace(ask=ask, progress=lambda *a, **k: None, page=lambda *a, **k: None, INK=1, MUTED=2)
sys.modules["wedgie"] = types.SimpleNamespace(send=sent.append)
sys.modules["starproof_art"] = types.SimpleNamespace(MissionDisplay=object)
import starproof
from starproof_protocol import parse_action


class Reader:
    def __init__(self):
        self.lines = iter([
            json.dumps({"id": 7, "type": "press", "key": "A"}),
            json.dumps({"id": 8, "type": "starproof_cancel", "request": 40}),
            "not json",
            json.dumps({"id": 9, "type": "starproof_cancel", "request": 41}),
        ])

    def pump(self, poll):
        return next(self.lines, None)


starproof.reader = Reader()
starproof.d = types.SimpleNamespace(preview=None)
starproof.cert = "cached public certificate"
starproof.fingerprint = parse_action(text)["chip"]
starproof.chip = types.SimpleNamespace(sign=lambda *args: signed.append(args))
starproof.handle({"id": 41, "type": "starproof_sign", "text": text})
assert not signed
assert sent[0]["type"] == "error", "other commands must not execute inside approval"
assert sent[1] == {"id": 8, "type": "starproof_cancelled", "cancelled": False}
assert sent[-2] == {"id": 9, "type": "starproof_cancelled", "cancelled": True}
assert sent[-1] == {"id": 41, "type": "refused"}
starproof.handle({"id": 10, "type": "starproof_cancel", "request": 41})
assert sent[-1] == {"id": 10, "type": "starproof_cancelled", "cancelled": False}
print("device request cancellation OK")
