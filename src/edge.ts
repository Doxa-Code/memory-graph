import crypto from "crypto";

namespace Edge {
  export interface Props {
    id: string;
    sessionId: string;
    from: string;
    to: string;
    label: string;
    fact: string;
    invalid: boolean;
    embedding: number[];
    createdAt: Date;
  }

  export interface CreateProps {
    sessionId: string;
    from: string;
    to: string;
    label: string;
    fact: string;
    embedding: number[];
  }
}

export class Edge {
  id: string;
  sessionId: string;
  from: string;
  to: string;
  label: string;
  fact: string;
  invalid: boolean;
  embedding: number[];
  createdAt: Date;

  constructor(props: Edge.Props) {
    this.id = props.id;
    this.sessionId = props.sessionId;
    this.from = props.from;
    this.to = props.to;
    this.label = props.label;
    this.fact = props.fact;
    this.invalid = props.invalid;
    this.embedding = props.embedding;
    this.createdAt = props.createdAt;
  }

  invalidate() {
    this.invalid = true;
  }

  static instance(props: Edge.Props) {
    return new Edge(props);
  }

  static create(props: Edge.CreateProps) {
    return new Edge({
      id: crypto.randomUUID().toString(),
      sessionId: props.sessionId,
      from: props.from,
      to: props.to,
      label: props.label,
      fact: props.fact,
      embedding: props.embedding,
      invalid: false,
      createdAt: new Date(),
    });
  }
}
