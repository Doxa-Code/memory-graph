export namespace Message {
  export type Role = "user" | "assistant";

  export interface Props {
    id: string;
    content: string;
    role: Role;
  }
}

export class Message {
  id: string;
  content: string;
  role: Message.Role;

  constructor(props: Message.Props) {
    this.id = props.id;
    this.content = props.content;
    this.role = props.role;
  }

  static instance(props: Message.Props) {
    return new Message(props);
  }

  static create(role: Message.Role, content: string) {
    return new Message({
      id: crypto.randomUUID().toString(),
      role,
      content,
    });
  }
}
