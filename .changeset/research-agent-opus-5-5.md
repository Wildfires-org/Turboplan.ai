---
"@wildfires-org/research-agent": patch
---

Support Claude Opus 5.5 (`claude-opus-5-5`) in the research agent and upgrade the
Claude Agent SDK from 0.2.37 to 0.3.283 (support for
Opus 5.5 landed in 0.3.280). The Modal sandbox image and the local dev dependency now pin the same
SDK version (they had drifted to 0.2.37 and ^0.2.79). Set
`CLAUDE_MODEL=claude-opus-5-5` to use it; the code fallback when
`CLAUDE_MODEL` is unset is still `claude-sonnet-4-6`. OpenRouter routing maps
the new ID to `anthropic/claude-opus-5.5`. The subagent block in the agent's
`disallowedTools` now names the tool `Agent`, its name since SDK 0.3. The next
deploy rebuilds the sandbox image, which is larger because the SDK now ships a
native Claude Code binary.
