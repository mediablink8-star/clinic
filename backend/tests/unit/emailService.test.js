jest.mock('nodemailer', () => {
  const sendMail = jest.fn().mockResolvedValue({ messageId: 'test-message-id' });
  return {
    __sendMail: sendMail,
    createTransport: jest.fn(() => ({ sendMail })),
    createTestAccount: jest.fn(),
    getTestMessageUrl: jest.fn(),
  };
});

const nodemailer = require('nodemailer');
const { sendSmsFailureAlert, sendDemoRequest, sendPasswordResetEmail } = require('../../services/emailService');

describe('emailService HTML safety', () => {
  beforeAll(() => {
    process.env.NODE_ENV = 'production';
    process.env.SMTP_HOST = 'smtp.example.test';
    process.env.SMTP_PORT = '587';
    process.env.SMTP_USER = 'mailer@example.test';
    process.env.SMTP_PASS = 'test-only-password';
  });

  beforeEach(() => {
    nodemailer.__sendMail.mockClear();
    nodemailer.__sendMail.mockResolvedValue({ messageId: 'test-message-id' });
  });

  test('escapes dynamic SMS failure details and prevents subject line breaks', async () => {
    const clinicName = 'Clinic\r\nBcc: attacker@example.test';
    const phone = '<img src=x onerror=alert(1)>';
    const error = '<script>alert("xss")</script>';

    await expect(sendSmsFailureAlert('owner@example.test', clinicName, phone, error)).resolves.toBe(true);

    const message = nodemailer.__sendMail.mock.calls[0][0];
    expect(message.subject).not.toMatch(/[\r\n]/);
    expect(message.html).not.toContain(phone);
    expect(message.html).not.toContain(error);
    expect(message.html).toContain('&lt;img');
    expect(message.html).toContain('&lt;script&gt;');
  });

  test('escapes the password reset URL before inserting it into an HTML attribute', async () => {
    const resetLink = 'https://example.test/reset?token=abc&next="><script>alert(1)</script>';

    await expect(sendPasswordResetEmail('owner@example.test', resetLink)).resolves.toBe(true);

    const message = nodemailer.__sendMail.mock.calls[0][0];
    expect(message.html).toContain('&amp;next=&quot;&gt;&lt;script&gt;');
    expect(message.html).not.toContain('href="' + resetLink + '"');
  });

  test('escapes demo request details in HTML and sanitizes the subject', async () => {
    await expect(sendDemoRequest({
      clinicName: 'Clinic\nBcc: attacker@example.test',
      name: '<b>Injected</b>',
      email: 'person@example.test',
      phone: '123',
      notes: '<script>alert(1)</script>',
    })).resolves.toBe(true);

    const message = nodemailer.__sendMail.mock.calls[0][0];
    expect(message.subject).not.toMatch(/[\r\n]/);
    expect(message.html).not.toContain('<b>Injected</b>');
    expect(message.html).not.toContain('<script>alert(1)</script>');
  });
});
