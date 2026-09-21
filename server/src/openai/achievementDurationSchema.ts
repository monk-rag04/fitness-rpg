/** Versioned independently from the model and from the training-plan schema. */
export const ACHIEVEMENT_DURATION_ESTIMATOR_SCHEMA_VERSION = 'achievement-duration-estimator-schema-v1';

// This output contract deliberately contains only the AI-estimated duration.
// Product-owned target and duration-candidate decisions stay outside the model.
export const achievementDurationEstimateFormat = {
  type: 'json_schema',
  name: 'achievement_duration_estimate',
  strict: true,
  schema: {
    type: 'object',
    properties: {
      estimatedAchievementDays: { type: 'integer', minimum: 1 },
    },
    required: ['estimatedAchievementDays'],
    additionalProperties: false,
  },
} as const;
