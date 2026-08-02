# @faako/validation

Framework-independent Zod schemas for shared form, API-input, and integration
boundaries.

## Usage

Import a schema at the narrow boundary that receives untrusted input. Exported
TypeScript aliases are inferred from their corresponding schema declarations.
Extend schemas locally when an application intentionally accepts additional
fields.

Unknown object fields are stripped. Server-managed fields are not declared.

## Environment variables

None.
