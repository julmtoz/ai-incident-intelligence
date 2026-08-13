import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { IncidentSeverity } from "@prisma/client";
import { z } from "zod";
import { env } from "../config.js";

export const incidentAnalysisSchema = z.object({
  severity: z.nativeEnum(IncidentSeverity),
  category: z.string().min(1).max(80),
  rootCause: z.string().min(1).max(1000),
  suggestedSteps: z.array(z.string().min(1).max(500)).min(1).max(10),
});

export type IncidentAnalysis = z.infer<typeof incidentAnalysisSchema>;

export interface IncidentAnalysisProvider {
  analyze(input: { title: string; description: string }): Promise<IncidentAnalysis>;
}

const client = new OpenAI({
  apiKey: env.OPENAI_API_KEY,
  timeout: 30_000,
  maxRetries: 0,
});

export const openAIIncidentAnalysisProvider: IncidentAnalysisProvider = {
  async analyze({ title, description }) {
    const response = await client.responses.parse({
      model: "gpt-5-mini",
      input: [
        {
          role: "system",
          content:
            "Analyze the IT incident. Classify severity and category, identify the most probable root cause, and give concise ordered troubleshooting steps. Base conclusions only on the supplied report.",
        },
        {
          role: "user",
          content: `Title: ${title}\nDescription: ${description}`,
        },
      ],
      text: {
        format: zodTextFormat(incidentAnalysisSchema, "incident_analysis"),
      },
    });

    if (!response.output_parsed) {
      throw new Error("OpenAI returned no valid structured incident analysis");
    }

    return incidentAnalysisSchema.parse(response.output_parsed);
  },
};
