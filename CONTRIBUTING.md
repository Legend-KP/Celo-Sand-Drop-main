# Contributing

Thanks for your interest in contributing. This repository is a Celo Composer–style monorepo (Next.js app under `packages/react-app`, Hardhat under `packages/hardhat`). Use the steps below so reviews stay small and predictable.

## Getting started

1. Fork the repository and clone your fork.
2. Install dependencies from the repository root (this project uses **pnpm**; a `pnpm-lock.yaml` is committed at the root).

   ```bash
   pnpm install
   ```

   You can also use **yarn** or **npm** if you prefer; the root README documents those flows.

3. Configure environment files before running the app or deploying contracts:

   - **Frontend:** copy `packages/react-app/.env.template` to `packages/react-app/.env` and set `NEXT_PUBLIC_WC_PROJECT_ID` (and any other variables your feature needs). See `packages/react-app/README.md`.
   - **Contracts:** follow `packages/hardhat/README.md` (for example `env.template` → `.env` with `PRIVATE_KEY` where applicable).

4. Create a branch from `main`:

   ```bash
   git checkout -b feat/your-feature-name
   ```

5. Make your changes, run checks (see below), then open a pull request against `main`.

## Branch naming

| Type     | Pattern                     | Example                    |
| -------- | --------------------------- | -------------------------- |
| Feature  | `feat/<short-description>`  | `feat/minipay-session`     |
| Bug fix  | `fix/<short-description>`   | `fix/walletconnect-reconnect` |
| Docs     | `docs/<short-description>`  | `docs/contributing-update` |
| Chore    | `chore/<short-description>` | `chore/deps-bump`          |

## Commit messages

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```text
<type>(<scope>): <short summary>

[optional body]

[optional footer, e.g. Closes #42]
```

Examples:

```text
feat(react-app): add chance API validation
fix(hardhat): correct ignition module network config
docs: link CONTRIBUTING from README
```

## Code style and checks

- **Next.js app:** from `packages/react-app`, run ESLint before you push:

  ```bash
  pnpm run lint
  ```

  (Or `npm run lint` / `yarn lint` if you use those package managers in that package.)

- **Hardhat:** from `packages/hardhat`, compile and run tests when you touch contracts or deployment scripts:

  ```bash
  pnpm run compile
  pnpm run test
  ```

- Prefer **TypeScript** types and clear names over comments that only restate the code. Add a short comment when the *why* is non-obvious (workarounds, security, or chain-specific behavior).

- New or changed **public** helpers and shared modules benefit from **JSDoc / TSDoc** so editors and future readers see parameters and return values quickly.

## Pull request checklist

Before you open a PR:

- [ ] Lint passes for the areas you changed (`packages/react-app` when you touch the frontend).
- [ ] Contract changes: `pnpm run test` (or `npm run test`) passes under `packages/hardhat`.
- [ ] `CHANGELOG.md` updated under `[Unreleased]` when the change is user-visible or worth calling out in release notes.
- [ ] PR description states **what** changed and **why** (link issues when relevant).

## Reporting bugs

Open an issue and include:

- Steps to reproduce
- Expected vs actual behavior
- Environment (OS, Node version, browser if relevant, branch or commit)

## Conduct

Be respectful and constructive in issues and pull requests.

## License

By contributing, you agree that your contributions are licensed under the same terms as the project. See [LICENSE](LICENSE).
