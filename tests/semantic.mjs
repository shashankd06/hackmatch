import assert from "node:assert/strict";
import { embed, vector } from "../lib/embedding.mjs";
const [q, relevant, unrelated] = await Promise.all([
  embed("NLP developer for text classification and spam detection"),
  embed(
    "Python PyTorch transformers natural language processing phishing message classification",
  ),
  embed("Figma designer for travel posters and illustrations"),
]);
assert.equal(q.length, 384);
assert.doesNotThrow(() => vector(q));
const dot = (a, b) => a.reduce((s, v, i) => s + v * b[i], 0);
assert.ok(Math.abs(dot(q, q) - 1) < 0.001);
assert.ok(dot(q, relevant) > dot(q, unrelated));
console.log(
  "PASS: 384 dimensions, normalized vector, NLP profile ranks above unrelated design profile.",
);
