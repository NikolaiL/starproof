# Arkiv feedback

The SDK exposes `$createdAt` in the projection but rejects `desc('$createdAt')`. This atlas reads a bounded batch and sorts those results locally. Supporting creation-block ordering in the query would let a public feed fetch its newest entries directly. The public RPC was sufficient for the first read and wallet balance check.
