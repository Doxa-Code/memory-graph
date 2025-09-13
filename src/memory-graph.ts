import { groq } from "@ai-sdk/groq";
import { cosineSimilarity, generateObject } from "ai";
import { desc, eq, inArray } from "drizzle-orm";
import fs from "fs";
import z from "zod";
import crypto from "crypto";
import { azureEmbeddings } from "./ai";
import { createDatabaseConnection } from "./database";
import {
  edges as edgesTable,
  episodeEdges as episodeEdgesTable,
  episodes as episodesTable,
  nodes as nodesTable,
} from "./database/schemas";
import { resolve } from "path";
import { Message } from "./message";
import { Graph } from "./graph";
import { Node } from "./node";
import { Edge } from "./edge";

export class MemoryGraph {
  private static extractorPrompt = fs.readFileSync(
    resolve("src/prompts/extractor-prompt.md"),
    "utf-8"
  );
  private static SIMILARITY_THRESHOLD = 0.7;

  constructor(private readonly sessionId: string) {}

  private async extractResources(message: Message) {
    try {
      const extraction = await generateObject({
        model: groq("openai/gpt-oss-120b"),
        messages: [
          { role: "system", content: MemoryGraph.extractorPrompt },
          {
            role: message.role,
            content: `${message.role}: ${message.content}`,
          },
        ],
        providerOptions: { groq: { structuredOutput: true } },
        schema: z.object({
          entities: z.array(
            z.object({
              id: z.string(),
              name: z.string(),
              type: z.string(),
              summary: z.string(),
              properties: z.record(z.string(), z.any()),
            })
          ),
          relationships: z.array(
            z.object({
              from: z.string(),
              to: z.string(),
              type: z.string(),
              fact: z.string(),
              episode: z.string(),
            })
          ),
        }),
      });
      return extraction.object.entities.length ||
        extraction.object.relationships.length
        ? extraction.object
        : null;
    } catch (err) {
      console.error("Erro ao extrair recursos:", err);
      return null;
    }
  }

  private async embedText(text: string): Promise<number[]> {
    try {
      const result = await azureEmbeddings
        .textEmbeddingModel("text-embedding-3-small")
        .doEmbed({ values: [text] });
      return result.embeddings[0] as unknown as number[];
    } catch (err) {
      console.error("Erro ao gerar embedding:", err);
      return [];
    }
  }

  private async loadGraph(
    sessionOnly = true,
    nodeIds?: string[],
    edgeIds?: string[]
  ) {
    const db = createDatabaseConnection();
    const graph = Graph.create();

    const nodeQuery = db
      .select({
        id: nodesTable.id,
        type: nodesTable.type,
        sessionId: nodesTable.sessionId,
        label: nodesTable.label,
        embedding: nodesTable.embedding,
        summary: nodesTable.summary,
        properties: nodesTable.properties,
      })
      .from(nodesTable);

    if (sessionOnly) nodeQuery.where(eq(nodesTable.sessionId, this.sessionId));
    if (nodeIds?.length) nodeQuery.where(inArray(nodesTable.id, nodeIds));

    const allNodes = await nodeQuery;
    for (const node of allNodes) {
      graph.addNode(
        Node.instance({
          ...node,
          properties: node.properties as Record<string, any>,
        })
      );
    }

    const edgeQuery = db
      .select({
        id: edgesTable.id,
        from: edgesTable.from,
        to: edgesTable.to,
        label: edgesTable.label,
        fact: edgesTable.fact,
        sessionId: edgesTable.sessionId,
        embedding: edgesTable.embedding,
        invalid: edgesTable.invalid,
        createdAt: edgesTable.createdAt,
      })
      .from(edgesTable);

    if (sessionOnly) edgeQuery.where(eq(edgesTable.sessionId, this.sessionId));
    if (edgeIds?.length) edgeQuery.where(inArray(edgesTable.id, edgeIds));

    const allEdges = await edgeQuery;
    for (const edge of allEdges) {
      graph.addEdge(Edge.instance(edge));
    }

    return graph;
  }

  private async saveGraph(graph: Graph) {
    const db = createDatabaseConnection();
    await db.transaction(async (tx) => {
      await Promise.all(
        graph.getAllNodes().map((node) =>
          tx
            .insert(nodesTable)
            .values({
              id: node.id,
              type: node.type,
              sessionId: node.sessionId,
              label: node.label,
              embedding: node.embedding,
              properties: node.properties,
              summary: node.summary,
            })
            .onConflictDoUpdate({
              target: nodesTable.id,
              set: {
                type: node.type,
                sessionId: node.sessionId,
                label: node.label,
                embedding: node.embedding,
                properties: node.properties,
                summary: node.summary,
              },
            })
        )
      );

      await Promise.all(
        graph.edges.map((edge) =>
          tx
            .insert(edgesTable)
            .values({
              id: edge.id,
              from: edge.from,
              to: edge.to,
              label: edge.label,
              fact: edge.fact,
              sessionId: edge.sessionId,
              embedding: edge.embedding,
              invalid: edge.invalid,
              createdAt: edge.createdAt,
            })
            .onConflictDoUpdate({
              target: edgesTable.id,
              set: {
                from: edge.from,
                to: edge.to,
                label: edge.label,
                fact: edge.fact,
                sessionId: edge.sessionId,
                embedding: edge.embedding,
                invalid: edge.invalid,
                createdAt: edge.createdAt,
              },
            })
        )
      );
    });
  }

  async addMessage(message: Message) {
    const history = await this.getHistory(10);
    const episodeId = await this.saveEpisode(message);

    const historyText = history
      .map((h) => `${h.role}: ${h.message}`)
      .join("\n");

    const extraction = await this.extractResources(
      Message.create(message.role, `${historyText}\n${message.content}`)
    );

    if (!extraction) return;
    const graph = await this.loadGraph();

    for (const entity of extraction.entities) {
      const nodeText = `${entity.summary} ${JSON.stringify(entity.properties)}`;
      const nodeEmbedding = await this.embedText(nodeText);

      let existingNode = graph.getNode(entity.id);

      if (existingNode) {
        existingNode.label = entity.name;
        existingNode.type = entity.type;
        existingNode.embedding = nodeEmbedding;
        existingNode.properties = entity.properties;
        existingNode.summary = entity.summary;
      } else {
        const node = Node.create(
          entity.type,
          this.sessionId,
          entity.name,
          nodeEmbedding,
          entity.id
        );
        graph.addNode(node);
      }
    }

    for (const rel of extraction.relationships) {
      let fromNode =
        graph.getNode(rel.from) ||
        Node.create("unknown", this.sessionId, rel.from, undefined, rel.from);
      graph.addNode(fromNode);

      let toNode =
        graph.getNode(rel.to) ||
        Node.create("unknown", this.sessionId, rel.to, undefined, rel.to);
      graph.addNode(toNode);

      const edgeEmbedding = await this.embedText(rel.fact);
      const edge = Edge.create({
        sessionId: this.sessionId,
        from: fromNode.id,
        to: toNode.id,
        label: rel.type,
        fact: rel.fact,
        embedding: edgeEmbedding,
      });

      for (const existingEdge of graph.edges) {
        if (!existingEdge.embedding || existingEdge.invalid) continue;
        if (
          cosineSimilarity(existingEdge.embedding, edgeEmbedding) >
          MemoryGraph.SIMILARITY_THRESHOLD
        ) {
          existingEdge.invalidate();
        }
      }

      graph.addEdge(edge);

      await this.saveGraph(graph);

      const db = createDatabaseConnection();
      await db.insert(episodeEdgesTable).values({
        id: crypto.randomUUID(),
        episodeId,
        edgeId: edge.id,
      });
    }
  }

  async search(query: string, topK = 10) {
    const queryEmbedding = await this.embedText(query);
    const db = createDatabaseConnection();

    // Busca todos edges do sessionId
    const edges = await db
      .select({
        id: edgesTable.id,
        from: edgesTable.from,
        to: edgesTable.to,
        label: edgesTable.label,
        fact: edgesTable.fact,
        sessionId: edgesTable.sessionId,
        embedding: edgesTable.embedding,
        invalid: edgesTable.invalid,
        createdAt: edgesTable.createdAt, // assume que tenha timestamp
      })
      .from(edgesTable)
      .where(eq(edgesTable.sessionId, this.sessionId));

    // Calcula similaridade e pega os topK
    const scoredEdges = edges
      .filter((e) => e.embedding && !e.invalid)
      .map((e) => ({
        edge: Edge.instance(e),
        score: cosineSimilarity(queryEmbedding, e.embedding),
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);

    if (!scoredEdges.length) return { result: "", nodes: [] };

    // Carrega nodes relacionados
    const nodeIds = Array.from(
      new Set(scoredEdges.flatMap((se) => [se.edge.from, se.edge.to]))
    );
    const graph = await this.loadGraph(false, nodeIds);

    // Mapa de nodes para entidades
    const entitiesMap = new Map<string, Node>();
    for (const nodeId of nodeIds) {
      const node = graph.getNode(nodeId);
      if (node) entitiesMap.set(nodeId, node);
    }

    // Monta a lista de FACTS
    const facts = scoredEdges.map((se) => {
      const dateRange = se.edge.createdAt
        ? `${se.edge.createdAt.toISOString()} - present`
        : "date unknown - present";
      return `- ${se.edge.fact} (Date range: ${dateRange})`;
    });

    // Monta a lista de ENTITIES
    const entities = Array.from(entitiesMap.values()).map((node) => {
      const attrs = node.properties
        ? Object.entries(node.properties)
            .map(([k, v]) => `  ${k}: ${v}`)
            .join("\n")
        : "";
      return [
        `- Name: ${node.label || node.id}`,
        attrs ? `  Attributes:\n${attrs}` : "",
        `  Summary: ${node.summary || node.label || node.id}`,
      ]
        .filter(Boolean)
        .join("\n");
    });

    // Formata saída
    const resultMarkdown = [
      "# These are the most relevant facts and their valid date ranges",
      "<FACTS>",
      facts.join("\n"),
      "</FACTS>",
      "",
      "# These are the most relevant entities",
      "<ENTITIES>",
      entities.join("\n"),
      "</ENTITIES>",
    ].join("\n");

    return {
      result: resultMarkdown,
      facts,
      entities: Array.from(entitiesMap.values()),
    };
  }

  private async saveEpisode(message: Message) {
    const db = createDatabaseConnection();
    const episodeId = crypto.randomUUID();

    await db.insert(episodesTable).values({
      id: episodeId,
      sessionId: this.sessionId,
      message: message.content,
      role: message.role,
    });

    return episodeId;
  }

  private async getHistory(limit = 10) {
    const db = createDatabaseConnection();
    const rows = await db
      .select({
        id: episodesTable.id,
        message: episodesTable.message,
        role: episodesTable.role,
        createdAt: episodesTable.createdAt,
      })
      .from(episodesTable)
      .where(eq(episodesTable.sessionId, this.sessionId))
      .orderBy(desc(episodesTable.createdAt))
      .limit(limit);

    return rows.reverse();
  }

  static start(sessionId?: string) {
    return new MemoryGraph(sessionId || crypto.randomUUID().toString());
  }
}
