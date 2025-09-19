import crypto from "crypto";
import { and, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { azureEmbeddings } from "./ai";
import { EdgeExtractor } from "./ai/edges";
import { NodeAttributesExtractor, NodeExtractor } from "./ai/nodes";
import { createDatabaseConnection } from "./database";
import {
  edges as edgesTable,
  episodes as episodesTable,
  nodes as nodesTable,
} from "./database/schemas";
import { Edge } from "./edge";
import { Episode } from "./episode";
import { Node } from "./node";

export class MemoryGraph {
  constructor(private readonly groupId: string) {}

  private async embedTexts(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) {
      return [];
    }
    try {
      const result = await azureEmbeddings
        .textEmbeddingModel("text-embedding-3-small")
        .doEmbed({ values: texts });
      return result.embeddings as unknown as number[][];
    } catch (err) {
      console.error("Erro ao gerar embeddings:", err);
      return texts.map(() => [0]);
    }
  }

  private async saveGraphData(nodes: Node[], edges: Edge[]) {
    const db = createDatabaseConnection();
    await db.transaction(async (tx) => {
      if (nodes.length > 0) {
        await tx
          .insert(nodesTable)
          .values(nodes)
          .onConflictDoUpdate({
            target: nodesTable.id,
            set: {
              name: sql`excluded.name`,
              groupId: sql`excluded.group_id`,
              summary: sql`excluded.summary`,
              labels: sql`excluded.labels`,
              embedding: sql`excluded.embedding`,
            },
          });
      }

      if (edges.length > 0) {
        await tx
          .insert(edgesTable)
          .values(edges)
          .onConflictDoUpdate({
            target: edgesTable.id,
            set: {
              sourceId: sql`excluded.source_id`,
              targetId: sql`excluded.target_id`,
              label: sql`excluded.label`,
              fact: sql`excluded.fact`,
              episodes: sql`excluded.episodes`,
              invalidAt: sql`excluded.invalid_at`,
              embedding: sql`excluded.embedding`,
            },
          });
      }
    });
  }

  private async getHistory(limit = 10): Promise<Episode[]> {
    const db = createDatabaseConnection();
    const rows = await db
      .select()
      .from(episodesTable)
      .where(eq(episodesTable.groupId, this.groupId))
      .orderBy(desc(episodesTable.createdAt))
      .limit(limit);

    return rows.reverse().map((episode) =>
      Episode.instance({
        ...episode,
        groupId: episode.groupId ?? "",
        labels: episode.labels ?? [],
      })
    );
  }

  private async findNodesByNames(names: string[]): Promise<Node[]> {
    if (names.length === 0) {
      return [];
    }
    const db = createDatabaseConnection();
    const rows = await db
      .select()
      .from(nodesTable)
      .where(
        and(
          eq(nodesTable.groupId, this.groupId),
          inArray(nodesTable.name, names)
        )
      );

    return rows.map((row) => Node.instance(row as Node.Props));
  }

  private async processEpisode(episode: Episode) {
    const history = await this.getHistory(10);

    const extractedNodes = await NodeExtractor.instance().execute({
      episode,
      history,
    });

    const extractedNodeNames = extractedNodes.map((n) => n.name);
    const existingNodes = await this.findNodesByNames(extractedNodeNames);
    const existingNodesMap = new Map(existingNodes.map((n) => [n.name, n]));

    const nodeMap = new Map<string, Node>();
    const uniqueNodes: Node[] = [];
    const processedNames = new Set<string>();

    extractedNodes.map((extractedNode) => {
      if (processedNames.has(extractedNode.name)) {
        const finalNode = uniqueNodes.find(
          (n) => n.name === extractedNode.name
        )!;
        nodeMap.set(extractedNode.id, finalNode);
        return;
      }

      const existingNode = existingNodesMap.get(extractedNode.name);
      if (existingNode) {
        nodeMap.set(extractedNode.id, existingNode);
        uniqueNodes.push(existingNode);
      } else {
        const newNode = Node.create({
          name: extractedNode.name,
          groupId: this.groupId,
          labels: extractedNode.labels,
          summary: extractedNode.summary,
        });
        nodeMap.set(extractedNode.id, newNode);
        uniqueNodes.push(newNode);
      }
      processedNames.add(extractedNode.name);
    });

    const [extractedEdges, updatedNodes] = await Promise.all([
      EdgeExtractor.instance().execute({
        episode,
        history,
        extractedNodes,
      }),
      NodeAttributesExtractor.instance().execute({
        episode,
        history,
        nodes: uniqueNodes,
      }),
    ]);

    const finalEdges = extractedEdges
      .map((edge) => {
        const sourceNode = nodeMap.get(edge.sourceId);
        const targetNode = nodeMap.get(edge.targetId);

        if (!sourceNode || !targetNode) {
          console.warn(
            `Could not find nodes for edge: ${edge.id}. Source: ${edge.sourceId}, Target: ${edge.targetId}. Skipping edge.`
          );
          return null;
        }

        return Edge.create({
          ...edge,
          sourceId: sourceNode.id,
          targetId: targetNode.id,
          episodes: [episode.id],
        });
      })
      .filter((e): e is Edge => e !== null);

    const edgeFacts = finalEdges.map((e) => e.fact);
    const nodeNames = updatedNodes.map((n) => n.name);

    const [edgeEmbeddings, nodeEmbeddings] = await Promise.all([
      this.embedTexts(edgeFacts),
      this.embedTexts(nodeNames),
    ]);

    finalEdges.forEach((edge, i) => {
      if (edgeEmbeddings[i]) {
        edge.setEmbedding(edgeEmbeddings[i]);
      }
    });

    updatedNodes.forEach((node, i) => {
      if (nodeEmbeddings[i]) {
        node.setEmbedding(nodeEmbeddings[i]);
      }
    });

    await this.saveGraphData(updatedNodes, finalEdges);
  }

  async addEpisode(episodeCreateProps: Episode.CreateProps) {
    const episode = Episode.create(episodeCreateProps);
    const db = createDatabaseConnection();

    await db
      .insert(episodesTable)
      .values(episode)
      .onConflictDoUpdate({
        target: episodesTable.id,
        set: {
          content: episode.content,
          createdAt: episode.createdAt,
          description: episode.description,
          groupId: episode.groupId,
          labels: episode.labels,
          name: episode.name,
          type: episode.type,
        },
      });

    (async () => {
      try {
        await this.processEpisode(episode);
      } catch (error) {
        console.error("Error processing episode in background:", error);
      }
    })();
  }

  async search(query: string, topK = 10) {
    const queryEmbedding = await this.embedTexts([query]);
    const history = await this.getHistory(3);
    const orderedHistory = history;
    const db = createDatabaseConnection();

    const edgesRaw = await db
      .select()
      .from(edgesTable)
      .where(
        and(
          eq(edgesTable.groupId, this.groupId),
          sql`embedding <> ${JSON.stringify(queryEmbedding[0], null, 2)}`,
          isNull(edgesTable.invalidAt)
        )
      )
      .limit(topK);

    const nodesRaw = await db
      .select()
      .from(nodesTable)
      .where(
        and(
          eq(nodesTable.groupId, this.groupId),
          sql`embedding <> ${JSON.stringify(queryEmbedding[0], null, 2)}`
        )
      )
      .limit(topK);

    const nodes = nodesRaw.map((n) =>
      Node.instance({
        ...n,
        embedding: n.embedding || [],
      })
    );
    const edges = edgesRaw.map((e) => Edge.instance(e));

    const facts = edges.map((se) => {
      const dateRange = se.validAt
        ? `${se.validAt.toISOString()} - present`
        : "date unknown - present";
      return `- ${se.fact} (Date range: ${dateRange})`;
    });

    const entities = nodes.map((node) => {
      return [`- Name: ${node.name || node.id}`, `- Summary: ${node.summary}`]
        .filter(Boolean)
        .join("\n");
    });

    return {
      result: [
        "# Relevant entities",
        "<ENTITIES>",
        entities.map((entity) => `<ENTITY>\n${entity}\n</ENTITY>`).join("\n"),
        "</ENTITIES>",
        "",
        "# Relevant facts",
        "<FACTS>",
        facts.join("\n"),
        "</FACTS>",
        "",
        "# Recent conversation history",
        "<HISTORY>",
        orderedHistory.map((h) => h.content).join("\n"),
        "</HISTORY>",
      ].join("\n"),
    };
  }

  static start(sessionId?: string) {
    return new MemoryGraph(sessionId || crypto.randomUUID().toString());
  }
}
