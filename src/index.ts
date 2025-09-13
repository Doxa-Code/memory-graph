import { Graph } from "./graph";
import { MemoryGraph } from "./memory-graph";

const sessionId = "6552cc5c-f901-402d-b9a5-294b0ae999cc";

const memoryGraph = MemoryGraph.start(sessionId);

// --- Adiciona mensagens
// await graphService.addMessage("Oi Fernando, tudo bem?", "assistant");
// await graphService.addMessage("Estou com dor de cabeça", "user");
// await graphService.addMessage("Quero dipirona", "user");
// await graphService.addMessage("Tenho dipirona 1g pode ser?", "assistant");

const result = await memoryGraph.search("remédio");

if (result) {
  console.log("Aresta mais próxima:", result.edge);
  console.log("Nós conectados à primeira camada:", result.connectedNodes);
} else {
  console.log("Nenhuma aresta próxima encontrada.");
}
