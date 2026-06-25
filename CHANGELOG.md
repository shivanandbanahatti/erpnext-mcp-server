# Changelog

Fork maintained for production use with Frappe/ERPNext (any site via API keys).

Based on [hatlabs/erpnext-mcp-server](https://github.com/hatlabs/erpnext-mcp-server) (originally [rakeshgangwar/erpnext-mcp-server](https://github.com/rakeshgangwar/erpnext-mcp-server)).

## [0.5.0] — 2026-06-25

### Added

- **Retail Ops MCP tools** (requires `retail_ops` app on target site):
  - `get_retail_ops_info` — module metadata
  - `get_retail_ops_doctypes` / `get_retail_ops_doctype_fields` — discovery
  - `list_production_order_trackers` / `get_production_order_tracker` — tracker CRUD read
  - `create_production_order_tracker` / `update_production_order_tracker` — tracker write
  - `get_tracker_for_sales_order` — resolve tracker from Sales Order
  - `get_sales_order_readiness` — payment + production + QC readiness
  - `check_delivery_gate` — dry-run Delivery Trip submit gate
  - `list_retail_ops_reports` / `run_retail_ops_report` — all 7 Retail Ops reports

- **retail_ops Frappe API** (`retail_ops.api.mcp`) for whitelisted gate checks and discovery.

## [0.4.0] — 2026-06-12

### Added

- **Starmark Recruitment MCP tools** (requires `starmark_recruitment` app on target site):
  - `get_starmark_recruitment_doctypes` — list DocTypes in module Starmark Recruitment
  - `get_extraction_summary` — Candidate Salary counts by extraction_status
  - `resolve_job_opening_dimensions` — email → Job Applicant → Job Opening dimensions
  - `normalize_candidate_experience` — parse free-text experience to years
  - `extract_candidate_salary_now` — sync OpenAI extraction for one Candidate Information
  - `run_bulk_salary_extraction` — bulk backfill with enqueue / redo_failed options
  - `get_bulk_extraction_status` — bulk progress summary
  - `clean_total_experience` — normalize Candidate Information total_experience
  - `import_starmark_salary_bands` — Excel/CSV band importer
  - `get_market_salary_dashboard` — dashboard KPI + aggregated bands
  - `run_market_salary_detail_report` — Market Salary Detail report
  - `run_market_salary_band_report` — Market Salary Band Report
  - `list_candidate_salaries` / `get_candidate_salary` — Candidate Salary CRUD read
  - `list_starmark_salary_bands` / `get_starmark_salary_band` — internal bands
  - `get_salary_intelligence_settings` — OpenAI model / tuning single doc

### Changed

- Replaced **athru_recruitment** MCP integration with **starmark_recruitment** (`starmark_recruitment.api.mcp`).
- Legacy tool aliases: `get_job_opening_dimensions`, `create_candidate_salary`, `run_bulk_candidate_salary_extraction`.

### Removed

- `extract_salary_from_slip` (athru_recruitment-only; use `extract_candidate_salary_now` instead).

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
