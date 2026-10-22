# ADR-001: JavaScript ESM

Accepted. Client, shared package and Express use ES2023 JavaScript without TypeScript, tsc or ts-check. JSDoc is documentation only. A tracked-source CI scan rejects .ts and .tsx files. Dependencies may internally contain declarations; they are not project source.
