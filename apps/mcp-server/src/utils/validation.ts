import { z } from "zod";

export const entityIdSchema = z.string().uuid();
export const searchQuerySchema = z.string().min(1).max(100);
export const nameSchema = z.string().min(1).max(255);
export const shortNameSchema = z.string().min(1).max(50);
export const descriptionSchema = z.string().max(2000).optional();

export const validateToolInput = <T>(
  schema: z.ZodSchema<T>,
  input: unknown,
): { success: true; data: T } | { success: false; error: string } => {
  const result = schema.safeParse(input);
  if (!result.success) {
    const messages = result.error.issues
      .map((i) => `${i.path.join(".")}: ${i.message}`)
      .join("; ");
    return { success: false, error: `Invalid input: ${messages}` };
  }
  return { success: true, data: result.data };
};
