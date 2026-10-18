# Milesight Dashboard

Single-file app ([milesight.js](./milesight.js)): an MQTT broker (port 1883), a web dashboard (port 8080) and Firestore storage for Milesight gateways.

## Run

1. `npm install`
2. Copy `.env.example` to `.env` and adjust.
3. Place your Firebase service account key at the path in `FIREBASE_SERVICE_ACCOUNT_PATH` (never commit it).
4. `npm start`

## Firebase setup

Enable Email/Password authentication and any social providers you use in Firebase Authentication. Add your dashboard hostname to Authentication's authorized domains.

The browser needs the access rules in [firestore.rules](./firestore.rules). They restrict dashboard data to its workspace owner; members use the Telegram assistant and can look up only their own verified email membership. Bot tokens, AI keys, invitation codes, and broker passwords cannot be read through the browser SDK. Broker credential creation is permitted only for the caller's claimed workspace. Server writes use the Admin SDK.

With the Firebase CLI installed and signed in, deploy to your explicit project:

```sh
firebase deploy --only firestore:rules --project YOUR_PROJECT_ID
```

The existing queries use Firestore's automatic single-field `ts` index; no composite indexes are needed. The empty [firestore.indexes.json](./firestore.indexes.json) records that requirement. The command above deploys only rules and leaves existing index definitions alone.

## Checks

Run `npm run check` to check server syntax and `npm test` for dashboard regression tests. These checks do not require Firebase credentials or running services.

The Firestore authorization integration test skips unless `FIRESTORE_EMULATOR_HOST` is set. With Java and the Firebase CLI installed, run it against an isolated demo project:

```sh
firebase emulators:exec --only firestore --project demo-milesight "npm test"
```

This checks owner access, cross-workspace denial, secret protection, verified email lookup, and rejection of forged telemetry. It loads the rules from this repository. Use a dedicated local emulator: the test writes fixture documents. Run this check before deploying rules; it does not connect to production Firebase.

History shows up to the latest 500 readings in the selected period, ordered chronologically. Switching sensors, metrics, or periods discards results from earlier pending requests.
The chart labels capped results, offers retry after a failed query, and enables CSV export only after readings load.
