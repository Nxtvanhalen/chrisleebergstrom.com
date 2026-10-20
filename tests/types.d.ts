// Makes the `bun:test` module visible to `tsc --noEmit`. tsconfig.json sets no
// `types`, and with TypeScript 7 the @types/bun package is not picked up
// automatically, so the reference lives here (tsconfig's include covers tests/).
/// <reference types="bun" />
