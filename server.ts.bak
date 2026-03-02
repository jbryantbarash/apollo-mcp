import "dotenv/config";
import axios from "axios";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

const server = new Server(
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
server.setRequestHandler(ListToolsRequestSchema, async () => {
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
server.setRequestHandler(CallToolRequestSchema, async (request) => {
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

// ---------- START SERVER ----------
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.log("Apollo MCP server started successfully");
}

main().catch((err) => {
  console.error("Failed to start Apollo MCP server:", err);
  process.exit(1);
});