# Contributing

Use a bug report or feature request to explain the problem before making a large change. Follow [SECURITY.md](SECURITY.md) for vulnerabilities.

## Local setup

Use Node.js 22 or 24:

```sh
npm ci
npm run check
npm test
```

Unit tests do not require Firebase credentials. To run the app, follow the Firebase setup instructions in [README.md](README.md). Use a separate development Firebase project and never commit credentials or runtime data.

## Firestore access changes

Install Java 21 and the Firebase CLI, then run:

```sh
firebase emulators:exec --only firestore --project demo-milesight "npm test"
```

Use a dedicated emulator because authorization tests write fixtures. Add tests for allowed and denied access when changing rules. Server Admin SDK access bypasses browser rules and must be reviewed separately.

## Pull requests

- Explain the problem, final behavior, and validation performed.
- Keep changes focused and update usage instructions when behavior changes.
- Add meaningful regression tests for bug fixes.
- Include redacted before/after screenshots for interface changes. Check mobile layout, keyboard access, and light/dark themes.
- Keep package.json and package-lock.json consistent.

CI checks syntax and tests, runs the rules emulator, and builds an installation from the exact checkout. Package publication depends on those checks. Maintainers publish releases with matching version tags and notes under docs/releases/.
