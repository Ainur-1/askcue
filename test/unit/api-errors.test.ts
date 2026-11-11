import t from 'tap';
import { classifyApiError, getHttpStatus } from '../../electron/utils/apiErrors';

t.test('classifies permanent credentials and configuration failures', (t) => {
  for (const status of [400, 401, 403, 404]) {
    t.equal(classifyApiError({ response: { status } }), 'permanent', `${status} is permanent`);
  }
  t.equal(getHttpStatus({ status: 403 }), 403);
  t.end();
});

t.test('distinguishes exhausted quota from retryable throttling', (t) => {
  t.equal(
    classifyApiError({ response: { status: 429 }, message: 'Quota exceeded; limit: 0' }),
    'permanent',
  );
  t.equal(classifyApiError({ response: { status: 429 }, message: 'Try again shortly' }), 'rate_limit');
  t.equal(classifyApiError({ response: { status: 503 } }), 'transient');
  t.end();
});
