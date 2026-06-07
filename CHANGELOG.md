# Changelog

Fork maintained for production use with Frappe/ERPNext (any site via API keys).

Based on [hatlabs/erpnext-mcp-server](https://github.com/hatlabs/erpnext-mcp-server) (originally [rakeshgangwar/erpnext-mcp-server](https://github.com/rakeshgangwar/erpnext-mcp-server)).

## [0.3.2] — 2026-06-07

### Added

- **Athru Real Estate MCP tools** (requires `athru_realestate` app on target site):
  - `get_athru_realestate_doctypes` — list all DocTypes in module Athru Real Estate
  - `get_athru_realestate_doctype_fields` — field metadata for app DocTypes
  - `list_athru_realestate_documents` — list Property / Real Estate Settings
  - `get_athru_realestate_document` — get single document with child tables
  - `create_athru_realestate_document` — create Property or Real Estate Settings
  - `update_athru_realestate_document` — update Property or Real Estate Settings
  - `get_published_properties` — website API (show_online=1)
  - `get_property_by_slug` — published property detail by slug

## [0.3.0] — 2026-05-27

### Added

- **Workshop Board MCP tools** (requires `workshop_board` app on target site):
  - `create_workshop_board` — wraps `workshop_board.api.board.create_board`
  - `get_workshop_board` — wraps `workshop_board.api.board.get_board`
  - `save_workshop_board` — wraps `workshop_board.api.board.save_board`
  - `list_workshop_boards` — lists `Workshop Board` documents via REST API

## [0.2.0] — 2026-05-21

### Fixed

- **`get_doctypes`**: Paginate all DocTypes (sites with 500+ were missing custom types e.g. Workshop Board).
- **`get_doctypes`**: Optional `search`, `module`, `custom_only` filters.
- **`get_doctypes`**: Removed misleading hardcoded fallback of 14 standard DocTypes on API failure.
- **`search_link` fallback**: Read Frappe `message` array (not nonexistent `results`).
- **`ERPNEXT_URL`**: Trim quotes, CR/LF, validate URL; default to `https://` if scheme omitted.
- **API keys**: Trim whitespace from `ERPNEXT_API_KEY` / `ERPNEXT_API_SECRET`.

### Added

- **`ERPNEXT_INSECURE_SSL=1`**: Optional TLS verify bypass for Windows / SSL-inspecting proxies (dev only).
- Clearer SSL error hints in `extractErrorDetail`.

## [0.1.0] — upstream (hatlabs)

- MCP tools: CRUD, reports, submit/cancel, `call_method`, child document queries.
- API key authentication.
