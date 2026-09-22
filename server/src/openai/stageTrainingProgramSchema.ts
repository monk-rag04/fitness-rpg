import { EXERCISE_CATALOG } from '@fitness-rpg/shared';

/**
 * A Stage can contain at most one Training Session per calendar day. The
 * currently accepted Roadmap duration ceiling is 42 days.
 */
export const MAX_STAGE_TRAINING_PROGRAM_SESSIONS = 42;

const catalogExerciseIds = EXERCISE_CATALOG.map((exercise) => exercise.id);

/**
 * Strict transport contract only. The shared Stage validator remains the
 * authority for per-day membership, exact coverage, and cross-field rules.
 */
export const stageTrainingProgramDraftFormat = {
  type: 'json_schema',
  name: 'stage_training_program_draft',
  strict: true,
  schema: {
    type: 'object',
    properties: {
      sessions: {
        type: 'array',
        minItems: 1,
        maxItems: MAX_STAGE_TRAINING_PROGRAM_SESSIONS,
        items: {
          type: 'object',
          properties: {
            dayIndex: { type: 'integer', minimum: 0, maximum: MAX_STAGE_TRAINING_PROGRAM_SESSIONS - 1 },
            plan: {
              type: 'object',
              properties: {
                exercises: {
                  type: 'array',
                  minItems: 1,
                  maxItems: 6,
                  items: {
                    type: 'object',
                    properties: {
                      exerciseId: { type: 'string', enum: catalogExerciseIds },
                      role: { type: 'string', enum: ['main', 'accessory'] },
                      sets: { type: 'integer', minimum: 1, maximum: 5 },
                      repRange: {
                        type: 'object',
                        properties: {
                          min: { type: 'integer', minimum: 1, maximum: 20 },
                          max: { type: 'integer', minimum: 1, maximum: 20 },
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
          },
          required: ['dayIndex', 'plan'],
          additionalProperties: false,
        },
      },
    },
    required: ['sessions'],
    additionalProperties: false,
  },
} as const;
