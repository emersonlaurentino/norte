import { z } from 'zod'

const errorSchema = z.object({ error: z.string() })

export const commonResponses = {
  400: {
    description: 'Bad Request',
    content: {
      'application/json': { schema: errorSchema },
    },
  },
  401: {
    description: 'Unauthorized',
    content: {
      'application/json': { schema: errorSchema },
    },
  },
  403: {
    description: 'Forbidden',
    content: {
      'application/json': { schema: errorSchema },
    },
  },
  404: {
    description: 'Not Found',
    content: {
      'application/json': { schema: errorSchema },
    },
  },
  409: {
    description: 'Conflict',
    content: {
      'application/json': { schema: errorSchema },
    },
  },
  500: {
    description: 'Internal Server Error',
    content: {
      'application/json': { schema: errorSchema },
    },
  },
}
