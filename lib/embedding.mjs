import { pipeline, env } from "@huggingface/transformers";
env.cacheDir = process.env.MODEL_CACHE || ".cache/models";
let extractor;
export async function embed(text) {
  extractor ??= pipeline("feature-extraction", "Xenova/all-MiniLM-L6-v2", {
    dtype: "q8",
  });
  const model = await extractor;
  const result = await model(text, { pooling: "mean", normalize: true });
  return Array.from(result.data);
}
export function vector(v) {
  if (v.length !== 384 || v.some((n) => !Number.isFinite(n)))
    throw Error("Invalid embedding");
  return "[" + v.join(",") + "]";
}
