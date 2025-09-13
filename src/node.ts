import crypto from "crypto";

namespace Node {
  export interface Props {
    id: string;
    type: string;
    sessionId: string;
    label: string;
    embedding: number[];
    properties: Record<string, any>;
    summary: string;
  }
}

export class Node {
  id: string;
  type: string;
  sessionId: string;
  label: string;
  embedding: number[];
  properties: Record<string, any>;
  summary: string;

  constructor(props: Node.Props) {
    this.id = props.id;
    this.type = props.type;
    this.sessionId = props.sessionId;
    this.label = props.label;
    this.embedding = props.embedding;
    this.properties = props.properties || {};
    this.summary = props.summary;
  }

  static instance(props: Node.Props) {
    return new Node(props);
  }

  static create(
    type: string,
    sessionId: string,
    label: string,
    embedding?: number[],
    id?: string,
    properties?: Record<string, any>,
    summary?: string
  ) {
    return new Node({
      id: id || crypto.randomUUID().toString(),
      type,
      sessionId,
      label,
      embedding: embedding || [],
      properties: properties || {},
      summary: summary || "",
    });
  }
}
