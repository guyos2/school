import { handle } from './_server.js';

// Reading a photo of a handwritten page can take a while.
export const maxDuration = 120;

export const POST = (req) => handle(req);
