---
"@wildfires-org/turboplan-mail": patch
---

Upgrade nodemailer to 10 (address-parser DoS and parsing advisories that 9.x
does not fix). Only the Ethereal development/test provider uses it; production
mail goes through Resend. nodemailer 10 ships its own types, so the provider
imports `Transporter` from the package. The e2e inbox reader's imapflow moves to
1.7.8, which no longer bundles nodemailer 7.
