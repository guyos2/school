// Text-to-speech using the device's built-in voices: English, and Hebrew for dictation.
export const canSpeak = typeof window !== 'undefined' && 'speechSynthesis' in window;

let voice = null;
let heVoice = null;
// The English voice chosen on the settings page. Voices differ per device, so the choice is kept on this device only.
const VOICE_KEY = 'school:v1:enVoice';
export function chosenVoice() {
  try { return localStorage.getItem(VOICE_KEY) || ''; } catch { return ''; }
}
export function chooseVoice(name) {
  try { name ? localStorage.setItem(VOICE_KEY, name) : localStorage.removeItem(VOICE_KEY); } catch { /* blocked storage */ }
  pickVoice();
}
// English voices on this device, American first.
export function englishVoices() {
  if (!canSpeak) return [];
  const rank = (v) => (/en[-_]US/i.test(v.lang) ? 0 : 1);
  return speechSynthesis.getVoices().filter((v) => /^en[-_]/i.test(v.lang))
    .sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name));
}
function pickVoice() {
  const voices = speechSynthesis.getVoices();
  heVoice = voices.find((v) => /^(he|iw)[-_]?/i.test(v.lang)) || null;
  const en = voices.filter((v) => /^en[-_]/i.test(v.lang));
  const mine = chosenVoice();
  voice = (mine && en.find((v) => v.name === mine)) || autoVoice(en);
}
// The voice used when none was chosen: a familiar American voice, else any American one, else any English one.
function autoVoice(en = englishVoices()) {
  return en.find((v) => /en[-_]US/i.test(v.lang) && /Samantha|Google US|Aria|Jenny|Ava|Allison/i.test(v.name))
    || en.find((v) => /en[-_]US/i.test(v.lang)) || en[0] || null;
}
export const autoVoiceName = () => (canSpeak ? autoVoice()?.name ?? '' : '');
if (canSpeak) {
  pickVoice();
  speechSynthesis.addEventListener?.('voiceschanged', pickVoice);
}

let gen = 0;

// English is read slower for a kid who is just starting the language (kids.json `enRate`, e.g. 0.7):
// every English rate is multiplied by it, and the pauses between parts grow to match.
let enScale = 1;
export function setEnglishPace(scale = 1) { enScale = scale; }

// A "|" in the text marks a pause: each part is spoken fully before the next
// starts, so a letter name and its example word (e.g. "A.|apple") stay distinct
// instead of running together. myGen guards against a stale chain still
// waiting on its pause after a newer say() has taken over.
function speakParts(parts, rate, myGen, lang = 'en-US', enVoice = voice) {
  const [first, ...rest] = parts;
  if (first === undefined || myGen !== gen) return;
  const u = new SpeechSynthesisUtterance(first);
  u.lang = lang;
  const v = lang === 'he-IL' ? heVoice : enVoice;
  if (v) u.voice = v;
  u.rate = rate;
  if (rest.length) u.onend = () => setTimeout(() => speakParts(rest, rate, myGen, lang, enVoice), lang === 'he-IL' ? 1200 : Math.round(500 / enScale));
  speechSynthesis.speak(u);
}

// `voiceName` reads with another English voice this once (the settings page uses it for samples).
export function say(text, { rate = 0.7, voiceName } = {}) {
  if (!canSpeak || !text) return;
  speechSynthesis.cancel();
  gen++;
  const v = (voiceName && englishVoices().find((x) => x.name === voiceName)) || voice;
  speakParts(text.split('|').map((s) => s.trim()).filter(Boolean), rate * enScale, gen, 'en-US', v);
}

// Many desktops have no Hebrew voice; then an adult reads the words aloud instead.
export function hasHebrewVoice() {
  if (!canSpeak) return false;
  if (!heVoice) pickVoice();
  return !!heVoice;
}

export function sayHe(text, { rate = 0.8 } = {}) {
  if (!hasHebrewVoice() || !text) return;
  speechSynthesis.cancel();
  gen++;
  speakParts(text.split('|').map((s) => s.trim()).filter(Boolean), rate, gen, 'he-IL');
}

// Speaks one Hebrew line and calls onend when it is done (not at all if a newer line took over). Returns false without a voice.
export function speakHe(text, { rate = 0.85, onend } = {}) {
  if (!hasHebrewVoice() || !text) return false;
  speechSynthesis.cancel();
  const myGen = ++gen;
  const u = new SpeechSynthesisUtterance(text);
  u.lang = 'he-IL';
  u.voice = heVoice;
  u.rate = rate;
  u.onend = () => { if (myGen === gen) onend?.(); };
  speechSynthesis.speak(u);
  return true;
}

export function stopSpeech() {
  gen++;
  if (canSpeak) speechSynthesis.cancel();
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
