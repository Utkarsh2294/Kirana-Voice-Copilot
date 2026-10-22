import { problem } from './http.js';

export function createSmsProvider(config, logger) {
  return {
    async send() {
      if (
        config.NODE_ENV === 'production' ||
        !config.ALLOW_DEV_OTP ||
        config.SMS_PROVIDER !== 'console'
      )
        throw problem(503, 'SMS_NOT_CONFIGURED');
      // Never log phone/code, including in development. The UI explains the gated fixed code.
      logger.info({ provider: 'console', development: true }, 'Development OTP delivery simulated');
    },
  };
}
