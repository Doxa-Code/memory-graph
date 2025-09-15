export namespace Episode {
  export type Type = "message" | "json" | "text";

  export interface Props {
    id: string;
    name: string;
    groupId: string;
    labels: string[];
    type: Type;
    content: string;
    description: string;
    createdAt: Date;
  }

  export interface CreateProps {
    name: string;
    groupId?: string;
    labels?: string[];
    type?: Type;
    content: string;
    description: string;
  }
}

export class Episode {
  public id: string;
  public name: string;
  public groupId: string;
  public labels: string[];
  public type: Episode.Type;
  public content: string;
  public description: string;
  public createdAt: Date;

  constructor(props: Episode.Props) {
    this.id = props.id;
    this.name = props.name;
    this.groupId = props.groupId;
    this.labels = props.labels;
    this.type = props.type;
    this.content = props.content;
    this.description = props.description;
    this.createdAt = props.createdAt;
  }

  static instance(props: Episode.Props) {
    return new Episode(props);
  }

  static create(props: Episode.CreateProps) {
    return new Episode({
      id: crypto.randomUUID().toString(),
      content: props.content,
      createdAt: new Date(),
      description: props.description,
      groupId: props.groupId ?? "",
      labels: props.labels ?? [],
      name: props.name,
      type: props.type ?? "text",
    });
  }
}
