import { createAzure } from "@ai-sdk/azure";
import { createGroq } from "@ai-sdk/groq";

export const azureEmbeddings = createAzure({
  apiKey: process.env.AZURE_API_KEY || "",
  baseURL: process.env.AZURE_ENDPOINT || "",
  apiVersion: process.env.AZURE_API_VERSION,
  resourceName: "text-embedding-3-small",
  useDeploymentBasedUrls: true,
});

export const groq = createGroq({
  apiKey: process.env.GROQ_API_KEY,
});
