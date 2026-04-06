# Ingredient Scanner / SafeBasket

## GitHub deployment pipeline

This repository includes a GitHub Actions workflow at `.github/workflows/deploy.yml`.

It performs:
- checkout
- Node.js setup
- dependency install
- optional validation / tests

The workflow runs on pushes to `main` and on manual dispatch.

## Lovable deployment

To deploy on Lovable safely:

1. Push this repository to GitHub under `github.com/chakraa1/ingredient-scanner`.
2. In the Lovable dashboard, connect the GitHub repository.
3. Set the environment variable `CLAUDE_API_KEY` in the Lovable app settings.
4. Configure the deployment branch as `main`.

### Important security notes

- Do not commit `.env` to GitHub. `.gitignore` already excludes `.env` and `uploads/`.
- Keep `CLAUDE_API_KEY` only in Lovable environment variables, never in frontend code.
- The app server uses `process.env.CLAUDE_API_KEY` on the backend only.

## Local usage

```bash
npm ci
npm start
```
