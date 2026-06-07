import { useEffect, useState } from 'react';
import {
  type AuthSnapshot,
  type DictionaryWord,
  type MyEmoticonSubmission,
  fetchDictionary,
  fetchMyEmoticonSubmission,
  submitEmoticon,
  subscribeAuth,
} from './supabase.js';

export function EmoticonSubmission(): JSX.Element {
  const [auth, setAuth] = useState<AuthSnapshot>({ status: 'guest' });
  const [words, setWords] = useState<DictionaryWord[] | null>(null);
  const [word1, setWord1] = useState('');
  const [word2, setWord2] = useState('');
  // undefined = loading, null = no submission, MyEmoticonSubmission = loaded
  const [submission, setSubmission] = useState<MyEmoticonSubmission | null | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => subscribeAuth(setAuth), []);

  useEffect(() => {
    if (auth.status === 'guest') return;
    void fetchDictionary().then(setWords);
    void fetchMyEmoticonSubmission().then((s) => setSubmission(s ?? null));
  }, [auth.status]);

  const doSubmit = async (): Promise<void> => {
    if (!word1 || !word2 || word1 === word2 || busy) return;
    setBusy(true);
    setErr(null);
    const res = await submitEmoticon(word1, word2);
    if (res.error) {
      setErr(res.error);
    } else {
      const s = await fetchMyEmoticonSubmission();
      setSubmission(s ?? null);
      setWord1('');
      setWord2('');
    }
    setBusy(false);
  };

  if (auth.status === 'guest') {
    return (
      <section className="panel-section">
        <div className="panel-section-title">$ emoticron · custom 2-word combo</div>
        <div className="panel-stub">─── sign in to submit a custom emoticron combo for review.</div>
      </section>
    );
  }

  const hasSub = submission !== null && submission !== undefined;
  const isPending = hasSub && submission.status === 'pending';
  const canResubmit = hasSub && !isPending;

  return (
    <section className="panel-section">
      <div className="panel-section-title">$ emoticron · custom 2-word combo</div>
      <div className="panel-stub">
        ─── pick two words from the cloud dictionary. combos are reviewed before unlock. one
        submission per account.
      </div>

      {/* Current submission status */}
      {hasSub && (
        <div className={`emotic-status emotic-status--${submission.status}`}>
          <span className="emotic-combo">
            {submission.word1} {submission.word2}
          </span>
          <span className="emotic-badge">[{submission.status}]</span>
          {submission.note && <span className="emotic-note">─── {submission.note}</span>}
        </div>
      )}

      {/* Submission form — hidden while a 'pending' submission is waiting */}
      {(!hasSub || canResubmit) && (
        <>
          <div className="emotic-form">
            <div className="emotic-row">
              <label className="panel-key" htmlFor="emotic-word1">
                word one
              </label>
              <select
                id="emotic-word1"
                className="admin-select"
                value={word1}
                onChange={(e) => setWord1(e.target.value)}
              >
                <option value="">─ pick ─</option>
                {words?.map((w) => (
                  <option key={`w1-${w.word}`} value={w.word}>
                    {w.word}
                  </option>
                ))}
              </select>
            </div>
            <div className="emotic-row">
              <label className="panel-key" htmlFor="emotic-word2">
                word two
              </label>
              <select
                id="emotic-word2"
                className="admin-select"
                value={word2}
                onChange={(e) => setWord2(e.target.value)}
              >
                <option value="">─ pick ─</option>
                {words?.map((w) => (
                  <option key={`w2-${w.word}`} value={w.word}>
                    {w.word}
                  </option>
                ))}
              </select>
            </div>
            {word1 && word2 && word1 !== word2 && (
              <div className="emotic-preview">
                preview ·{' '}
                <strong className="emotic-preview-combo">
                  {word1} {word2}
                </strong>
              </div>
            )}
            {word1 && word2 && word1 === word2 && (
              <div className="panel-stub">─── both words must be different.</div>
            )}
          </div>

          {err && <div className="auth-error">! {err}</div>}

          <div className="panel-row">
            <span className="panel-key">
              {canResubmit ? 'submit new combo' : 'submit for review'}
            </span>
            <button
              type="button"
              className={
                word1 && word2 && word1 !== word2 && !busy ? 'panel-toggle is-on' : 'panel-toggle'
              }
              disabled={busy || !word1 || !word2 || word1 === word2}
              onClick={() => {
                void doSubmit();
              }}
            >
              {busy ? '…' : '[ submit ]'}
            </button>
          </div>
        </>
      )}

      {isPending && (
        <div className="panel-stub">─── your combo is under review. check back soon.</div>
      )}

      {hasSub && submission.status === 'approved' && (
        <div className="panel-stub">
          ─── approved ✓ — equipping custom emoticrons to the wheel is coming in a future update.
        </div>
      )}
    </section>
  );
}
