# Security policy

## Reporting

Please report vulnerabilities privately through GitHub's **Report a vulnerability** feature for this
repository. Do not include API keys, private pilgrim information, or exploit details in a public issue.

## Supported version

Security fixes are applied to the latest revision on the `main` branch.

## Security model

- API credentials are loaded from environment variables and must never be committed.
- Keys entered through the UI remain in tab memory and are used only for the selected API request.
- Non-local API endpoints must use HTTPS.
- Model output and retrieved snippets are escaped before browser rendering.
- Retrieved documents are treated as untrusted reference data in the generation prompt.
- The application is designed for educational guidance and must not be treated as an authoritative
  religious, medical, legal, or emergency system.
