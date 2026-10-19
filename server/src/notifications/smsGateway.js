/**
 * Stand-in for the "SMS [external]" box in the A1 diagrams.
 *
 * Every gateway has one method, send(to, text). The A3 mock prints the
 * message and keeps a copy in `sent` (tests read it). In A4 a real provider
 * implements the same send(), and nothing else changes.
 */
export class MockSmsGateway {
  constructor(log = process.env.VITEST ? () => {} : console.log) {
    this.log = log;
    this.sent = [];
  }

  send(to, text) {
    const message = { to, text, at: Date.now() };
    this.sent.push(message);
    this.log(`[SMS -> ${to}] ${text}`);
    return message;
  }

  clear() {
    this.sent = [];
  }
}

export const smsGateway = new MockSmsGateway();
