# FINORVE Staging

This branch is the integration/staging lane for changes before production.

Flow:
1. Develop and validate changes in `staging`.
2. Verify the Vercel preview deployment.
3. Validate Supabase migrations/functions against the Supabase staging branch once provisioned.
4. Run recovery/security checks.
5. Merge to `main` only after validation.

Production remains `main` and https://finorve.com.

## Production deploy trigger policy
If a merged hotfix is not picked up by Vercel Git integration, a documentation-only main commit may be used to retrigger the deployment. The production artifact must still match the tested main application tree.
