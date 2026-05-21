# Changelog

Fork maintained for production use with Frappe/ERPNext (any site via API keys).

Based on [hatlabs/erpnext-mcp-server](https://github.com/hatlabs/erpnext-mcp-server) (originally [rakeshgangwar/erpnext-mcp-server](https://github.com/rakeshgangwar/erpnext-mcp-server)).

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
