#!/usr/bin/env bun

import { serve } from "bun";
import { readFileSync } from "fs";
import { resolve } from "path";
import { createDatabaseConnection } from "./database";
import { MemoryGraph } from "./memory-graph";
import { eq } from "drizzle-orm";
import ejs from "ejs";
import { edges, nodes } from "./database/schemas";
import { Edge } from "./edge";
import type { Episode } from "./episode";
import { Node } from "./node";

const viewsPath = resolve("src/views");

async function getGraph(groupId: string) {
  const db = createDatabaseConnection();

  const nodesRaw = await db
    .select()
    .from(nodes)
    .where(eq(nodes.groupId, groupId));
  const edgesRaw = await db
    .select()
    .from(edges)
    .where(eq(edges.groupId, groupId));

  return {
    edges: edgesRaw.map(Edge.instance),
    nodes: nodesRaw.map(Node.instance),
  };
}

serve({
  port: 5000,
  async fetch(req) {
    const url = new URL(req.url);

    if (url.pathname === "/messages" && req.method === "POST") {
      const body = await req.json();
      const episodeBody = body as {
        name: string;
        groupId: string;
        labels?: string[];
        type?: Episode.Type;
        content: string;
        description: string;
      };

      if (
        !episodeBody.name ||
        !episodeBody.groupId ||
        !episodeBody.content ||
        !episodeBody.description
      ) {
        return new Response(
          JSON.stringify({
            error: "Campos obrigatórios faltantes",
          }),
          { status: 400 }
        );
      }

      const memoryGraph = MemoryGraph.start(episodeBody.groupId);

      await memoryGraph.addEpisode(episodeBody);

      return new Response(JSON.stringify({ success: true }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    if (url.pathname === "/search" && req.method === "GET") {
      const query = url.searchParams.get("q");
      const groupId = url.searchParams.get("groupId");
      if (!query || !groupId) {
        return new Response(
          JSON.stringify({
            error: "Query param 'q' e groupId são obrigatórios",
          }),
          { status: 400 }
        );
      }
      const memoryGraph = MemoryGraph.start(groupId);

      const results = await memoryGraph.search(query);

      return new Response(JSON.stringify(results), {
        headers: { "Content-Type": "application/json" },
      });
    }

    const groupId = url.searchParams.get("groupId") || "";

    const { nodes, edges } = await getGraph(groupId);

    const template = readFileSync(resolve(viewsPath, "graph.ejs"), "utf-8");

    const html = ejs.render(template, { nodes, edges });

    return new Response(html, {
      headers: { "Content-Type": "text/html" },
    });
  },
});

console.log("🚀 Server rodando em http://localhost:5000");
