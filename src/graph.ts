import crypto from "crypto";

namespace Node {
  export interface Props {
    id: string;
    type: string;
    sessionId: string;
    properties: Record<string, any>;
  }
}

export class Node {
  id: string;
  type: string;
  sessionId: string;
  properties: Record<string, any>;

  constructor(props: Node.Props) {
    this.sessionId = props.sessionId;
    this.id = props.id;
    this.type = props.type;
    this.properties = props.properties;
  }

  static create(
    type: string,
    sessionId: string,
    properties: Record<string, any>
  ) {
    return new Node({
      id: crypto.randomUUID().toString(),
      properties: properties || {},
      sessionId: sessionId || "",
      type: type || "",
    });
  }

  static instance(props: Node.Props) {
    return new Node(props);
  }
}

namespace Edge {
  export interface Props {
    id: string;
    sessionId: string;
    from: string;
    to: string;
    invalid: boolean;
    label: string;
    message: string;
    embedding: number[];
  }
}

export class Edge {
  id: string;
  sessionId: string;
  from: string;
  to: string;
  invalid: boolean;
  label: string;
  message: string;
  embedding: number[];

  constructor(props: Edge.Props) {
    this.id = props.id;
    this.sessionId = props.sessionId;
    this.from = props.from;
    this.to = props.to;
    this.label = props.label;
    this.message = props.message;
    this.invalid = props.invalid;
    this.embedding = props.embedding;
  }

  invalidate() {
    this.invalid = true;
  }

  static create(
    sessionId: string,
    from: string,
    to: string,
    label: string,
    message: string,
    embedding: number[]
  ) {
    return new Edge({
      embedding: embedding || [],
      sessionId: sessionId || "",
      from: from || "",
      id: crypto.randomUUID().toString(),
      invalid: false,
      label: label || "",
      message: message || "",
      to: to || "",
    });
  }
}

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
