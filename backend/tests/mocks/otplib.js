// Mock otplib for tests — MFA not tested
const authenticator = {
  generateSecret: () => ({ base32: 'MOCKSECRET', otpauth_url: 'otpauth://mock' }),
  verify: () => ({ delta: 0 }),
  generate: () => '000000',
};

const totp = {
  verify: () => ({ delta: 0 }),
  generate: () => '000000',
  options: { window: 1 },
};

const hotp = {
  verify: () => ({ delta: 0 }),
  generate: () => '000000',
};

module.exports = { authenticator, totp, hotp };
