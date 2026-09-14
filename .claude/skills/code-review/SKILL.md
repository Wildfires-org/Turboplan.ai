---
name: code-review
description: >
  Conduct thorough code reviews on branch diffs. Analyzes code quality, logic correctness, security,
  performance, and dependency concerns. Produces inline issue reports with severity/location/fix plus
  an executive summary. Use when the user asks to "review code", "review my changes", "code review",
  "check my branch", "review this PR", or any request to evaluate code changes before merging.
  Automatically applies project-specific conventions from CLAUDE.md when present.
---

# Code Review

## Scope Discipline

Review ONLY the code specified in the user's prompt. Do not expand scope beyond what was requested.

- **Branch diff** (e.g., "review develop vs main"): Only review the diff between those two branches. Run `git --no-pager diff <base>..<head>`.
- **Specific directory/module/package** (e.g., "review packages/core/turboplan-db"): Only review files within that path.
- **PR or current changes** (e.g., "review my changes"): Only review uncommitted or branch-specific changes.
- **Never** flag issues in unchanged code that is merely adjacent to the diff, unless the changed code directly introduces a bug in that context.

## Workflow

1. **Determine the diff.** Based on the user's prompt, identify the exact scope (see Scope Discipline above). Default to `git --no-pager diff develop...HEAD --stat` then `git --no-pager diff develop...HEAD` if no specific scope is given. The three-dot syntax ensures only changes introduced by the current branch are shown, matching GitHub's PR diff behavior. If the user specifies a different base branch, use that instead (always with three-dot syntax).
2. **Read full context.** For every changed file, read the entire current file (not just the diff) to understand surrounding context. This is critical for catching issues the diff alone cannot reveal.
3. **Apply project conventions.** If `CLAUDE.md` exists in the repo root, apply its conventions and architectural rules as additional review criteria.
4. **Analyze each changed file** against the review checklist below.
5. **Produce the report** in the output format below.

## Review Checklist

### Pragmatic Engineering (MVP Mindset)

Apply these principles in context, not as dogma — use judgement, but flag clear violations as issues:

- **YAGNI** (You Aren't Gonna Need It): Flag dead code, unused exports, speculative features, over-engineered abstractions, or code paths that serve no current requirement.
- **KISS** (Keep It Simple, Stupid): Flag unnecessary complexity — overly generic solutions, premature abstractions, deep inheritance hierarchies, or convoluted patterns where a straightforward approach would suffice. We are building an MVP.
- **DRY** (Don't Repeat Yourself): Flag obvious duplication. However, prefer duplication over a bad abstraction — do not recommend extracting shared code if the resulting abstraction would be forced, leaky, or harder to understand than the duplication itself.
- **SOLID**: Flag violations of single responsibility, open-closed, Liskov substitution, interface segregation, and dependency inversion when they cause real maintainability or extensibility problems. Do not enforce SOLID for its own sake.
- **Mid-level readability**: Code should be easy to understand by a mid-level software engineer. Flag hacky workarounds, overly clever tricks, or convoluted logic that sacrifices clarity for brevity. Prefer straightforward, maintainable solutions.

### Code Quality & Best Practices
- Readability, clarity, and maintainability
- Adherence to language-specific conventions and style guides
- Opportunities for simplification or refactoring
- Naming conventions for variables, functions, and classes
- Code structure and organization

### Functionality & Logic
- Code achieves its intended purpose
- Potential bugs, edge cases, or logic errors
- Proper error handling and validation
- Algorithm efficiency and performance implications

### Security & Safety
- Security vulnerabilities (SQL injection, XSS, CSRF, etc.)
- Input sanitization and validation
- Authentication and authorization logic
- Data handling and privacy considerations
- Hardcoded secrets or sensitive information

### Performance & Scalability
- Performance bottlenecks
- Database query efficiency (N+1 queries, missing indexes)
- Unnecessary computations or redundant operations
- Memory usage and resource management
- Scalability implications

### Dependencies & Compatibility
- New dependencies: necessity and security
- Deprecated APIs or functions
- Backward compatibility concerns
- Version compatibility

## Output Format

### Inline Issues

For each issue found, report:

- **Severity**: Critical / High / Medium / Low
- **Location**: `file_path:line_number`
- **Issue**: Clear description of the problem
- **Recommendation**: Specific suggestion for improvement
- **Example**: Code snippet showing the fix (when applicable)

Group issues by file, ordered by severity (Critical first).

### Executive Summary

After all inline issues, provide:

1. **Overall assessment** - One-paragraph quality summary
2. **What was done well** - Highlight positive patterns
3. **Must-fix before merge** - Priority-ordered list of Critical/High issues
4. **Suggestions** - Optional improvements (Medium/Low) that are not blockers
