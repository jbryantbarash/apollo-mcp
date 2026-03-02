# Apollo MCP Server

A Model Context Protocol (MCP) server for Apollo.io that enables LLM agents to search for and discover business contacts and decision makers.

## Overview

This server connects to the Apollo.io API and exposes a single tool: `apollo_search_people`. It allows LLM-powered agents to:
- Search for specific people/decision makers
- Find contact information (emails, phone numbers)
- Discover prospects at target companies
- Integrate with LangSmith, Claude, or any MCP-compatible framework

## Prerequisites

- **Node.js** 18+ and npm 9+
- **Apollo.io API Key** (get one at https://app.apollo.io/settings/integrations/api)
- **GitHub account** (for pushing to GitHub)
- **Railway account** (free tier available at https://railway.app)

## Local Setup

### 1. Install Dependencies

```bash
npm install
```

This installs:
- MCP SDK
- Axios (for API calls)
- Dotenv (for environment variables)
- Zod (for schema validation)
- TypeScript tooling

### 2. Configure Environment

Create a `.env` file in the root directory:

```bash
cp .env.example .env
```

Then edit `.env` and add your Apollo API key:

```
APOLLO_API_KEY=your_actual_api_key_here
```

### 3. Run Locally (Development)

```bash
npm run dev
```

This starts the server in watch mode. You should see:
```
Apollo MCP server started successfully
```

### 4. Test the Server

In another terminal, test the tool:

```bash
# (Requires an MCP client configured to talk to stdio)
# For now, you can just verify it starts without errors
```

## Deployment to Railway

### Step 1: Initialize Git

If you haven't already, initialize Git in your project directory:

```bash
cd /path/to/apollo-mcp
git init
git add .
git commit -m "Initial Apollo MCP server setup"
```

### Step 2: Create GitHub Repository

1. Go to **https://github.com/new**
2. Create a new repository named `apollo-mcp`
3. **Do NOT** check "Initialize with README" (you already have files)
4. Click **Create repository**

### Step 3: Push to GitHub

```bash
git remote add origin https://github.com/YOUR_USERNAME/apollo-mcp.git
git branch -M main
git push -u origin main
```

**Replace `YOUR_USERNAME`** with your actual GitHub username.

### Step 4: Deploy to Railway

1. Go to **https://railway.app**
2. Click **Login** (or sign up with GitHub)
3. Click **New Project** (top right)
4. Select **Deploy from GitHub**
5. Search for `apollo-mcp` repository
6. Click **Deploy Now**

Railway will:
- Clone your repo
- Install dependencies
- Build the TypeScript
- Start the server automatically
- Assign a public HTTPS URL

### Step 5: Get Your Public URL

1. In Railway dashboard, click your `apollo-mcp` service
2. Look for **Domains** section
3. Copy the auto-generated URL (e.g., `https://apollo-mcp-production.up.railway.app`)

### Step 6: Add Environment Variables to Railway

1. In Railway dashboard, click your service
2. Go to **Variables** tab
3. Add:
   - Key: `APOLLO_API_KEY`
   - Value: `your_actual_apollo_api_key`
4. Railway automatically redeploys when you save

## Connect to LangSmith

Once deployed to Railway:

1. Open your LangSmith agent
2. Go to **Tools** → **Add MCP Server**
3. Fill in:
   - **Name**: `apollo`
   - **URL**: `https://apollo-mcp-production.up.railway.app` (your Railway URL)
   - **Authentication**: None (or Static Headers if needed)
4. Click **Save Server**

LangSmith will now discover and use the `apollo_search_people` tool in your agent.

## Available Tools

### `apollo_search_people`

**Description**: Search Apollo for people, decision makers, and emails.

**Input**:
```json
{
  "query": "VP of Marketing at Stripe"
}
```

**Output**: JSON response from Apollo API containing:
- Person names and titles
- Email addresses
- Phone numbers
- Company information
- LinkedIn profiles
- Seniority levels

**Example Use Cases**:
- "Find the VP of Operations at Snowflake"
- "Search for product managers at Datadog"
- "Get contact info for founders of B2B SaaS startups"

## Troubleshooting

### Server won't start locally
```
Error: APOLLO_API_KEY not set
```
**Fix**: Make sure your `.env` file has `APOLLO_API_KEY` set.

### Railway deployment fails
Check the **Logs** tab in Railway:
- Look for build errors
- Verify TypeScript compiles
- Ensure all dependencies are listed in `package.json`

### LangSmith can't connect to Apollo
- **Verify URL**: Make sure you copied the exact Railway domain (no trailing slash)
- **Check logs**: View Railway logs to see if requests are reaching the server
- **Test in browser**: Visit your Railway URL to confirm it's accessible

### Changes not deploying to Railway
```bash
git add .
git commit -m "Your message"
git push origin main
```

Railway auto-deploys on every GitHub push (usually within 30 seconds).

## Development

### Making Changes

1. Edit `server.ts`
2. Test locally: `npm run dev`
3. Push to GitHub:
   ```bash
   git add .
   git commit -m "Update description"
   git push origin main
   ```
4. Railway auto-deploys

### Adding New Tools

To add a new tool to the MCP server:

1. Add a new schema in `server.ts`:
```typescript
const NewToolSchema = z.object({
  param1: z.string().describe("Description"),
});
```

2. Add it to `ListToolsRequestSchema`:
```typescript
{
  name: "new_tool",
  description: "What it does",
  inputSchema: { ... }
}
```

3. Add handler in `CallToolRequestSchema`:
```typescript
if (request.params.name === "new_tool") {
  const { param1 } = NewToolSchema.parse(request.params.arguments);
  // your implementation
}
```

## Environment Variables Reference

| Variable | Required | Description |
|----------|----------|-------------|
| `APOLLO_API_KEY` | Yes | Your Apollo.io API key |
| `PORT` | No | Server port (Railway sets this automatically) |

## License

MIT

## Support

For issues with Apollo API, visit: https://support.apollo.io
For MCP questions, see: https://modelcontextprotocol.io

---

**Deployed on Railway**: https://railway.app  
**Used by**: LangSmith, Claude Agents, and other MCP-compatible clients
