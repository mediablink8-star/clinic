/**
 * Request-validation middleware factory.
 *
 * Wraps a Joi schema into Express middleware. On success, the cleaned
 * (and type-coerced) value replaces req[source] so handlers can rely
 * on canonical types (e.g. numbers come back as numbers, not strings).
 *
 * On failure, throws an AppError with code 'VALIDATION_ERROR' and
 * HTTP status 400. asyncHandler / global error middleware convert
 * it to a consistent JSON response.
 *
 * Usage:
 *   const { validate, validateBody, validateQuery, validateParams } = require('../middleware/validation');
 *
 *   router.post('/foo', validateBody(fooSchema), handler);
 *   // or
 *   router.post('/bar', validate(barSchema, 'body'), handler);
 *
 * @param {Joi.Schema} schema
 * @param {'body'|'query'|'params'} [source='body']
 * @returns {import('express').RequestHandler}
 */
const AppError = require('../errors/AppError');
const logger = require('../utils/logger');

const validate = (schema, source = 'body') => (req, _res, next) => {
    const data = req[source];

    if (source === 'body' && (data === undefined || data === null || (typeof data === 'object' && Object.keys(data).length === 0))) {
        logger.warn('Empty body received', { url: req.originalUrl, method: req.method });
        return next(new AppError('VALIDATION_ERROR', 'Request body is missing or empty', 400));
    }

    const { value, error } = schema.validate(data, {
        abortEarly: false,
        stripUnknown: true,
        convert: true,
    });

    if (error) {
        const detail = error.details.map((d) => d.message).join('; ');
        logger.warn('Validation error', {
            url: req.originalUrl,
            method: req.method,
            source,
            detail,
        });
        return next(new AppError('VALIDATION_ERROR', detail, 400, { issues: error.details.map((d) => ({ path: d.path, message: d.message })) }));
    }

    req[source] = value;
    return next();
};

const validateBody = (schema) => validate(schema, 'body');
const validateQuery = (schema) => validate(schema, 'query');
const validateParams = (schema) => validate(schema, 'params');

module.exports = {
    validate,
    validateBody,
    validateQuery,
    validateParams,
};
