import z from "zod";
import { AI } from ".";
import type { Episode } from "../episode";
import { Node } from "../node";
import { MAX_REFLEXION_ITERATIONS } from "../constants";

type NodeExtractorInputDTO = {
  episode: Episode;
  history: Episode[];
};

export class NodeExtractor<T> extends AI<T> {
  async execute(input: NodeExtractorInputDTO): Promise<T> {
    let refletionCount = 0;
    let entitiesMissing = true;
    let customPrompt = "";
    const extractedEntities = z
      .array(
        z.object({
          name: z.string().describe("Name of the extracted entity"),
          entityTypeId: z
            .number()
            .describe(
              "ID of the classified entity type. Must be one of the provided entityTypeId integers."
            ),
        })
      )
      .describe("List of extracted entities");
    const outputSchemaNode = z.object({
      extractedEntities: extractedEntities,
    });

    let extractedNodes: z.infer<typeof extractedEntities> = [];
    const contextNode = {
      episodeContent: input.episode.content,
      episodeTimestamp: input.episode.createdAt.toISOString(),
      episodeDescription: input.episode.description,
      history: input.history.map((ep) => ep.content),
      entityTypes: [
        {
          entityTypeId: 0,
          entityTypeName: "Entity",
          entityTypeDescription:
            "Default entity classification. Use this entity type if the entity is not one of the other listed types.",
        },
      ],
    };

    while (entitiesMissing && refletionCount <= MAX_REFLEXION_ITERATIONS) {
      const response = await this.llmExecution<
        z.infer<typeof outputSchemaNode>
      >(
        [
          {
            role: "system",
            content: `
              You are an AI assistant that extracts entity nodes from conversational messages. 
              Your primary task is to extract and classify the speaker and other significant entities mentioned in the conversation.
            `,
          },
          {
            role: "user",
            content: `
          <ENTITY TYPES>
            ${JSON.stringify(contextNode.entityTypes, null, 2)}
          </ENTITY TYPES>

          <PREVIOUS MESSAGES>
            ${contextNode.history.join("\n")}
          </PREVIOUS MESSAGES>

          <CURRENT MESSAGE>
            ${contextNode.episodeContent}
          </CURRENT MESSAGE>

          Instructions:

          You are given a conversation context and a CURRENT MESSAGE. Your task is to extract **entity nodes** mentioned **explicitly or implicitly** in the CURRENT MESSAGE.
          Pronoun references such as he/she/they or this/that/those should be disambiguated to the names of the 
          reference entities. Only extract distinct entities from the CURRENT MESSAGE. Don't extract pronouns like you, me, he/she/they, we/us as entities.

          1. **Speaker Identification and Merging**:
            - First, identify the speaker of the CURRENT MESSAGE (e.g., the name before the colon). 
            - If the message contains a role or classification for the speaker (e.g., "I am the CEO", "I am a client"), you should **merge** this information. 
            Instead of creating a separate node for "CEO" or "client", you should extract **one single node** for the speaker with their name and classify them with the appropriate \`entityTypeId\`. 
            For example, if "Fernando" says "I am the CEO", you extract one entity: 
            { "name": "Fernando", "entityTypeId": 0 } (Person). The EdgeExtractor will create the role relationship later.

          2. **Entity Identification**:
            - Extract all other significant entities, concepts, or actors that are **explicitly or implicitly** mentioned in the CURRENT MESSAGE.
            - **Exclude** entities mentioned only in the PREVIOUS MESSAGES (they are for context only).

          3. **Entity Classification**:
            - Use the descriptions in ENTITY TYPES to classify each extracted entity.
            - Assign the appropriate \`entityTypeId\` for each one.

          4. **Exclusions**:
            - Do NOT extract entities representing relationships or actions. These will be handled by the EdgeExtractor.
            - Do NOT extract dates, times, or other temporal information.

          5. **Formatting**:
            - Be **explicit and unambiguous** in naming entities (e.g., use full names when available).

          ${customPrompt}
        `,
          },
        ],
        outputSchemaNode
      );
      const extractedEntities = response.extractedEntities;

      refletionCount += 1;
      if (refletionCount < MAX_REFLEXION_ITERATIONS) {
        const outputSchemaMissingEntity = z.object({
          missedEntities: z
            .array(z.string())
            .describe("Names of entities that weren't extracted"),
        });

        const refletionContext = {
          episodeContent: contextNode.episodeContent,
          previousEpisodes: contextNode.history,
          extractedEntities: extractedEntities.map((ee) => ee.name),
        };

        const responseRefletion = await this.llmExecution<
          z.infer<typeof outputSchemaMissingEntity>
        >(
          [
            {
              role: "system",
              content: `
            You are an AI assistant that determines which entities have not been extracted from the given context
          `,
            },
            {
              role: "user",
              content: `
            <PREVIOUS MESSAGES>
            ${JSON.stringify(refletionContext.previousEpisodes, null, 2)}
            </PREVIOUS MESSAGES>
            <CURRENT MESSAGE>
            ${refletionContext.episodeContent}
            </CURRENT MESSAGE>

            <EXTRACTED ENTITIES>
            ${refletionContext.extractedEntities.join("\n")}
            </EXTRACTED ENTITIES>

            Given the above previous messages, current message, and list of extracted entities; determine if any entities haven't been
            extracted.
          `,
            },
          ],
          outputSchemaMissingEntity
        );

        entitiesMissing = responseRefletion.missedEntities.length !== 0;

        customPrompt = "Make sure that the following entities are extracted: ";
        for (const entity in responseRefletion.missedEntities) {
          customPrompt += `\n${entity},`;
        }

        extractedNodes = response.extractedEntities;
      }
    }

    return extractedNodes.map((node) => {
      return Node.create({
        groupId: input.episode.groupId,
        name: node.name,
        labels: contextNode.entityTypes
          .filter((e) => e.entityTypeId === node.entityTypeId)
          .map((e) => e.entityTypeName),
      });
    }) as T;
  }

  static instance() {
    return new NodeExtractor<Node[]>();
  }
}

type NodeAttributesExtractorInputDTO = {
  nodes: Node[];
  episode: Episode;
  history: Episode[];
};

export class NodeAttributesExtractor<T> extends AI<T> {
  async execute(input: NodeAttributesExtractorInputDTO): Promise<T> {
    return (await Promise.all(
      input.nodes.map(async (node) => {
        const nodeContext = {
          name: node.name,
          summary: node.summary,
          entityType: node.labels,
        };

        const summaryContext = {
          node: nodeContext,
          episodeContent: input.episode.content,
          previousEpisodes: input.history.map((ep) => ep.content),
        };

        const outputSchema = z.object({
          summary: z
            .string()
            .describe(
              "Summary containing the important information about the entity. Under 250 words"
            ),
        });
        const summaryResponse = await this.llmExecution<
          z.infer<typeof outputSchema>
        >(
          [
            {
              role: "system",
              content: `
            You are a helpful assistant that extracts entity summaries from the provided text.
          `,
            },
            {
              role: "user",
              content: `
            <MESSAGES>
              ${summaryContext.previousEpisodes.join("\n")}
              ${summaryContext.episodeContent}
            </MESSAGES>

            Given the above MESSAGES and the following ENTITY, update the summary that combines relevant information about the entity
            from the messages and relevant information from the existing summary.
            
            Guidelines:
            1. Do not hallucinate entity summary information if they cannot be found in the current context.
            2. Only use the provided MESSAGES and ENTITY to set attribute values.
            3. The summary attribute represents a summary of the ENTITY, and should be updated with new information about the Entity from the MESSAGES. 
                Summaries must be no longer than 250 words.

            <ENTITY>
            ${JSON.stringify(summaryContext.node, null, 2)}
            </ENTITY>
          `,
            },
          ],
          outputSchema
        );

        node.addSummary(summaryResponse.summary);
        return node;
      })
    )) as T;
  }

  static instance() {
    return new NodeAttributesExtractor<Node[]>();
  }
}
