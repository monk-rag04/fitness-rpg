// This output contract mirrors shared TrainingPlanDraft. Cross-field and
// candidate-membership rules are enforced by validateTrainingPlanDraft().
export const trainingPlanDraftFormat = {
  type: 'json_schema',
  name: 'training_plan_draft',
  strict: true,
  schema: {
    type: 'object',
    properties: {
      exercises: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            exerciseId: { type: 'string' },
            role: { type: 'string', enum: ['main', 'accessory'] },
            sets: { type: 'integer', minimum: 1 },
            repRange: {
              type: 'object',
              properties: {
                min: { type: 'integer', minimum: 1 },
                max: { type: 'integer', minimum: 1 },
              },
              required: ['min', 'max'],
              additionalProperties: false,
            },
          },
          required: ['exerciseId', 'role', 'sets', 'repRange'],
          additionalProperties: false,
        },
      },
    },
    required: ['exercises'],
    additionalProperties: false,
  },
} as const;
