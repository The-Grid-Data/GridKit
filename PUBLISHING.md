# Publishing grid-kit

## One-time setup

### npm account

1. Create an account at https://www.npmjs.com/signup (if needed)
2. Log in locally:
   ```bash
   npm login
   ```

### GitHub secret

1. Go to https://www.npmjs.com → Access Tokens → Generate New Token → **Granular Access Token**
2. Set permission to **Read and Write** for the `grid-kit` package
3. In the GitHub repo, go to **Settings → Secrets and variables → Actions → New repository secret**
4. Name: `NPM_TOKEN`, Value: the token from step 2

### First publish

```bash
npm publish --dry-run      # validate without publishing
npm publish --access public
```

The `prepublishOnly` script automatically runs typecheck, build, publint, and attw before publishing.

## Releasing a new version

```bash
npm version patch   # 0.1.0 → 0.1.1
# or
npm version minor   # 0.1.0 → 0.2.0
# or
npm version major   # 0.1.0 → 1.0.0

git push && git push --tags
```

`npm version` updates `package.json`, creates a commit, and creates a git tag. The push to `main` triggers the GitHub Actions workflow which runs the full validation pipeline and publishes to npm.

## What the CI pipeline does

On every push to `main` that changes `package.json`, the workflow at `.github/workflows/publish.yml`:

1. Checks if the `version` field actually changed (non-version edits are skipped)
2. Installs dependencies
3. Runs typecheck (`tsc --noEmit`)
4. Builds (`tsup`)
5. Runs `publint`
6. Runs `attw --pack --ignore-rules no-resolution`
7. Checks bundle size (`size-limit`)
8. Publishes to npm

## Manual publish (without CI)

If you need to publish directly from your machine:

```bash
npm publish --access public
```

## Troubleshooting

- **CI skips publish on push**: The workflow only runs when the `version` field in `package.json` changes. Make sure you used `npm version` and pushed to `main`.
- **CI fails at publish**: Check that the `NPM_TOKEN` secret is set and the token hasn't expired.
- **`prepublishOnly` fails locally**: Run the steps individually to find the issue:
  ```bash
  bun run typecheck
  bun run build
  bunx publint
  bunx attw --pack --ignore-rules no-resolution
  ```
