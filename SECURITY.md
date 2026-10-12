# Security Policy

## What TaskFootprint does and does not do

TaskFootprint is a **read-only observer**. It hashes files, compares baselines, and writes local reports.

It does **not**:

- Sandbox or contain AI coding agents
- Prevent destructive shell commands
- Read agent private chats or credentials stores
- Upload data to the network
- Mutate the scanned repository (`git add` / `reset` / `clean` / `commit` / `push`)

## Reporting a vulnerability

Open a private GitHub Security Advisory on this repository, or email the maintainer via the GitHub profile contact options.

Please include:

- TaskFootprint version
- OS / Node version
- Minimal reproduction (synthetic data only — never send real secrets)

## Local report hygiene

Reports and baselines may contain relative paths and content hashes. Treat them as sensitive workspace metadata. Do not publish `index.html` / `changes.json` / baseline files without review.
