const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

const JWT_SECRET = process.env.JWT_SECRET;
const REFRESH_TOKEN_SECRET = process.env.REFRESH_TOKEN_SECRET;
if (!JWT_SECRET) {
    throw new Error('FATAL: JWT_SECRET environment variable is not set.');
}
if (!REFRESH_TOKEN_SECRET) {
    throw new Error('FATAL: REFRESH_TOKEN_SECRET environment variable is not set. Set it to a long random string separate from JWT_SECRET.');
}
if (REFRESH_TOKEN_SECRET === JWT_SECRET) {
    throw new Error('FATAL: REFRESH_TOKEN_SECRET must be different from JWT_SECRET. Using the same value allows refresh tokens to be accepted as access tokens and vice versa.');
}
const ACCESS_TOKEN_EXPIRY = '15m';
const REFRESH_TOKEN_EXPIRY = '7d';
const PASSWORD_MIN_LENGTH = 8;

const hashPassword = async (password) => {
    if (password.length < PASSWORD_MIN_LENGTH) {
        throw new Error(`Password must be at least ${PASSWORD_MIN_LENGTH} characters`);
    }
    const salt = await bcrypt.genSalt(10);
    return await bcrypt.hash(password, salt);
};

const comparePassword = async (password, hash) => {
    return await bcrypt.compare(password, hash);
};

const generateAccessToken = (payload) => {
    return jwt.sign(payload, JWT_SECRET, { expiresIn: ACCESS_TOKEN_EXPIRY });
};

const generateRefreshToken = (payload) => {
    return jwt.sign(payload, REFRESH_TOKEN_SECRET, { expiresIn: REFRESH_TOKEN_EXPIRY });
};

const verifyToken = (token, isRefreshToken = false) => {
    try {
        const secret = isRefreshToken ? REFRESH_TOKEN_SECRET : JWT_SECRET;
        return jwt.verify(token, secret);
    } catch (e) {
        return null;
    }
};

const verifyRefreshToken = (token) => {
    try {
        return jwt.verify(token, REFRESH_TOKEN_SECRET);
    } catch (e) {
        return null;
    }
};

const generateMfaToken = (payload) => {
    return jwt.sign({ ...payload, type: 'MFA_CHALLENGE' }, JWT_SECRET, { expiresIn: '5m' });
};

module.exports = {
    hashPassword,
    comparePassword,
    generateAccessToken,
    generateRefreshToken,
    verifyToken,
    verifyRefreshToken,
    generateMfaToken,
    PASSWORD_MIN_LENGTH
};
