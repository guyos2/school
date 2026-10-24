// English text-to-speech using the device's built-in voices.
export const canSpeak = typeof window !== 'undefined' && 'speechSynthesis' in window;

let voice = null;
function pickVoice() {
  const voices = speechSynthesis.getVoices();
  const en = voices.filter((v) => /^en[-_]/i.test(v.lang));
  voice = en.find((v) => /en[-_]US/i.test(v.lang) && /Samantha|Google US|Aria|Jenny|Ava|Allison/i.test(v.name))
    || en.find((v) => /en[-_]US/i.test(v.lang)) || en[0] || null;
}
if (canSpeak) {
  pickVoice();
  speechSynthesis.addEventListener?.('voiceschanged', pickVoice);
}

let gen = 0;

// A "|" in the text marks a pause: each part is spoken fully before the next
// starts, so a letter name and its example word (e.g. "A.|apple") stay distinct
// instead of running together. myGen guards against a stale chain still
// waiting on its pause after a newer say() has taken over.
function speakParts(parts, rate, myGen) {
  const [first, ...rest] = parts;
  if (first === undefined || myGen !== gen) return;
  const u = new SpeechSynthesisUtterance(first);
  u.lang = 'en-US';
  if (voice) u.voice = voice;
  u.rate = rate;
  if (rest.length) u.onend = () => setTimeout(() => speakParts(rest, rate, myGen), 500);
  speechSynthesis.speak(u);
}

export function say(text, { rate = 0.7 } = {}) {
  if (!canSpeak || !text) return;
  speechSynthesis.cancel();
  gen++;
  speakParts(text.split('|').map((s) => s.trim()).filter(Boolean), rate, gen);
}

export const speakBtn = (text, label = '🔊', ariaLabel = 'השמעה') =>
  canSpeak ? `<button class="speak" data-say="${text.replace(/"/g, '&quot;')}" aria-label="${ariaLabel}">${label}</button>` : '';

// One delegated listener per screen container handles every speakBtn inside it.
export function wireSpeakButtons(container) {
  container.addEventListener('click', (e) => {
    const b = e.target.closest('[data-say]');
    if (b) say(b.dataset.say);
  });
}
