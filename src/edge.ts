import crypto from "crypto";

namespace Edge {
  export interface Props {
    id: string;
    groupId: string;
    sourceId: string;
    targetId: string;
    label: string;
    fact: string;
    episodes: string[];
    validAt: Date;
    invalidAt: Date | null;
    embedding: number[];
  }

  export interface CreateProps {
    groupId: string;
    sourceId: string;
    targetId: string;
    label: string;
    fact: string;
    episodes: string[];
    validAt: Date;
    invalidAt: Date | null;
  }
}

export class Edge {
  public id: string;
  public groupId: string;
  public sourceId: string;
  public targetId: string;
  public label: string;
  public fact: string;
  public episodes: string[];
  public validAt: Date;
  public invalidAt: Date | null;
  public embedding: number[];

  constructor(props: Edge.Props) {
    this.id = props.id;
    this.groupId = props.groupId;
    this.sourceId = props.sourceId;
    this.targetId = props.targetId;
    this.label = props.label;
    this.fact = props.fact;
    this.episodes = props.episodes;
    this.validAt = props.validAt;
    this.invalidAt = props.invalidAt;
    this.embedding = props.embedding;
  }

  invalidate() {
    this.invalidAt = new Date();
  }

  setEmbedding(embedding: number[]) {
    this.embedding = embedding;
  }

  static instance(props: Edge.Props) {
    return new Edge(props);
  }

  static create(props: Edge.CreateProps) {
    return new Edge({
      episodes: props.episodes || [],
      fact: props.fact,
      groupId: props.groupId,
      id: crypto.randomUUID().toString(),
      invalidAt: props.invalidAt || null,
      label: props.label,
      sourceId: props.sourceId,
      targetId: props.targetId,
      validAt: props.validAt || new Date(),
      embedding: [],
    });
  }
}
