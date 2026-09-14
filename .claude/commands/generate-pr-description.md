- Look at the current PR and write a description in bullet points.
- Use `gh pr` to inspect PR details and commits.
- If doing diff, compare against `develop` branch.
- List only important feature implementations in short.
- File names, function names, and identifiers should be formatted as inline code.
- Do not update the PR description using `gh`.
- Return output as **copyable raw markdown**:
  - Wrap the entire response in one fenced code block using triple backticks and `markdown` language tag.
  - Output only that code block (no intro, no explanation, no extra text before/after).
  - Keep markdown syntax literal so it can be pasted directly into GitHub.

Use the following format inside the fenced markdown block:

### {{ [TC-xxx] }} {{ title }}

- **Feature 1**: concise description
- **Feature 2**: concise description
- ...