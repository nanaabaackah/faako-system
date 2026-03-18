// node 18+, ESM or adapt to commonjs
import OpenAI from "openai";

// eslint-disable-next-line no-undef
export const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });