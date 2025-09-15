import { createAzure } from "@ai-sdk/azure";
import { createGroq } from "@ai-sdk/groq";
import { generateObject, type ModelMessage } from "ai";

export const azureEmbeddings = createAzure({
  apiKey: process.env.AZURE_API_KEY || "",
  baseURL: process.env.AZURE_ENDPOINT || "",
  apiVersion: process.env.AZURE_API_VERSION,
  resourceName: "text-embedding-3-small",
  useDeploymentBasedUrls: true,
});

export const azure = createAzure({
  apiKey: process.env.AZURE_API_KEY,
  baseURL: process.env.AZURE_ENDPOINT,
});

export abstract class AI<R> {
  async llmExecution<T>(
    messages: ModelMessage[],
    outputSchema: any
  ): Promise<T> {
    const response = await generateObject({
      model: azure("gpt-4.1"),
      messages,
      providerOptions: { groq: { structuredOutput: true } },
      schema: outputSchema,
    });

    return response.object;
  }

  abstract execute(input: any): Promise<R>;
}
