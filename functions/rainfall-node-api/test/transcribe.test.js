const { test } = require('node:test');
const assert = require('node:assert');
const { transcribeAudio } = require('../index');

test('transcribeAudio throws a clear error when GROQ_API_KEY is unset', async () => {
  const prev = process.env.GROQ_API_KEY;
  delete process.env.GROQ_API_KEY;
  try {
    await assert.rejects(() => transcribeAudio('YWJj', 'en'), /not configured/);
  } finally {
    if (prev !== undefined) process.env.GROQ_API_KEY = prev;
  }
});

test('transcribeAudio sends the key as a Bearer token and returns Groq\'s text, never leaking the key in the response', async () => {
  const prev = process.env.GROQ_API_KEY;
  process.env.GROQ_API_KEY = 'test-secret-key';
  let seenAuth, seenModel, seenLang;
  const prevFetch = global.fetch;
  global.fetch = async (url, opts) => {
    seenAuth = opts.headers.Authorization;
    seenModel = opts.body.get('model');
    seenLang = opts.body.get('language');
    return { ok: true, json: async () => ({ text: 'who is the accused in c 5001' }) };
  };
  try {
    const text = await transcribeAudio('YWJj', 'en');
    assert.equal(text, 'who is the accused in c 5001');
    assert.equal(seenAuth, 'Bearer test-secret-key');
    assert.equal(seenModel, 'whisper-large-v3-turbo');
    assert.equal(seenLang, 'en');
  } finally {
    global.fetch = prevFetch;
    if (prev !== undefined) process.env.GROQ_API_KEY = prev; else delete process.env.GROQ_API_KEY;
  }
});

test('transcribeAudio throws on a non-ok response instead of silently returning empty text', async () => {
  const prev = process.env.GROQ_API_KEY;
  process.env.GROQ_API_KEY = 'test-secret-key';
  const prevFetch = global.fetch;
  global.fetch = async () => ({ ok: false, status: 401 });
  try {
    await assert.rejects(() => transcribeAudio('YWJj', 'en'), /401/);
  } finally {
    global.fetch = prevFetch;
    if (prev !== undefined) process.env.GROQ_API_KEY = prev; else delete process.env.GROQ_API_KEY;
  }
});
