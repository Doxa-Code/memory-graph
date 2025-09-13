import { groq } from "@ai-sdk/groq";
import { cosineSimilarity, generateObject } from "ai";
import { eq } from "drizzle-orm";
import fs from "fs";
import z from "zod";
import { azureEmbeddings } from "./ai";
import { createDatabaseConnection } from "./database";
import { edges as edgesTable, nodes as nodesTable } from "./database/schemas";
import { Edge, Graph, Node } from "./graph";

export namespace MemoryGraph {
  export type Role = "user" | "assistant";
}

export class MemoryGraph {
  private static extractorPrompt = fs.readFileSync(
    "./prompts/extractor-prompt.md",
    "utf-8"
  );
  private static SIMILARITY_THRESHOLD = 0.7;

  constructor(private readonly sessionId: string) {}

  private async extractResources(role: MemoryGraph.Role, message: string) {
    const extraction = await generateObject({
      model: groq("openai/gpt-oss-120b"),
      messages: [
        { role: "system", content: MemoryGraph.extractorPrompt },
        { role, content: message },
      ],
      providerOptions: { groq: { structuredOutput: true } },
      schema: z.object({
        entities: z.array(z.object({ id: z.string(), type: z.string() })),
        fact: z.object({ label: z.string(), message: z.string() }),
      }),
    });

    if (!extraction.object.fact.message) return null;

    const embedding = await this.embedText(extraction.object.fact.message);

    return {
      entities: extraction.object.entities,
      fact: extraction.object.fact,
      embedding,
    };
  }

  private async embedText(text: string): Promise<number[]> {
    const result = await azureEmbeddings
      .textEmbeddingModel("text-embedding-3-small")
      .doEmbed({ values: [text] });
    return result.embeddings[0] as unknown as number[];
  }

  private async loadGraph() {
    const db = createDatabaseConnection();
    const graph = Graph.create();

    const allNodes = await db
      .select()
      .from(nodesTable)
      .where(eq(nodesTable.sessionId, this.sessionId));
    const allEdges = await db
      .select()
      .from(edgesTable)
      .where(eq(edgesTable.sessionId, this.sessionId));

    for (const node of allNodes) {
      graph.addNode(
        Node.instance({
          id: node.id,
          type: node.type,
          sessionId: node.sessionId,
          properties: node.properties as Record<string, any>,
        })
      );
    }

    for (const edge of allEdges) {
      graph.addEdge(
        Edge.create(
          edge.sessionId,
          edge.from,
          edge.to,
          edge.label,
          edge.message,
          edge.embedding ?? []
        )
      );
    }

    return graph;
  }

  private async saveGraph(graph: Graph) {
    const db = createDatabaseConnection();
    await db.transaction(async (tx) => {
      await Promise.all([
        ...graph.getAllNodes().map(async (node) => {
          await tx
            .insert(nodesTable)
            .values({
              id: node.id,
              type: node.type,
              sessionId: node.sessionId,
              properties: node.properties,
            })
            .onConflictDoUpdate({
              set: {
                type: node.type,
                sessionId: node.sessionId,
                properties: node.properties,
              },
              target: nodesTable.id,
            });
        }),
        ...graph.edges.map(async (edge) => {
          await tx
            .insert(edgesTable)
            .values({
              id: edge.id,
              from: edge.from,
              to: edge.to,
              sessionId: edge.sessionId,
              label: edge.label,
              message: edge.message,
              embedding: edge.embedding,
              invalid: edge.invalid,
            })
            .onConflictDoUpdate({
              target: edgesTable.id,
              set: {
                from: edge.from,
                to: edge.to,
                sessionId: edge.sessionId,
                label: edge.label,
                message: edge.message,
                embedding: edge.embedding,
                invalid: edge.invalid,
              },
            });
        }),
      ]);
    });
  }

  async addMessage(role: MemoryGraph.Role, message: string) {
    const extraction = await this.extractResources(role, message);

    if (!extraction) return null;

    const graph = await this.loadGraph();

    const nodeIds = new Map<string, string>();

    for (const entity of extraction.entities) {
      if (!nodeIds.has(entity.id)) {
        const node = Node.create(entity.type, this.sessionId, {
          message,
          actor: role,
          sessionId: this.sessionId,
        });

        graph.addNode(node);

        nodeIds.set(entity.id, node.id);
      }
    }

    const from = nodeIds.get(extraction.entities[0]!.id)!;
    const to =
      extraction.entities.length > 1
        ? nodeIds.get(extraction.entities[1]!.id)!
        : from;

    const newEdge = Edge.create(
      this.sessionId,
      from,
      to,
      extraction.fact.label,
      extraction.fact.message,
      extraction.embedding
    );

    for (const edge of graph.edges) {
      if (!edge.embedding) continue;
      if (
        cosineSimilarity(edge.embedding, newEdge.embedding) >
        MemoryGraph.SIMILARITY_THRESHOLD
      ) {
        edge.invalidate();
      }
    }

    graph.addEdge(newEdge);

    await this.saveGraph(graph);

    return extraction;
  }

  async search(query: string) {
    const graph = await this.loadGraph();
    const queryEmbedding = await this.embedText(query);

    let bestEdge: Edge | null = null;
    let bestSim = -1;

    for (const edge of graph.edges) {
      if (!edge.embedding || edge.invalid) continue;
      const sim = cosineSimilarity(queryEmbedding, edge.embedding);
      if (sim > bestSim) {
        bestSim = sim;
        bestEdge = edge;
      }
    }

    if (!bestEdge) return null;

    const fromNode = graph.getNode(bestEdge.from);
    const toNode = graph.getNode(bestEdge.to);

    if (!fromNode || !toNode) return null;

    const connectedNodes = Array.from(
      new Map(
        [
          ...graph.getConnectedNodes(fromNode.id),
          ...graph.getConnectedNodes(toNode.id),
        ].map((n) => [n.id, n])
      ).values()
    );

    return { edge: bestEdge, connectedNodes };
  }

  static start(sessionId: string) {
    return new MemoryGraph(sessionId || crypto.randomUUID().toString());
  }
}
