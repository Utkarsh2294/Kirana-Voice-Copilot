import { z } from 'zod';

export const emptySchema = z.object({}).strict();
export function problem(status, code) {
  return Object.assign(new Error(code), { status, code });
}
export function validate(schema, value) {
  const result = schema.safeParse(value);
  if (!result.success) throw problem(400, 'VALIDATION_FAILED');
  return result.data;
}
export function validateRequest(
  req,
  body = emptySchema,
  query = emptySchema,
  params = emptySchema,
) {
  return {
    body: validate(body, req.body ?? {}),
    query: validate(query, req.query),
    params: validate(params, req.params),
  };
}
