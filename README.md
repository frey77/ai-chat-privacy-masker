# AI Chat Privacy Masker

AI Chat Privacy Masker is a lightweight Chrome/Edge extension that helps you redact JSON, logs, and error messages before sending them to AI tools such as ChatGPT and Codex.

中文名：AI 对话脱敏助手

## Why This Project

When we paste debugging data into AI tools, it is easy to accidentally expose private or sensitive information such as tokens, phone numbers, ID fields, user names, cookies, or session values. This extension adds a quick local step before sharing:

- Paste JSON or plain error text
- Mask everything by default
- Keep a few prefix/suffix characters for debugging
- Unmask only the fields you decide are safe
- Search the field tree and review sensitive fields visually

## Features

- Default full masking for all JSON leaf fields
- Tree-based field selection with expand/collapse interaction
- Search by field name or path
- Sensitive field highlighting for keys like `token`, `authorization`, `phone`, `email`, `idcard`, `name`, and `userid`
- Partial masking with configurable prefix and suffix lengths
- Plain-text fallback mode for logs and error messages
- One-click copy of the redacted result
- Fully local workflow in the browser popup

## Use Cases

- Share backend API responses with ChatGPT safely
- Paste frontend error payloads into Codex without exposing user data
- Sanitize logs before creating bug reports
- Review third-party JSON payloads before team sharing

## Installation

1. Open Chrome or Edge.
2. Visit the extensions page.
3. Enable Developer Mode.
4. Click Load unpacked.
5. Select this project folder.

## How To Use

1. Click the extension icon.
2. Paste JSON, logs, or error text.
3. Review the tree view. Everything is masked by default.
4. Search fields if needed.
5. Uncheck fields that are safe to reveal.
6. Copy the sanitized output and send it to your AI tool.

## Project Structure

```text
ai-chat-privacy-masker/
├─ manifest.json
├─ popup.html
├─ popup.css
├─ popup.js
├─ README.md
├─ LICENSE
└─ .gitignore
```

## Roadmap

- Add keyword highlighting inside search matches
- Add an Only show sensitive fields toggle
- Add context-menu support for selected text
- Add quick paste-to-input integration for AI websites

## License

MIT
