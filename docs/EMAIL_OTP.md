# StageFlow email OTP

Registration now uses Supabase Auth's six digit signup OTP (`verifyOtp` with
`type: 'signup'`). The verification screen also keeps the confirmation-link
fallback, so a user can complete registration from either message format.

## Local development

`supabase/config.toml` enables `auth.email.enable_confirmations` and the local
SMTP catcher. Local Supabase does not deliver messages to the public internet.
When using the local stack, inspect the Auth email inbox exposed by the local
Supabase tooling.

## Production delivery

Configure an SMTP provider in the linked Supabase project under
**Authentication → SMTP Settings**, enable email confirmations, and add:

- `https://your-domain.example/auth/callback`
- `https://your-domain.example/**`

to the Auth redirect allow-list. Use the same origin in `NEXT_PUBLIC_SITE_URL`.
The application sends through Supabase Auth, so no SMTP password is stored in
this repository and no OTP is persisted by StageFlow.
