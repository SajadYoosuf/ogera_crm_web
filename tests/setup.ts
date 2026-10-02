// Signing and verifying both happen in-process, so any secret works.
process.env.JWT_SECRET = "unit-test-secret";
