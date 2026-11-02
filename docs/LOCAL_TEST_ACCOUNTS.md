# Local test accounts

StageFlow ships a provisioning helper for the local Supabase stack. It refuses
hosted URLs and production mode, and it never stores passwords in the repository.

Create or reset two confirmed accounts with passwords you choose:

```powershell
npm run dev:provision-test-accounts -- `
  admin@stageflow.local "<admin-password>" `
  stagiaire@stageflow.local "<stagiaire-password>"
```

The administrator account can open `/admin/tableau-de-bord`; the stagiaire
account can open `/stagiaire/tableau-de-bord`. Because the local accounts are
created with `email_confirm: true`, the local test flow does not wait for an
OTP email. Production signup still uses the normal Supabase email confirmation
and OTP flow.
