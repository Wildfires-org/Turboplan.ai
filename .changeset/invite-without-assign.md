---
"@wildfires-org/turboplan-workspace": patch
"turboplan": patch
---

The Invite Members, Create New Office and Approve Proposal dialogs no longer
have an "Assign" step. Picking a person, or typing an email and pressing Enter,
adds them straight to the pending list with the selected default role, and
Send Invitation sends that list. Before, a pick had to be assigned first; a pick
left unassigned was silently dropped on submit.

The member search also stops adding the wrong person. Typing a full email now
only offers that exact user or an invite, never a fuzzy match, and an email
that is already a member or already in the list shows "already added or a
member" instead of letting Enter pick someone else. The suggestions dropdown
closes after each pick so it no longer covers the pending list, and the role
picker on each pending invitee no longer shows two chevrons.
