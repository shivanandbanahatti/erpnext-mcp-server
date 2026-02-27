# ERPNext MCP Server

A [Model Context Protocol](https://modelcontextprotocol.io/) server that connects MCP-compatible AI tools to ERPNext. It gives your AI assistant full read/write access to your ERPNext instance — inventory, manufacturing, sales, purchasing, and reporting — through natural language.

Originally forked from [rakeshgangwar/erpnext-mcp-server](https://github.com/rakeshgangwar/erpnext-mcp-server). This fork adds API key authentication, minimal response optimization, and additional tools for document lifecycle management and server-side method calls.

## What You Can Do

Once connected, you interact with ERPNext through natural conversation with your AI assistant. Here are examples from real-world usage:

### Inventory & Stock

- "Check stock levels for all components in the HALPI2 BOM — do we have enough to build 10 units?"
- "Create a stock reconciliation to set the actual quantity of SOM-CM5108000 to 15 in Stores"
- "Record a material receipt for the 200 PCBs we received from JLCPCB"

### Manufacturing

- "Complete work orders for the 8 HALPI2 units I assembled this week and create the manufacture stock entries"
- "The open work orders reference obsolete BOMs with disabled components — cancel and amend them with the current default BOMs"
- "Manufacture 5 units from work order MFG-WO-2026-00014, substituting CM5-lite modules for the standard ones"

### Sales & Fulfillment

- "Shopify orders #A2399 and #A2402 have been fulfilled — find the corresponding ERPNext sales orders and create delivery notes"
- "Which fulfilled Shopify orders are missing delivery notes in ERPNext?"

> **Note**: Cross-system workflows involving Shopify require a separate Shopify MCP server (e.g., [shopify-mcp](https://github.com/GeLi2001/shopify-mcp)) running alongside this one. The AI assistant uses both servers together seamlessly.

### BOMs & Products

- "Update all active HALPI2 BOMs to replace the old enclosure sub-assembly with the new one"
- "Show me the full component breakdown and cost for BOM-COM-HALPI2-007"
- "Create a new 256GB NVMe SSD item variant under the existing template"

### Purchasing

- "The purchase order has the wrong item on line 4 — it should be SOM-CM5116016, not SOM-CM5116000. Fix the PO and the linked purchase receipt."

### Pricing (with [Shopify MCP](https://github.com/GeLi2001/shopify-mcp))

- "Update Shopify prices for all HALPI2 variants to reflect the new ERPNext base prices, adding 25.5% VAT"
- "Set up a 20% sale on all HALPI2 variants with strikethrough pricing"

### Reporting

- "Run the Stock Balance report for the Stores warehouse"
- "Find all active BOMs that still reference disabled items"

## Prerequisites

- Node.js 20+
- An ERPNext instance with API access enabled
- API key and secret — generate these in ERPNext under **Settings > Users > [your user] > API Access > Generate Keys**

## Installation

Clone and build:

```bash
git clone https://github.com/hatlabs/erpnext-mcp-server.git
cd erpnext-mcp-server
npm install
npm run build
```

### Claude Code

```bash
claude mcp add erpnext \
  -e ERPNEXT_URL=https://your-erpnext.example.com \
  -e ERPNEXT_API_KEY=your-api-key \
  -e ERPNEXT_API_SECRET=your-api-secret \
  -- node /path/to/erpnext-mcp-server/build/index.js
```

### Claude Desktop

Open **Settings > Developer > Edit Config** and add the `erpnext` entry under `mcpServers`:

```json
{
  "mcpServers": {
    "erpnext": {
      "command": "node",
      "args": ["/path/to/erpnext-mcp-server/build/index.js"],
      "env": {
        "ERPNEXT_URL": "https://your-erpnext.example.com",
        "ERPNEXT_API_KEY": "your-api-key",
        "ERPNEXT_API_SECRET": "your-api-secret"
      }
    }
  }
}
```

### Other MCP Clients

Any MCP-compatible client can use this server. It communicates over stdio and requires three environment variables:

| Variable | Description |
|----------|-------------|
| `ERPNEXT_URL` | Base URL of your ERPNext instance |
| `ERPNEXT_API_KEY` | API key for authentication |
| `ERPNEXT_API_SECRET` | API secret for authentication |

## Tools

The server exposes 10 tools that the AI client discovers automatically through MCP:

| Tool | Description |
|------|-------------|
| `get_doctypes` | List all available DocTypes |
| `get_doctype_fields` | Get field definitions for a DocType |
| `get_documents` | Query documents with filters and field selection |
| `get_document` | Get a single document by name, including all child tables |
| `create_document` | Create a new document |
| `update_document` | Update an existing document |
| `submit_document` | Submit a document (set docstatus to 1) |
| `cancel_document` | Cancel a submitted document (set docstatus to 2) |
| `call_method` | Call a whitelisted server-side API method |
| `run_report` | Run an ERPNext report |

## Development

```bash
npm install          # Install dependencies
npm run build        # Compile TypeScript
npm run watch        # Auto-rebuild on changes
npm run lint         # Run linter
npm run format:check # Check formatting
npm run inspector    # Launch MCP Inspector for debugging
```

The [MCP Inspector](https://github.com/modelcontextprotocol/inspector) opens a browser-based UI for testing tool calls interactively.
