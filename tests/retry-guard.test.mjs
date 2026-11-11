import { test } from 'node:test';
import assert from 'node:assert/strict';
import { decide, STOP_AT, FAILURE, RESOLVED } from '../template/.kbsmith/scripts/retry-guard.mjs';

const LESSONS = 'kb/25-mistakes-and-lessons.txt';

test('neutral prompt keeps the count and says nothing', () => {
  assert.deepEqual(decide(0, 'add a dark mode toggle to settings', LESSONS), { count: 0, text: '' });
  assert.deepEqual(decide(1, 'now rename the button', LESSONS), { count: 1, text: '' });
});

test('first failure report nudges, second forces the postmortem', () => {
  const first = decide(0, 'it still does not work', LESSONS);
  assert.equal(first.count, 1);
  assert.match(first.text, /check kb\/25/);
  const second = decide(first.count, 'same error as before', LESSONS);
  assert.equal(second.count, STOP_AT);
  assert.match(second.text, /STOP retrying/);
});

test('a prompt with both a failure and a resolved phrase counts as a failure', () => {
  const r = decide(1, 'I thought it works now but it still fails on save', LESSONS);
  assert.equal(r.count, 2);
});

test('resolved after failures asks for the lesson and resets', () => {
  const r = decide(2, 'that fixed it, thanks', LESSONS);
  assert.equal(r.count, 0);
  assert.match(r.text, /KB LESSON DUE/);
});

test('resolved with no prior failures is silent', () => {
  assert.deepEqual(decide(0, 'it works', LESSONS), { count: 0, text: '' });
});

test('patterns avoid common false positives', () => {
  for (const prompt of ['I still need a login page', 'add error handling to the parser', 'what is still left on the todo list']) {
    assert.equal(FAILURE.test(prompt), false, prompt);
  }
  assert.equal(RESOLVED.test('it works'), true);
});
