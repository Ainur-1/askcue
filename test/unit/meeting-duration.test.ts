import t from 'tap';
import { formatMeetingDuration } from '../../src/lib/meetingDuration';
import { SessionTracker } from '../../electron/core/SessionTracker';

t.test('duration uses the session start across navigation, background delays and long calls', t => {
  t.equal(formatMeetingDuration(null, 100_000), '00:00:00');
  t.equal(formatMeetingDuration(1_000, 66_500), '00:01:05');
  t.equal(formatMeetingDuration(1_000, 3_662_000), '01:01:01');
  t.equal(formatMeetingDuration(1_000, 90_001_000), '25:00:00');
  t.equal(formatMeetingDuration(10_000, 5_000), '00:00:00');
  t.equal(formatMeetingDuration(Number.NaN, 100_000), '00:00:00');
  t.end();
});

t.test('new session resets the persisted clock and clears prior conversation context', t => {
  const session = new SessionTracker();
  session.addTranscript({ speaker: 'user', text: 'Prior call', timestamp: Date.now(), final: true });
  const before = Date.now();
  session.reset();
  t.ok(session.getSessionStartTime() >= before);
  t.same(session.getFullTranscript(), []);
  t.equal(formatMeetingDuration(session.getSessionStartTime(), session.getSessionStartTime()), '00:00:00');
  t.end();
});
