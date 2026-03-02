import "dotenv/config";
import axios from "axios";
import http from "http";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
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

// Tool schema
const ApolloSearchSchema = z.object({
  query: z.string().describe("Search query for people"),
});

// List tools
mcpServer.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "apollo_search_people",
        description:
          "Search Apollo for people, decision makers, and emails. Use this to find contacts at companies.",
        inputSchema: {
          type: "object",
          properties: {
            query: {
              type: "string",
              description:
                "Search query (e.g., 'VP of Marketing at Stripe', 'CTO at Datadog')",
            },
          },
          required: ["query"],
        },
      },
    ],
  };
});

// Call tool
mcpServer.setRequestHandler(CallToolRequestSchema, async (request) => {
  if (request.params.name === "apollo_search_people") {
    try {
      const { query } = ApolloSearchSchema.parse(request.params.arguments);

      if (!process.env.APOLLO_API_KEY) {
        return {
          content: [
            {
              type: "text",
              text: "Error: APOLLO_API_KEY environment variable not set",
            },
          ],
          isError: true,
        };
      }

      const response = await axios.post(
        "https://api.apollo.io/v1/mixed_people/search",
        { q_keywords: query },
        {
          headers: {
            "Content-Type": "application/json",
            "x-api-key": process.env.APOLLO_API_KEY,
          },
        }
      );

      const result = JSON.stringify(response.data, null, 2).slice(0, 8000);

      return {
        content: [
          {
            type: "text",
            text: result,
          },
        ],
      };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : String(error);
      return {
        content: [
          {
            type: "text",
            text: `Error: ${message}`,
          },
        ],
        isError: true,
      };
    }
  }

  throw new Error(`Unknown tool: ${request.params.name}`);
});

// HTTP Server with SSE support
const httpServer = http.createServer((req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization"
  );

  if (req.method === "OPTIONS") {
    res.writeHead(200);
    res.end();
    return;
  }

  // Health endpoint
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

  // SSE endpoint for MCP
  if (req.url === "/sse" && req.method === "POST") {
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    });

    let requestBody = "";

    req.on("data", (chunk) => {
      requestBody += chunk.toString();
    });

    req.on("end", async () => {
      try {
        const parsed = JSON.parse(requestBody);

        // Handle different MCP request types
        if (parsed.jsonrpc === "2.0") {
          let response: any = {
            jsonrpc: "2.0",
            id: parsed.id,
          };

          try {
            if (parsed.method === "tools/list") {
              response.result = {
                tools: [
                  {
                    name: "apollo_search_people",
                    description:
                      "Search Apollo for people, decision makers, and emails",
                    inputSchema: {
                      type: "object",
                      properties: {
                        query: {
                          type: "string",
                          description: "Search query for people",
                        },
                      },
                      required: ["query"],
                    },
                  },
                ],
              };
            } else if (parsed.method === "tools/call") {
              const { name, arguments: args } = parsed.params;

              if (name === "apollo_search_people") {
                if (!process.env.APOLLO_API_KEY) {
                  response.error = {
                    code: -32603,
                    message: "APOLLO_API_KEY not configured",
                  };
                } else {
                  try {
                    const apolloRes = await axios.post(
                      "https://api.apollo.io/v1/mixed_people/search",
                      { q_keywords: args.query },
                      {
                        headers: {
                          "Content-Type": "application/json",
                          "x-api-key": process.env.APOLLO_API_KEY,
                        },
                      }
                    );

                    response.result = {
                      content: [
                        {
                          type: "text",
                          text: JSON.stringify(apolloRes.data, null, 2).slice(
                            0,
                            8000
                          ),
                        },
                      ],
                    };
                  } catch (err) {
                    response.error = {
                      code: -32603,
                      message:
                        err instanceof Error ? err.message : String(err),
                    };
                  }
                }
              } else {
                response.error = {
                  code: -32601,
                  message: `Tool not found: ${name}`,
                };
              }
            } else {
              response.error = {
                code: -32601,
                message: `Method not found: ${parsed.method}`,
              };
            }
          } catch (err) {
            response.error = {
              code: -32603,
              message: err instanceof Error ? err.message : String(err),
            };
          }

          res.write(`data: ${JSON.stringify(response)}\n\n`);
        }
      } catch (err) {
        res.write(
          `data: ${JSON.stringify({
            jsonrpc: "2.0",
            error: {
              code: -32700,
              message: "Parse error",
            },
          })}\n\n`
        );
      }

      res.end();
    });
    return;
  }

  // Tools endpoint (simple JSON)
  if (req.url === "/tools" && req.method === "GET") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        tools: [
          {
            name: "apollo_search_people",
            description:
              "Search Apollo for people, decision makers, and emails",
            inputSchema: {
              type: "object",
              properties: {
                query: {
                  type: "string",
                  description: "Search query for people",
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

  // Info endpoint
  if (req.url === "/mcp" && req.method === "GET") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        name: "apollo-mcp",
        version: "1.0.0",
        description: "Apollo MCP server for lead research and contact discovery",
      })
    );
    return;
  }

  // 404
  res.writeHead(404, { "Content-Type": "application/json" });
  res.end(
    JSON.stringify({
      error: "Not found",
    })
  );
});

// Start server
const port = process.env.PORT || 8080;
httpServer.listen(port, () => {
  console.log(`Apollo MCP server listening on port ${port}`);
  console.log(`Available endpoints:`);
  console.log(`  - Health: GET http://localhost:${port}/`);
  console.log(`  - Tools: GET http://localhost:${port}/tools`);
  console.log(`  - MCP SSE: POST http://localhost:${port}/sse`);
  console.log(`  - Info: GET http://localhost:${port}/mcp`);
});