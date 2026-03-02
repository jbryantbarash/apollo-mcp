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
          "Search Apollo for people, decision makers, and emails. Use when you need to find specific contacts or decision makers at companies.",
        inputSchema: {
          type: "object",
          properties: {
            query: {
              type: "string",
              description:
                "Search query for people (e.g., 'VP of Marketing at Stripe', 'CTO at Datadog')",
            },
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
    try {
      const { query } = ApolloSearchSchema.parse(request.params.arguments);

      if (!process.env.APOLLO_API_KEY) {
        throw new Error(
          "APOLLO_API_KEY not set in environment variables. Please set it in Railway Variables."
        );
      }

      const res = await axios.post(
        "https://api.apollo.io/v1/mixed_people/search",
        { q_keywords: query },
        {
          headers: {
            "Content-Type": "application/json",
            "x-api-key": process.env.APOLLO_API_KEY,
          },
        }
      );

      const resultText = JSON.stringify(res.data, null, 2).slice(0, 8000);

      return {
        content: [
          {
            type: "text",
            text: resultText,
          },
        ],
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      return {
        content: [
          {
            type: "text",
            text: `Error searching Apollo: ${errorMessage}`,
          },
        ],
        isError: true,
      };
    }
  }

  throw new Error(`Unknown tool: ${request.params.name}`);
});

// ---------- HTTP SERVER FOR RAILWAY/LANGSMITH ----------
const httpServer = http.createServer((req, res) => {
  // CORS headers
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization"
  );

  // Handle OPTIONS requests
  if (req.method === "OPTIONS") {
    res.writeHead(200);
    res.end();
    return;
  }

  // Health check endpoint
  if (req.url === "/" && req.method === "GET") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        status: "ok",
        service: "apollo-mcp",
        version: "1.0.0",
        message: "Apollo MCP server is running",
      })
    );
    return;
  }

  // Tools discovery endpoint (for LangSmith)
  if (req.url === "/tools" && req.method === "GET") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        tools: [
          {
            name: "apollo_search_people",
            description:
              "Search Apollo for people, decision makers, and emails. Use when you need to find specific contacts or decision makers at companies.",
            inputSchema: {
              type: "object",
              properties: {
                query: {
                  type: "string",
                  description:
                    "Search query for people (e.g., 'VP of Marketing at Stripe')",
                },
              },
              required: ["query"],
            },
          },
        ],
      })
    );
    return;
  }

  // Tool execution endpoint (for LangSmith)
  if (req.url === "/call-tool" && req.method === "POST") {
    let body = "";

    req.on("data", (chunk) => {
      body += chunk.toString();
    });

    req.on("end", async () => {
      try {
        const { tool_name, arguments: args } = JSON.parse(body);

        if (tool_name === "apollo_search_people") {
          const { query } = args;

          if (!process.env.APOLLO_API_KEY) {
            res.writeHead(500, { "Content-Type": "application/json" });
            res.end(
              JSON.stringify({
                error: "APOLLO_API_KEY not configured",
              })
            );
            return;
          }

          const apolloRes = await axios.post(
            "https://api.apollo.io/v1/mixed_people/search",
            { q_keywords: query },
            {
              headers: {
                "Content-Type": "application/json",
                "x-api-key": process.env.APOLLO_API_KEY,
              },
            }
          );

          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(
            JSON.stringify({
              result: apolloRes.data,
            })
          );
        } else {
          res.writeHead(404, { "Content-Type": "application/json" });
          res.end(
            JSON.stringify({
              error: `Tool not found: ${tool_name}`,
            })
          );
        }
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            error: errorMessage,
          })
        );
      }
    });
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

  // 404 for unknown endpoints
  res.writeHead(404, { "Content-Type": "application/json" });
  res.end(
    JSON.stringify({
      error: "Not found",
      availableEndpoints: [
        "GET /",
        "GET /mcp",
        "GET /tools",
        "POST /call-tool",
      ],
    })
  );
});

// ---------- START SERVERS ----------
async function main() {
  const port = process.env.PORT || 8080;

  // Start HTTP server for Railway/LangSmith
  httpServer.listen(port, () => {
    console.log(`Apollo MCP HTTP server listening on port ${port}`);
    console.log(`Health check: http://localhost:${port}/`);
    console.log(`Tools endpoint: http://localhost:${port}/tools`);
    console.log(`MCP info: http://localhost:${port}/mcp`);
  });

  // Start MCP server on stdio (for local testing)
  const transport = new StdioServerTransport();
  await mcpServer.connect(transport);
  console.log("Apollo MCP stdio transport started");
}

main().catch((err) => {
  console.error("Failed to start Apollo MCP server:", err);
  process.exit(1);
});