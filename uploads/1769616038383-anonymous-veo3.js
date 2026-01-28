/**
 * Veo3 AI Video Scraper (CommonJS)
 * Base: https://www.veo3ai.app
 */

const fetch = require('node-fetch');
const crypto = require('crypto');

const BASE_URL = 'https://azhan77168-video.hf.space';

/* ================= UTIL ================= */

function generateSessionHash() {
  return crypto.randomBytes(6).toString('hex');
}

async function parseSSE(response) {
  const text = await response.text();
  const lines = text.split('\n');
  const events = [];

  for (const line of lines) {
    if (line.startsWith('data: ')) {
      try {
        events.push(JSON.parse(line.slice(6)));
      } catch {}
    }
  }
  return events;
}

/* ================= CORE ================= */

async function joinQueue(prompt, sessionHash) {
  const payload = {
    data: [
      prompt,
      "worst quality, inconsistent motion, blurry, jittery, distorted",
      null,
      "",
      512,
      704,
      "image-to-video",
      5,
      9,
      42,
      true,
      1,
      true
    ],
    event_data: null,
    fn_index: 5,
    trigger_id: 7,
    session_hash: sessionHash
  };

  const res = await fetch(`${BASE_URL}/gradio_api/queue/join?__theme=system`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'origin': BASE_URL,
      'referer': `${BASE_URL}/?__theme=system`
    },
    body: JSON.stringify(payload)
  });

  const json = await res.json();
  return json.event_id;
}

async function waitForResult(sessionHash, timeout = 180000) {
  const start = Date.now();

  while (true) {
    if (Date.now() - start > timeout) {
      throw new Error('Timeout waiting for video');
    }

    const res = await fetch(
      `${BASE_URL}/gradio_api/queue/data?session_hash=${sessionHash}`,
      {
        headers: {
          'accept': 'text/event-stream',
          'origin': BASE_URL,
          'referer': `${BASE_URL}/?__theme=system`
        }
      }
    );

    const events = await parseSSE(res);

    for (const e of events) {
      if (e.msg === 'process_completed') {
        const video = e.output?.data?.[0]?.video;
        if (!video?.url) throw new Error('Video URL not found');
        return video.url;
      }
    }

    await new Promise(r => setTimeout(r, 2000));
  }
}

/* ================= EXPORT ================= */

async function veo3(prompt) {
  if (!prompt) throw new Error('Prompt is required');

  const sessionHash = generateSessionHash();
  await joinQueue(prompt, sessionHash);
  const videoUrl = await waitForResult(sessionHash);

  return {
    status: true,
    prompt,
    videoUrl
  };
}

module.exports = {
  veo3
};
