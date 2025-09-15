import type { Edge } from "./edge";
import type { Node } from "./node";

export class Graph {
  nodes: Map<string, Node> = new Map();
  edges: Edge[] = [];

  addNode(...nodes: Node[]) {
    for (const node of nodes) {
      if (!this.nodes.has(node.id)) {
        this.nodes.set(node.id, node);
      }
    }
  }

  addEdge(...edges: Edge[]) {
    for (const edge of edges) {
      this.edges.push(edge);
    }
  }

  getNode(id: string) {
    return this.nodes.get(id);
  }

  getAllNodes() {
    return Array.from(this.nodes.values());
  }

  getConnectedNodes(nodeId: string) {
    return this.edges
      .filter((e) => e.sourceId === nodeId || e.targetId === nodeId)
      .map((e) =>
        e.sourceId === nodeId
          ? this.getNode(e.targetId)
          : this.getNode(e.sourceId)
      )
      .filter((n): n is Node => !!n);
  }

  getEdgesFromNode(nodeId: string) {
    return this.edges.filter(
      (e) => e.sourceId === nodeId || e.targetId === nodeId
    );
  }

  static create() {
    return new Graph();
  }
}
