import "dotenv/config";
import axios from "axios";
import http from "http";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

const mcpServer = new Server(
  {
    name: "apollo-mcp",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// ---------- TOOL SCHEMA ----------
const ApolloSearchSchema = z.object({
  query: z.string().describe("Search query for people"),
});

// ---------- LIST TOOLS ----------
mcpServer.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "apollo_search_people",
        description:
          "Search Apollo for people, decision makers, and emails. Use when user asks for contacts or leads.",
        inputSchema: {
          type: "object",
          properties: {
            query: { type: "string" },
          },
          required: ["query"],
        },
      },
    ],
  };
});

// ---------- CALL TOOL ----------
mcpServer.setRequestHandler(CallToolRequestSchema, async (request) => {
  if (request.params.name === "apollo_search_people") {
    const { query } = ApolloSearchSchema.parse(request.params.arguments);

    const res = await axios.post(
      "https://api.apollo.io/v1/mixed_people/search",
      { q_keywords: query },
      {
        headers: {
          "Content-Type": "application/json",
          "x-api-key": process.env.APOLLO_API_KEY!,
        },
      }
    );

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(res.data).slice(0, 8000),
        },
      ],
    };
  }

  throw new Error(`Unknown tool: ${request.params.name}`);
});

// ---------- HTTP SERVER FOR RAILWAY/LANGSMITH ----------
const httpServer = http.createServer((req, res) => {
  // CORS headers for LangSmith
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  // Health check endpoint
  if (req.url === "/" && req.method === "GET") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        status: "ok",
        service: "apollo-mcp",
        version: "1.0.0",
      })
    );
    return;
  }

  // MCP info endpoint
  if (req.url === "/mcp" && req.method === "GET") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        name: "apollo-mcp",
        version: "1.0.0",
        description:
          "Apollo MCP server for lead research and contact discovery",
        tools: [
          {
            name: "apollo_search_people",
            description:
              "Search Apollo for people, decision makers, and emails",
          },
        ],
      })
    );
    return;
  }

  // 404 for other endpoints
  res.writeHead(404, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ error: "Not found" }));
});

// ---------- START SERVERS ----------
async function main() {
  const port = process.env.PORT || 3000;

  // Start HTTP server for Railway/LangSmith
  httpServer.listen(port, () => {
    console.log(`Apollo MCP HTTP server listening on port ${port}`);
    console.log(`Health check: http://localhost:${port}/`);
    console.log(`MCP info: http://localhost:${port}/mcp`);
  });

  // Start MCP server on stdio
  const transport = new StdioServerTransport();
  await mcpServer.connect(transport);
  console.log("Apollo MCP stdio transport started");
}

main().catch((err) => {
  console.error("Failed to start Apollo MCP server:", err);
  process.exit(1);
});