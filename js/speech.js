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

export function say(text, { rate = 0.8 } = {}) {
  if (!canSpeak || !text) return;
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = 'en-US';
  if (voice) u.voice = voice;
  u.rate = rate;
  speechSynthesis.speak(u);
}

// A letter on its own ("A") is often read as a word; a period makes engines say the letter name.
export const sayLetter = (l) => say(`${l.toUpperCase()}.`, { rate: 0.7 });

export const speakBtn = (text, label = '🔊') =>
  canSpeak ? `<button class="speak" data-say="${text.replace(/"/g, '&quot;')}" aria-label="השמעה">${label}</button>` : '';

// One delegated listener per screen container handles every speakBtn inside it.
export function wireSpeakButtons(container) {
  container.addEventListener('click', (e) => {
    const b = e.target.closest('[data-say]');
    if (b) say(b.dataset.say);
  });
}
