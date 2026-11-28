# Findings and evidence

## Status vocabulary

Use `OPEN`, `IN PROGRESS`, `FIXED`, `VERIFIED`, `ACCEPTED`, `BLOCKED`, `FALSE POSITIVE`, `SUPERSEDED`, or `REGRESSION`. Keep classification separate from priority.

## Finding record

For every finding record:

- stable ID and title;
- priority and affected environment/surface;
- current status and historical status changes;
- exact file/line, configuration, provider, or runtime evidence;
- impact and reproducible root cause;
- provider-versus-application responsibility;
- smallest safe correction and rollback;
- changed files, migration/data implications, and dependent consumers;
- command, baseline SHA, environment, result, failure evidence, and reproduction steps;
- pull request/deployment/source SHA when applicable;
- hosted acceptance and remaining blockers.

Do not call a finding fixed because code exists on an unmerged branch. Do not call it verified when the relevant environment, provider, mailbox, backup restore, or authenticated journey was not exercised.

## Evidence safety

Record variable names and boolean presence, never values. Redact identities and customer data. Do not retain tokens, cookies, HAR data, connection strings, PEM contents, provider exports, or raw logs containing private data.

## Test ledger

Use one row per command or hosted check: timestamp, SHA, environment, command/journey, result, evidence, and limitations. A sandbox or network failure is a blocked execution, not an application failure; rerun at the proper boundary when authorized.
