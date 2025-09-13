import type { Edge } from "./edge";
import type { Node } from "./node";

export class Graph {
  nodes: Map<string, Node> = new Map();
  edges: Edge[] = [];

  addNode(node: Node) {
    if (!this.nodes.has(node.id)) {
      this.nodes.set(node.id, node);
    }
  }

  addEdge(edge: Edge) {
    this.edges.push(edge);
  }

  getNode(id: string) {
    return this.nodes.get(id);
  }

  getAllNodes() {
    return Array.from(this.nodes.values());
  }

  getConnectedNodes(nodeId: string) {
    return this.edges
      .filter((e) => e.from === nodeId || e.to === nodeId)
      .map((e) =>
        e.from === nodeId ? this.getNode(e.to) : this.getNode(e.from)
      )
      .filter((n): n is Node => !!n);
  }

  getEdgesFromNode(nodeId: string) {
    return this.edges.filter((e) => e.from === nodeId || e.to === nodeId);
  }

  static create() {
    return new Graph();
  }
}
