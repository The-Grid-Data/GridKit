# Research: Best Practices for Building and Delivering a Small-Size NPM Package

### Specific to: grid-kit (React hooks + components, Bun, Axios, TanStack Query, Graffle, Storybook)

---

## 1. Bundling for NPM Library Packages

**Recommended bundler: tsup**

For library packages (as opposed to application bundles), the leading options as of 2025 are **tsup**, **rollup**, and **unbuild**. Here is why tsup is the strongest choice for grid-kit:

| Bundler | Pros | Cons |
|---------|------|------|
| **tsup** | Zero-config for most cases. Built on esbuild (extremely fast). Native ESM + CJS dual output. Generates `.d.ts` declaration files. Handles `external` automatically from `peerDependencies`. | Less granular plugin ecosystem than Rollup. |
| **Rollup** | Gold standard for libraries. Excellent tree-shaking. Huge plugin ecosystem. | Requires significant configuration. Slower than esbuild-based tools. |
| **unbuild** | Zero-config, auto-infers from package.json. Passive bundling mode (mkdist) good for preserving file structure. | Less mature ecosystem. Owned by UnJS/Nuxt ecosystem. |
| **Bun bundler** | Already in your toolchain. Fast. | As of early 2025, Bun's bundler does **not** generate `.d.ts` files, does not natively support dual ESM+CJS output in a single pass, and is primarily optimized for application bundling rather than library publishing. |

**Recommendation**: Use **tsup** for the build step, while using **bun** as the runtime/package manager for everything else (install, scripts, dev server, testing). This gives you the best of both worlds: bun's speed for development and tsup's library-optimized output for publishing.

**ESM vs CJS: Ship ESM-first, optionally include CJS**

- The ecosystem has moved decisively toward ESM. All modern bundlers (Vite, Next.js with Turbopack, etc.) consume ESM natively.
- Your consumers are React developers using modern toolchains -- ESM-only is a viable option.
- If you want maximum compatibility (e.g., older Next.js projects, Jest without ESM transform), ship **dual format**: ESM (`.mjs` or `.js` with `"type": "module"`) and CJS (`.cjs`).
- tsup handles this with a single flag: `--format esm,cjs`.

**Recommendation**: Ship dual ESM + CJS via tsup. Set `"type": "module"` in package.json so `.js` files are ESM by default, and use `.cjs` extension for CommonJS output.

---

## 2. Tree-Shaking

**The barrel export problem**

Barrel files (`index.ts` that re-exports everything) are the number one killer of tree-shaking in library packages. Here is why:

- When a consumer writes `import { useGridQuery } from 'grid-kit'`, bundlers must evaluate the barrel `index.ts` to find that export.
- If any module in the barrel has **side effects** at module scope (e.g., calling `axios.create()`, registering global state), bundlers cannot safely remove the other exports.
- Even without side effects, some bundlers (especially older webpack configs) struggle to tree-shake barrel re-exports.

**Recommended approach: Multiple entry points (not barrel-only)**

Structure the package with **granular entry points** so consumers can import directly:

```
import { useGridQuery } from 'grid-kit/hooks'
import { ThumbnailHoverCard } from 'grid-kit/components'
```

This is achieved via the `exports` field in package.json (see Section 3). Each entry point becomes a separate chunk that bundlers can independently include or exclude.

You can *also* provide a top-level barrel (`import { useGridQuery } from 'grid-kit'`) for convenience, but the granular paths are the primary mechanism for optimal tree-shaking.

**Concrete structure for grid-kit:**

```
src/
  index.ts              -- top-level barrel (re-exports everything)
  hooks/
    index.ts            -- hooks barrel
    useGridQuery.ts
    useGridSchema.ts
  components/
    index.ts            -- components barrel
    ThumbnailHoverCard.tsx
  client/
    index.ts            -- GraphQL client setup
```

tsup config with multiple entry points:

```
entry: ['src/index.ts', 'src/hooks/index.ts', 'src/components/index.ts', 'src/client/index.ts']
```

**Key rule**: Never perform side effects at module top-level scope. All initialization (axios instance creation, Graffle client creation) should be lazy or inside factory functions/hooks.

---

## 3. Package.json Configuration

This is the most critical part for a well-behaved NPM package. Here is the recommended configuration:

```jsonc
{
  "name": "grid-kit",
  "version": "0.1.0",
  "type": "module",
  "sideEffects": false,

  // Main entry points (legacy support)
  "main": "./dist/index.cjs",
  "module": "./dist/index.js",
  "types": "./dist/index.d.ts",

  // Modern entry points (takes precedence in modern bundlers)
  "exports": {
    ".": {
      "import": {
        "types": "./dist/index.d.ts",
        "default": "./dist/index.js"
      },
      "require": {
        "types": "./dist/index.d.cts",
        "default": "./dist/index.cjs"
      }
    },
    "./hooks": {
      "import": {
        "types": "./dist/hooks/index.d.ts",
        "default": "./dist/hooks/index.js"
      },
      "require": {
        "types": "./dist/hooks/index.d.cts",
        "default": "./dist/hooks/index.cjs"
      }
    },
    "./components": {
      "import": {
        "types": "./dist/components/index.d.ts",
        "default": "./dist/components/index.js"
      },
      "require": {
        "types": "./dist/components/index.d.cts",
        "default": "./dist/components/index.cjs"
      }
    }
  },

  // Only ship dist + package.json + README
  "files": ["dist", "README.md"],

  // Peer dependencies (NOT bundled into your package)
  "peerDependencies": {
    "react": "^18.0.0 || ^19.0.0",
    "react-dom": "^18.0.0 || ^19.0.0"
  },
  "peerDependenciesMeta": {
    "react-dom": { "optional": true }
  }
}
```

**Key fields explained:**

| Field | Purpose |
|-------|---------|
| `"type": "module"` | Declares the package as ESM. `.js` files are treated as ES modules. |
| `"sideEffects": false` | Tells bundlers that all modules are pure and can be safely tree-shaken. This is the **single most impactful setting** for package size at the consumer level. |
| `"exports"` | The modern Node.js package entry point map. Takes precedence over `main`/`module`. The **`types` condition must come first** within each block -- this is a TypeScript requirement. |
| `"files"` | Whitelist of files/dirs to include in the published tarball. Everything else is excluded. Always use this instead of `.npmignore`. |
| `"main"` / `"module"` | Legacy fallbacks for older tooling that does not support `exports`. `main` is for CJS, `module` is a de-facto standard for ESM (not officially in Node.js spec, but supported by bundlers). |

**Critical detail about `types` in `exports`**: The `types` condition must always be the **first** condition in each export block. TypeScript resolves conditions top-down and stops at the first match. If `default` comes before `types`, TypeScript will not find your declaration files.

---

## 4. Size Optimization

**What to externalize (peerDependencies)**

The golden rule: **anything the consumer already has in their project should be a peerDependency, not a bundled dependency.**

| Dependency | Classification | Rationale |
|------------|---------------|-----------|
| `react` | **peerDependency** | Consumer always has this. Must be a singleton (multiple React instances break hooks). |
| `react-dom` | **peerDependency** | Same as React. |
| `@tanstack/react-query` | **peerDependency** | Consumer likely uses this already. Must share the same QueryClient context. Cannot be bundled separately or hooks will use a different context. |
| `graffle` | **dependency** | Consumer unlikely to have this. It is specific to your GraphQL schema. Bundle it or ship as a direct dependency. |
| `axios` | **dependency** | Small enough to include. However, consider whether you actually need it (see note below). |

**Note on axios**: TanStack Query's `queryFn` is transport-agnostic. Graffle itself handles HTTP transport. You may not actually need axios as a separate dependency. If Graffle's transport layer handles all your HTTP needs, dropping axios removes a dependency entirely. Worth evaluating during implementation.

**tsup externalization**: tsup automatically externalizes everything in `peerDependencies` and `dependencies`. Only `devDependencies` code gets bundled. This is the correct behavior for library packages -- you want `dependencies` to be installed alongside your package but not duplicated inside your bundle.

**Additional size strategies:**

1. **Do not bundle CSS frameworks**. If you need styles for ThumbnailHoverCard, use CSS-in-JS that tree-shakes (e.g., vanilla-extract, Tailwind via utility classes) or ship a small CSS file separately. Avoid shipping a full CSS framework.

2. **Use `tsup --minify`** for production builds. For libraries, minification is less critical (consumers' bundlers will minify again), but it reduces install size.

3. **Use `tsup --treeshake`** to enable Rollup-level tree-shaking within tsup itself (it uses Rollup's tree-shaking algorithm on top of esbuild).

4. **Monitor bundle size**. Use `npx size-limit` or `npx bundlephobia` during CI. Set a size budget (e.g., < 15 KB gzipped for the entire package).

5. **Avoid pulling in large transitive dependencies.** Before adding any dependency, check its size on bundlephobia.com.

---

## 5. Bun-Specific Considerations

**Bun as runtime and package manager (recommended)**

Bun excels as a drop-in replacement for node + npm/yarn/pnpm for development workflows:

- `bun install` -- Faster than npm/yarn/pnpm for dependency installation.
- `bun run` -- Faster script execution (no Node.js startup overhead).
- `bun test` -- Built-in test runner compatible with Jest syntax (useful alongside Storybook).
- `bunx` -- Equivalent to `npx`, for running one-off commands.

**Bun as bundler (not recommended for library publishing)**

As of Bun 1.1.x (latest stable as of early 2025), Bun's built-in bundler has limitations for library packages:

1. **No `.d.ts` generation**: Bun's bundler does not emit TypeScript declaration files. You would need a separate `tsc --emitDeclarationOnly` step or use tsup which handles this internally.
2. **No dual-format output**: Bun's bundler targets a single format per invocation. You would need two separate build commands and manual configuration to get ESM + CJS.
3. **No `exports`-aware code splitting for libraries**: Bun's bundler is optimized for application bundles (single entry, browser/node target), not for library packages with multiple entry points.
4. **External marking is manual**: You must explicitly list externals rather than having them auto-detected from package.json fields.

**Recommended setup:**

```jsonc
// package.json scripts
{
  "scripts": {
    "build": "tsup",
    "dev": "tsup --watch",
    "test": "bun test",
    "storybook": "storybook dev -p 6006",
    "lint": "bunx eslint .",
    "typecheck": "bunx tsc --noEmit",
    "prepublishOnly": "bun run build",
    "size": "bunx size-limit"
  }
}
```

This way bun handles execution speed, and tsup handles the library-specific bundling concerns.

**bun.lockb vs package-lock.json**: If you use `bun install`, the lockfile is `bun.lockb` (binary format). This is fine for your development, but consumers installing your package via npm/yarn/pnpm will not use your lockfile -- they resolve from `package.json` fields only. This is normal and expected for published libraries.

---

## 6. Recommended tsup Configuration

```typescript
// tsup.config.ts
import { defineConfig } from 'tsup'

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    'hooks/index': 'src/hooks/index.ts',
    'components/index': 'src/components/index.ts',
  },
  format: ['esm', 'cjs'],
  dts: true,
  splitting: true,
  sourcemap: true,
  clean: true,
  treeshake: true,
  external: ['react', 'react-dom', '@tanstack/react-query'],
  minify: false,  // Let consumer's bundler handle minification
  target: 'es2020',
})
```

Key decisions in this config:
- **`splitting: true`**: Enables code splitting so shared code between entry points is not duplicated.
- **`dts: true`**: Generates TypeScript declaration files alongside JS output.
- **`treeshake: true`**: Uses Rollup's tree-shaking algorithm (more aggressive than esbuild's default).
- **`sourcemap: true`**: Helps consumers debug issues. Adds minimal overhead since sourcemaps are loaded on-demand.
- **`minify: false`**: Library convention. Consumers' bundlers will minify. Unminified code is easier to debug in node_modules.

---

## 7. Framework Agnosticism (Addressing the README Question)

The README asks: "what would it take to make it agnostic?"

The answer is a **layered architecture**:

```
Layer 1: Core (framework-agnostic)
  - GraphQL client setup (Graffle)
  - Query builders
  - Type definitions
  - Pure functions

Layer 2: React bindings
  - useGridQuery (wraps TanStack Query + Layer 1)
  - ThumbnailHoverCard (React component)

Layer 3: Future framework bindings (Vue, Svelte, etc.)
  - Could wrap Layer 1 with framework-specific primitives
```

Expose these as separate entry points:

```
grid-kit/core     -- Layer 1 (no React dependency)
grid-kit/react    -- Layer 2 (requires React)
grid-kit          -- Default, re-exports grid-kit/react for convenience
```

This way, a Vue developer could theoretically import `grid-kit/core` and write their own composables around it. For now, building Layers 1 and 2 with this separation in mind costs almost nothing extra and keeps the door open.

---

## 8. Pre-Publish Checklist

Before every `npm publish`:

1. **`npm pack --dry-run`** -- Shows exactly what files will be in the tarball. Verify no source files, tests, storybook stories, or config files leak in.
2. **`npx publint`** -- Lints your package.json `exports`/`main`/`module`/`types` fields for correctness. Catches common misconfigurations.
3. **`npx attw --pack`** -- (Are The Types Wrong) Validates that your TypeScript declarations resolve correctly for both ESM and CJS consumers.
4. **`npx size-limit`** -- Checks bundle size against your budget.

These can all be run as part of a `prepublishOnly` script or CI pipeline.

---

## 9. Summary of Actionable Recommendations

| Decision | Recommendation |
|----------|---------------|
| Bundler | **tsup** (esbuild-based, library-optimized) |
| Runtime/PM | **bun** (for install, scripts, tests) |
| Output format | **ESM + CJS dual** (`format: ['esm', 'cjs']`) |
| Package type | `"type": "module"` |
| Entry points | Multiple: `.`, `./hooks`, `./components` (optionally `./core`) |
| Tree-shaking | `"sideEffects": false` + multiple entry points + no top-level side effects |
| React/ReactDOM | **peerDependency** |
| TanStack Query | **peerDependency** (must share context) |
| Graffle | **dependency** (consumer does not have it) |
| Axios | **Evaluate necessity** -- may be redundant with Graffle's transport |
| TypeScript | Ship `.d.ts` files via tsup's `dts: true` |
| CSS | Minimal, co-located, no framework dependency |
| Size monitoring | `size-limit` or equivalent in CI |
| Publishing validation | `publint` + `attw` + `npm pack --dry-run` |
