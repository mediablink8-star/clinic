class AppError extends Error {
    /**
     * @param {string} code   - Machine-readable error code e.g. 'NOT_FOUND', 'FORBIDDEN'
     * @param {string} message - Human-readable message
     * @param {number} status  - HTTP status code
     */
    constructor(code, message, status = 500) {
        super(message);
        this.name = 'AppError';
        this.code = code;
        this.status = status;
    }
}

module.exports = AppError;
