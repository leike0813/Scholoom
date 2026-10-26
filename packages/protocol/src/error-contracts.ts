export const errorInfoSchema = {
  type: 'object',
  properties: {
    code: {
      enum: [
        'authenticationFailed',
        'protocolIncompatible',
        'instanceMismatch',
        'invalidRequest',
        'unavailable',
        'outcomeUnknown',
        'shuttingDown',
        'permissionDenied',
        'startupFailed',
        'notFound',
        'contentChanged',
        'targetAmbiguous',
        'tooLarge',
        'credentialUnavailable',
        'modelFailed',
        'resourceLimit',
      ],
    },
    message: { type: 'string', maxLength: 512 },
  },
  required: ['code', 'message'],
  additionalProperties: false,
} as const;
