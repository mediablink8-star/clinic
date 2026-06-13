const redactFields = (obj) => {
    if (obj === null || obj === undefined) return obj;
    if (Array.isArray(obj)) {
        return obj.map(redactFields);
    }
    if (typeof obj === 'object') {
        const result = {};
        for (const key in obj) {
            if (Object.prototype.hasOwnProperty.call(obj, key)) {
                if (key.toLowerCase() === 'amka') {
                    continue;
                }
                result[key] = redactFields(obj[key]);
            }
        }
        return result;
    }
    return obj;
};

module.exports = (req, res, next) => {
    // If the user has OWNER role or AUTOMATION role, do not redact
    if (req.user && (req.user.role === 'OWNER' || req.user.role === 'AUTOMATION')) {
        return next();
    }

    const originalJson = res.json;

    res.json = function (body) {
        const redactedBody = redactFields(body);
        return originalJson.call(this, redactedBody);
    };

    next();
};
