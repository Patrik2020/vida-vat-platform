import type { FastifyReply, FastifyRequest } from 'fastify';

export type ApiErrorCode =
  | 'invalid_request'
  | 'unsupported_effective_date'
  | 'classification_failed'
  | 'calculation_failed'
  | 'currency_conversion_failed'
  | 'invoice_aggregation_failed'
  | 'tax_point_failed'
  | 'reverse_charge_evaluation_failed'
  | 'aam_threshold_evaluation_failed'
  | 'activity_exemption_evaluation_failed'
  | 'property_rental_exemption_evaluation_failed'
  | 'property_sale_exemption_evaluation_failed'
  | 'property_sale_reverse_charge_evaluation_failed';

export function sendApiError(
  request: FastifyRequest,
  reply: FastifyReply,
  statusCode: 400 | 422,
  code: ApiErrorCode,
  message: string,
  details?: unknown
) {
  return reply.code(statusCode).send({
    error: {
      code,
      message,
      requestId: request.id,
      ...(details === undefined ? {} : { details })
    }
  });
}
