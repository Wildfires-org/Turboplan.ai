# @wildfires-org/turboplan-chat-actions

Customizable quick-action buttons rendered below the TurboPlan chat input. Each action is a pill-shaped button that sends a predefined message to the chat when clicked. Buttons that don't fit the available width collapse into an "All" dropdown, and the row shows skeletons while measuring.

## Exports

- `./client` — `ChatActions` React component (plus re-exported types)
- `./types` — `ChatAction`, `ChatActionsProps`, `Attachment`, `Status`

## Usage

```tsx
import { ChatActions } from "@wildfires-org/turboplan-chat-actions/client";
import type { ChatAction } from "@wildfires-org/turboplan-chat-actions/types";

const actions: ChatAction[] = [
  { label: "Summarize", message: "Summarize this conversation", icon: "📝" },
];

<ChatActions
  append={append}
  chatId={chatId}
  attachments={attachments}
  setAttachments={setAttachments}
  chatActions={actions}
  status={status}
/>;
```

Clicking an action calls `append` with the action's `message` (role `user`) and any current attachments, then clears the attachments. Buttons are disabled while the row is measuring, and while the optional `status` prop is set to anything other than `"ready"`.
