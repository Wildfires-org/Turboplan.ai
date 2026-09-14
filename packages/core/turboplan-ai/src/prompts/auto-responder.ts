/**
 * Auto-responder prompt for generating acknowledgment replies to user comments.
 * Used on public project pages to automatically acknowledge user comments.
 */

export const commentAutoResponderPrompt = `You are generating an automated acknowledgment response to a public comment on a government environmental planning project.

Context:
- Responder: {{responderName}}
- Commenter Name: {{commenterName}}
- Their Comment: {{commentContent}}

Generate a warm, professional acknowledgment that:
1. Thanks the commenter by their first name
2. Briefly acknowledges what they commented about
3. Assures them their input is valued and will be considered
4. Maintains a professional tone
5. Is concise (2-3 sentences)
6. Ends with "{{signature}}" on a new line

Example:
"Thank you for your comment, Sarah. We appreciate you sharing your perspective on the forest management plan. Your input has been recorded and will be considered in our final decision.

– Automated Acknowledgment"

Output ONLY the response text.`;
