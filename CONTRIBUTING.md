# Contributing

Thank you for improving Pilgrim Companion.

## Development workflow

1. Fork the repository and create a focused branch.
2. Create `.venv` and install `requirements-dev.txt`.
3. Keep changes scoped and add regression coverage.
4. Run `pytest -q`, `scripts/audit_kb.py`, and `scripts/evaluate_retrieval.py`.
5. Open a pull request describing the problem, solution, and validation.

## Knowledge-base changes

Knowledge changes require more care than application changes:

- Prefer official Ministry of Hajj and Umrah, Nusuk, and clearly attributable scholarly sources.
- Preserve source name, canonical URL, and chunk order.
- Do not add unattributed model-generated religious content.
- Explain the review method and source date in the pull request.
- Rebuild the index and report retrieval-metric changes.

## Code standards

- Use descriptive names and type annotations for public Python interfaces.
- Never commit `.env`, credentials, local models, or virtual environments.
- Treat retrieved content as untrusted input.
- Keep browser rendering safe; do not insert model or source text as unsanitized HTML.
- Add comments only where intent or a non-obvious constraint is not clear from the code.

For vulnerabilities or accidentally exposed sensitive material, follow `SECURITY.md` instead of
opening a public issue.
