import { serve } from "bun";
import { Message } from "./message";
import { MemoryGraph } from "./memory-graph";

serve({
  port: 3000,
  async fetch(req) {
    const url = new URL(req.url);

    if (url.pathname === "/messages" && req.method === "POST") {
      const body = await req.json();
      const { role, content, sessionId } = body as {
        role: Message.Role;
        content: string;
        sessionId: string;
      };

      if (!role || !content || !sessionId) {
        return new Response(
          JSON.stringify({
            error: "role, sessionId e content são obrigatórios",
          }),
          { status: 400 }
        );
      }

      const memoryGraph = MemoryGraph.start(sessionId);

      await memoryGraph.addMessage(Message.create(role, content));

      return new Response(JSON.stringify({ success: true }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    if (url.pathname === "/search" && req.method === "GET") {
      const query = url.searchParams.get("q");
      const sessionId = url.searchParams.get("sessionId");
      if (!query || !sessionId) {
        return new Response(
          JSON.stringify({
            error: "Query param 'q' e sessionId são obrigatórios",
          }),
          { status: 400 }
        );
      }
      const memoryGraph = MemoryGraph.start(sessionId);

      const results = await memoryGraph.search(query);

      return new Response(JSON.stringify(results), {
        headers: { "Content-Type": "application/json" },
      });
    }

    return new Response("Not Found", { status: 404 });
  },
});

console.log("🚀 Server rodando em http://localhost:3000");
