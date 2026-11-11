import { test } from 'node:test';
import assert from 'node:assert/strict';
import { addPerson, profileText, ID_PATTERN } from '../template/.kbsmith/scripts/team/join.mjs';
import { SECRET_RE, DENY_PATH_RE, ownerOf } from '../template/.kbsmith/scripts/team/team-lib.mjs';

test('addPerson creates and merges without mutating', () => {
  const empty = {};
  const one = addPerson(empty, 'sam', { name: 'Sam', github: ['sam-gh'], git_names: ['Sam'], os_users: [], hosts: [] });
  assert.deepEqual(empty, {});
  const two = addPerson(one, 'sam', { name: 'Sam', github: ['sam-gh'], git_names: ['Sam Laptop'], os_users: [], hosts: [] });
  assert.deepEqual(two.sam.git_names, ['Sam', 'Sam Laptop']);
  assert.deepEqual(two.sam.github, ['sam-gh']);
});

test('profile has a learnable name line', () => {
  assert.match(profileText('Sam', 'dev', '2026-01-01'), /^Name: Sam$/m);
  assert.ok(ID_PATTERN.test('sam'));
  assert.ok(!ID_PATTERN.test('Sam Smith'));
});

test('team guards: secrets, never-shared paths, owner folders', () => {
  assert.ok(SECRET_RE.some((re) => re.test('token = abcdefghijklmnop')));
  assert.ok(!SECRET_RE.some((re) => re.test('we decided to use tokens for auth')));
  assert.ok(DENY_PATH_RE.test('inbox/export.json'));
  assert.ok(DENY_PATH_RE.test('.env.local'));
  assert.ok(!DENY_PATH_RE.test('kb/03-environment.txt'));
  assert.equal(ownerOf('people/sam/profile.txt'), 'sam');
  assert.equal(ownerOf('kb/01-about.txt'), null);
});
