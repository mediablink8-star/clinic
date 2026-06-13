const AppError = require('../errors/AppError');

describe('AppError', () => {
    test('creates error with code and message', () => {
        const err = new AppError('NOT_FOUND', 'Resource not found', 404);
        expect(err.code).toBe('NOT_FOUND');
        expect(err.message).toBe('Resource not found');
        expect(err.status).toBe(404);
    });

    test('defaults status to 500', () => {
        const err = new AppError('INTERNAL_ERROR', 'Something went wrong');
        expect(err.status).toBe(500);
    });

    test('accepts details object', () => {
        const err = new AppError('VALIDATION_ERROR', 'Invalid input', 400, { field: 'email' });
        expect(err.details).toEqual({ field: 'email' });
    });

    test('is instance of Error', () => {
        const err = new AppError('TEST', 'test');
        expect(err).toBeInstanceOf(Error);
    });
});
