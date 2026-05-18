# Security Policy

## Reporting a Vulnerability

This is a **single-user self-hosted** application: each adopter runs their own
isolated stack on their own AWS account. There is no shared production
service, so most vulnerabilities affect only the reporter's own deployment.

That said, if you find an issue that could affect *every* deployment of this
code — for example, a flaw in authentication, IAM scoping, the SAM template,
or the AI provider integration that could leak data or bypass Cognito — please
**do not open a public GitHub issue**.

Instead, open a private security advisory on GitHub:

  https://github.com/nambaf/gym-tracker-oss/security/advisories/new

Include:

- A description of the vulnerability and its impact.
- Reproduction steps or a minimal proof of concept.
- Affected commit SHA or release tag.
- Any suggested remediation, if you have one.

You can expect an acknowledgement within a week. There is no formal SLA — this
is a hobby/personal project — but real issues will be triaged in good faith.

## What is NOT in scope

- Issues that require already-compromised AWS credentials of the deployer.
- Configuration mistakes by an adopter (e.g. publishing the Cognito User Pool
  to the internet, committing `.env.production`).
- DoS via expensive AI prompts — adopters control their own AI budget and
  rate limits.
- Third-party dependency CVEs that have a patched version available — please
  send a PR bumping the dependency instead.
