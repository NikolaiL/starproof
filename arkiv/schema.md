# Expedition atlas schema

`starproof-expedition-v1` stores the `system` id, `action`, and a digest of the game receipt and its signature. The atlas filters on the indexed `system` field and reads the owner, creation block, action, and system. The publishing Rabdi wallet signs and owns each entry. Entries expire after seven days.
