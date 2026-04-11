import { z } from "zod";

export interface ToolDefinition {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: any;
  };
}

export abstract class BaseTool<
  TInput extends z.ZodTypeAny = z.ZodTypeAny,
  TOutput = any
> {
  abstract name: string;
  abstract description: string;
  abstract inputSchema: TInput;

  get definition(): ToolDefinition {
    return {
      type: "function",
      function: {
        name: this.name,
        description: this.description,
        parameters: this.inputSchemaToJsonSchema(),
      },
    };
  }

  private inputSchemaToJsonSchema(): any {
    const schema = this.inputSchema as unknown as z.ZodObject<any>;
    return {
      type: "object",
      properties: schema.shape,
      required: Object.keys(schema.shape).filter(
        (key) => !schema.shape[key].isOptional()
      ),
    };
  }

  abstract execute(input: z.infer<TInput>): Promise<TOutput>;

  validateInput(input: unknown): z.infer<TInput> {
    return this.inputSchema.parse(input);
  }
}
