export namespace Node {
  export interface Props {
    id: string;
    name: string;
    groupId: string;
    summary: string;
    labels: string[];
    createdAt: Date;
    embedding: number[];
  }

  export interface CreateProps {
    name: string;
    groupId: string;
    summary?: string;
    labels?: string[];
  }
}

export class Node {
  public id: string;
  public name: string;
  public groupId: string;
  public labels: string[];
  public summary: string;
  public createdAt: Date;
  public embedding: number[];

  constructor(props: Node.Props) {
    this.id = props.id;
    this.name = props.name;
    this.groupId = props.groupId;
    this.labels = props.labels;
    this.createdAt = props.createdAt;
    this.summary = props.summary;
    this.embedding = props.embedding;
  }

  static instance(props: Node.Props) {
    return new Node(props);
  }

  addSummary(summary: string) {
    this.summary = summary;
  }

  setEmbedding(embedding: number[]) {
    this.embedding = embedding;
  }

  static create(props: Node.CreateProps) {
    return new Node({
      id: crypto.randomUUID().toString(),
      createdAt: new Date(),
      groupId: props.groupId ?? "",
      labels: props.labels ?? [],
      name: props.name,
      summary: props.summary ?? "",
      embedding: [],
    });
  }
}
