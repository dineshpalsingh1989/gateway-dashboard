# Security reporting

Report suspected vulnerabilities through [GitHub private vulnerability reporting](https://github.com/dineshpalsingh1989/milesight-dashboard/security/advisories/new). Do not disclose exploit details, credentials, or customer data in public issues.

Private reporting must be enabled by the repository owner under **Settings > Security > Code security**. If the private-report link is unavailable, open an issue asking the maintainer to enable private reporting, without including vulnerability details.

Include the affected version or commit, reproduction steps, impact, and a minimal redacted example. Never include real service-account keys, setup tokens, MQTT passwords, or bot credentials. No response-time guarantee is currently offered.

Security fixes target the current main branch. Older releases do not have a separate maintenance commitment; update to a fixed release when available.

For deployment, use HTTPS for the dashboard and setup page, restrict access to administration endpoints, and use MQTT TLS when traffic crosses untrusted networks. Keep service-account files and runtime configuration outside source control. Back them up securely. Startup logs can contain the administrator setup token.
