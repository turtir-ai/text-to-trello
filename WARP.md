# WARP.md

This file provides guidance to WARP (warp.dev) when working with code in this repository.

## Common commands

- Install dependencies
  ```bash path=null start=null
  npm install
  ```

- Copy environment template (Windows PowerShell)
  ```powershell path=null start=null
  Copy-Item .env.example .env
  ```

- Start in watch mode for local development (Express HTTP API + MCP over stdio in same process)
  ```bash path=null start=null
  npm run dev
  ```
  Notes:
  - The HTTP API listens on MCP_SERVER_PORT (default 3000). The PORT env var in .env.example is not read by server.js for the HTTP port.
  - To avoid starting the HTTP server when running purely as an MCP process, set NODE_ENV=production before starting (see below).

- Start as a plain MCP server (disable the dev HTTP server)
  ```powershell path=null start=null
  $env:NODE_ENV = 'production'; node server.js
  ```

- Run tests (scripted checks + optional interactive mode)
  ```bash path=null start=null
  # Non-interactive
  npm test

  # Interactive parser checks
  npm test -- --interactive
  ```

- CLI: convert text or files into Trello tasks
  ```bash path=null start=null
  # Direct text
  npm run text-to-trello -- "PROJE: Website Yenileme"

  # From file
  npm run text-to-trello -- --file notes.txt

  # Interactive text session
  npm run text-to-trello -- --interactive
  ```

- Call the local HTTP API (examples)
  ```powershell path=null start=null
  # Create task from a natural-language command
  $body = @{ command = "Ziya'ya yeni proje analizi görevi ata" } | ConvertTo-Json
  Invoke-RestMethod -Uri http://localhost:3000/api/task -Method Post -ContentType 'application/json' -Body $body

  # Assign an existing card
  $body = @{ command = "Website analizi kartını Mehmet'e ata" } | ConvertTo-Json
  Invoke-RestMethod -Uri http://localhost:3000/api/assign -Method Post -ContentType 'application/json' -Body $body

  # Text-to-Trello (bulk from free-form text)
  $body = @{ text = "GÖREV: Mobil uygulama kritik`n- Login akışı`n- Bildirimler"; useAI = $true } | ConvertTo-Json
  Invoke-RestMethod -Uri http://localhost:3000/api/text-to-trello -Method Post -ContentType 'application/json' -Body $body
  ```

## Environment configuration

Required for Trello access
- TRELLO_API_KEY, TRELLO_TOKEN
- DEFAULT_BOARD_ID

Optional (Gemini AI)
- GEMINI_API_KEY, GEMINI_MODEL (default model in code: gemini-1.5-flash)

Optional (OAuth 2.0 for Trello)
- TRELLO_OAUTH_ENABLED=true | false
- TRELLO_CLIENT_ID, TRELLO_CLIENT_SECRET, TRELLO_OAUTH_CALLBACK_URL

Ports and modes
- MCP_SERVER_PORT controls the Express HTTP port in dev (default 3000)
- Set NODE_ENV=production to skip starting the HTTP server and run only the MCP stdio server

Note on README vs code: README mentions PORT=3001, but the server uses MCP_SERVER_PORT. Set MCP_SERVER_PORT if you need a specific HTTP port during development.

## High-level architecture

This project is a Node.js MCP server that integrates with Trello and exposes both:
- An MCP tool surface (for LLM agents over stdio)
- A minimal Express HTTP API and static web UI (public/)

Key modules and flow
- server.js
  - Bootstraps dotenv, Express (serves public/), and the MCP stdio server (@modelcontextprotocol/sdk)
  - Constructs singletons: TrelloManager, CommandProcessor, TextToTrello, GeminiManager, OAuth manager
  - Defines MCP tools exposed to agents:
    - create_task(command, board_id?)
    - assign_task(command)
    - list_boards()
    - get_board_info(board_id)
    - search_cards(query)
  - HTTP endpoints (guarded by OAuth when enabled):
    - POST /api/task, POST /api/assign
    - GET /api/boards
    - AI utilities: GET /api/ai/status, POST /api/ai/enhance, POST /api/ai/suggest
    - Bulk: POST /api/text-to-trello (processes free-form text into multiple Trello cards)
  - Development-only HTTP server runs unless NODE_ENV=production

- trello-manager.js
  - Thin axios wrapper around Trello REST API with shared auth params (key, token)
  - Core operations: list boards, board info (lists, members), search/find cards, create/update/move cards, add labels/comments, assign/remove members
  - Contains member alias mapping logic to improve name matching (e.g., ziya -> ziyaeyuboglu)

- command-processor.js
  - Turkish-focused NLP using regex heuristics to parse natural-language commands
  - Extracts: task name, assignees (@user and "...'ya/...'ye" forms), target list, priority (yüksek/orta/düşük), labels, and description
  - Implements two primary flows used by MCP tools and HTTP API:
    - processCreateTaskCommand(command, boardId?) → resolves members/lists, computes due date from priority, creates card, comments context
    - processAssignTaskCommand(command, boardId?) → finds card and member, assigns, comments context

- text-to-trello.js
  - Higher-level bulk processor: ingests unstructured text blocks and converts them into structured items (PROJE:, ARAŞTIRMA:, GÖREV:, etc.)
  - Uses GeminiManager when available to normalize/segment text; otherwise falls back to deterministic rules
  - For each extracted item: chooses target list, composes a descriptive card body (including subtasks as markdown checkboxes), resolves assignees, sets due dates heuristically, and creates the card
  - Also ships a CLI entry point (npm run text-to-trello)

- gemini-manager.js
  - Optional Google Generative AI integration for text enhancement, categorization, priority detection, subtasks, and summaries
  - Provides resilient fallbacks so the system continues to function without an API key

- oauth-manager.js
  - Optional Trello OAuth 2.0 integration via passport-oauth2
  - When enabled (TRELLO_OAUTH_ENABLED=true), adds /auth/* routes and protects API endpoints via requireAuth; otherwise API is open for local dev

Notable implementation details
- Source files live at repo root (server.js, trello-manager.js, etc.). The README’s example structure with src/ is outdated.
- The MCP server runs over stdio from the same process as the dev HTTP server. For clean stdio during agent usage, prefer NODE_ENV=production.

## Important notes from README

- You must provision Trello API Key/Token and set DEFAULT_BOARD_ID.
- Gemini AI is optional; the system has a rule-based fallback and works without it.
- The web UI is served from public/ when the HTTP server is running; by default in dev at http://localhost:3000 unless you set MCP_SERVER_PORT.

## What Warp should prefer doing

- For Trello automation via agents, prefer invoking MCP tools (create_task, assign_task, list_boards, get_board_info, search_cards) when connected as an MCP client.
- For local development and debugging, prefer the HTTP endpoints shown above or the CLI (text-to-trello) for bulk conversions.

