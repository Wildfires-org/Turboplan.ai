---
"turboplan": minor
"@wildfires-org/turboplan-utils": patch
"@wildfires-org/turboplan-documents": patch
"@wildfires-org/turboplan-fields": patch
"@wildfires-org/turboplan-gantt-task": patch
"@wildfires-org/turboplan-research-agent-integration": patch
"@wildfires-org/turboplan-tasks": patch
---

The web app now carries only the Wildfires.org brand: its logo mark, favicon,
OG card, orange and forest colors and Söhne type on every build
(`NEXT_PUBLIC_BRAND_THEME` is no longer read). The previous mascot is gone from
the sign-in, sign-up, check-email, verify, signup loading and error screens
(now the logo mark, with a status badge where it helps) and from the tasks,
documents and fields empty states and the project setup banner. Primary
buttons use the forest gradient, focus rings and accents the orange. The auth
header shows the app name in the sidebar's sans type, the signup page gets
the same logo header, and the Project Context upload area only mentions the
project map when maps are enabled.
