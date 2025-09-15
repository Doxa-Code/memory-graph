import z from "zod";
import { AI } from ".";
import { Edge } from "../edge";
import type { Episode } from "../episode";
import { Node } from "../node";

type EdgeExtractorInputDTO = {
  episode: Episode;
  history: Episode[];
  extractedNodes: Node[];
};

export class EdgeExtractor<T> extends AI<T> {
  async execute(input: EdgeExtractorInputDTO): Promise<T> {
    const MAX_REFLEXION_ITERATIONS = 3;
    const edgeTypesContext = [
      {
        factTypeName: "",
        factTypeSignature: [],
        factTypeDescription: "",
      },
    ];
    const context = {
      episodeContent: input.episode.content,
      nodes: input.extractedNodes.map((en, i) => ({
        id: i,
        name: en.name,
        entityTypes: en.labels,
      })),
      previousEpisodes: input.history.map((ep) => ep.content),
      referenceTime: input.episode.createdAt,
      edgeTypes: edgeTypesContext,
      customPrompt: "",
      extractedFacts: [] as string[],
    };
    let factsMissed = true;
    let reflexionIterations = 0;

    const edgeSchema = z.array(
      z.object({
        relationType: z
          .string()
          .describe("FACT_PREDICATE_IN_SCREAMING_SNAKE_CASE"),
        sourceEntityId: z
          .number()
          .describe("The id of the source entity of the fact."),
        targetEntityId: z
          .number()
          .describe("The id of the target entity of the fact."),
        fact: z.string(),
        validAt: z
          .string()
          .nullable()
          .describe(
            "The date and time when the relationship described by the edge fact became true or was established. Use ISO 8601 format (YYYY-MM-DDTHH:MM:SS.SSSSSSZ)"
          ),
        invalidAt: z
          .string()
          .nullable()
          .describe(
            "The date and time when the relationship described by the edge fact stopped being true or ended. Use ISO 8601 format (YYYY-MM-DDTHH:MM:SS.SSSSSSZ)The date and time when the relationship described by the edge fact stopped being true or ended. Use ISO 8601 format (YYYY-MM-DDTHH:MM:SS.SSSSSSZ)"
          ),
      })
    );

    const outputSchema = z.object({
      edges: edgeSchema,
    });

    let edgesData: z.infer<typeof edgeSchema> = [];

    while (factsMissed && reflexionIterations <= MAX_REFLEXION_ITERATIONS) {
      const response = await this.llmExecution<z.infer<typeof outputSchema>>(
        [
          {
            role: "system",
            content: `
            You are an expert fact extractor that extracts fact triples from text. 
            Your goal is to capture relationships as edges in a knowledge graph.
            1. Extracted fact triples should also be extracted with relevant date information.
            2. Treat the CURRENT TIME as the time the CURRENT MESSAGE was sent. All temporal information should be extracted relative to this time.
          `,
          },
          {
            role: "user",
            content: `
            <FACT TYPES>
            ${JSON.stringify(context.edgeTypes, null, 2)}
            </FACT TYPES>

            <PREVIOUS_MESSAGES>
            ${context.previousEpisodes.join("\n")}
            </PREVIOUS_MESSAGES>

            <CURRENT_MESSAGE>
            ${context.episodeContent}
            </CURRENT_MESSAGE>

            <ENTITIES>
            ${JSON.stringify(context.nodes, null, 2)}
            </ENTITIES>

            <REFERENCE_TIME>
            ${context.referenceTime.toISOString()}
            </REFERENCE_TIME>

            # TASK
            Extract all factual relationships between the given ENTITIES based on the CURRENT MESSAGE.
            - A relationship should connect two DISTINCT ENTITIES from the ENTITIES list.
            - The relationship type must be one of the FACT TYPES provided.
            - The\`fact\` field should be a concise description of the relationship (e.g., "Fernando is the CEO of Doxa Code").
            - Use the \`sourceEntityId\` and \`targetEntityId\` to link the entities.

            Example:
            - Message: "Fernando is the CEO at Doxa Code."
            - Entities: [{id: 0, name: "Fernando"}, {id: 1, name: "Doxa Code"}, {id: 2, name: "CEO"}]
            - Expected output:
              - Edge 1: { relationType: "HAS_ROLE", sourceEntityId: 0, targetEntityId: 2, fact: "Fernando has the role of CEO" }
              - Edge 2: { relationType: "WORKS_AT", sourceEntityId: 0, targetEntityId: 1, fact: "Fernando works at Doxa Code" }

            # EXTRACTION RULES

            1. Only emit facts where both the subject and object match IDs in ENTITIES.
            2. Each fact must involve two **distinct** entities.
            3. Use a SCREAMING_SNAKE_CASE string from FACT TYPES as the \`relationType\`.
            4. Do not emit duplicate or semantically redundant facts.
            5. The \`fact\` should quote or closely paraphrase the original source sentence(s).
            6. Use \`REFERENCE_TIME\` to resolve vague or relative temporal expressions (e.g., "last week
            7. Do **not** hallucinate or infer temporal bounds from unrelated events.

            # DATETIME RULES

            - Use ISO 8601 with “Z” suffix (UTC) (e.g., 2025-04-30T00:00:00Z).
            - If the fact is ongoing (present tense), set \`valid_at\` to REFERENCE_TIME.
            - If a change/termination is expressed, set \`invalid_at\` to the relevant timestamp.
            - Leave both fields \`null\` if no explicit or resolvable time is stated.
            - If only a date is mentioned (no time), assume 00:00:00.
            - If only a year is mentioned, use January 1st at 00:00:00.

            ${context.customPrompt}
          `,
          },
        ],
        outputSchema
      );
      edgesData = response.edges;
      context.extractedFacts = edgesData.map((edge) => edge.fact);
      reflexionIterations += 1;
      const outputSchemaReflexion = z.object({
        missingFacts: z
          .array(z.string())
          .describe("facts that weren't extracted"),
      });
      if (reflexionIterations < MAX_REFLEXION_ITERATIONS) {
        const reflexionResponse = await this.llmExecution<
          z.infer<typeof outputSchemaReflexion>
        >(
          [
            {
              role: "system",
              content: `You are an AI assistant that determines which facts have not been extracted from the given context`,
            },
            {
              role: "user",
              content: `
              <PREVIOUS MESSAGES>
              ${JSON.stringify(context.previousEpisodes, null, 2)}
              </PREVIOUS MESSAGES>
              <CURRENT MESSAGE>
              ${context.episodeContent}
              </CURRENT MESSAGE>

              <EXTRACTED ENTITIES>
              ${JSON.stringify(context.nodes, null, 2)}
              </EXTRACTED ENTITIES>

              <EXTRACTED FACTS>
              ${JSON.stringify(context.extractedFacts.join("\n"))}
              </EXTRACTED FACTS>

              Given the above MESSAGES, list of EXTRACTED ENTITIES entities, and list of EXTRACTED FACTS; 
              determine if any facts haven't been extracted.
            `,
            },
          ],
          outputSchemaReflexion
        );
        const missingFacts = reflexionResponse.missingFacts || [];
        context.customPrompt =
          "The following facts were missed in a previous extraction: ";
        for (const fact of missingFacts) {
          context.customPrompt += `\n${fact}`;
        }
        factsMissed = missingFacts.length !== 0;
      }
    }

    if (edgesData.length === 0) return [] as T;

    const edges = [];

    for (const edgeData of edgesData) {
      const validAt = edgeData.validAt
        ? new Date(edgeData.validAt)
        : new Date();
      const invalidAt = edgeData.invalidAt
        ? new Date(edgeData.invalidAt)
        : null;
      const sourceNodeIdx = edgeData.sourceEntityId;
      const targetNodeIdx = edgeData.targetEntityId;
      if (
        !(
          sourceNodeIdx > -1 &&
          sourceNodeIdx < input.extractedNodes.length &&
          targetNodeIdx < input.extractedNodes.length
        )
      )
        continue;

      const sourceNodeId = input.extractedNodes[sourceNodeIdx]!.id;
      const targetNodeId = input.extractedNodes[targetNodeIdx]!.id;

      const edge = Edge.create({
        episodes: [input.episode.id],
        fact: edgeData.fact,
        groupId: input.episode.groupId,
        label: edgeData.relationType,
        sourceId: sourceNodeId,
        targetId: targetNodeId,
        validAt,
        invalidAt,
      });
      edges.push(edge);
    }

    return edges as T;
  }

  static instance() {
    return new EdgeExtractor<Edge[]>();
  }
}
