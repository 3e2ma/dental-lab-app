import { promises as fs } from "fs";
import path from "path";
import { Redis } from "@upstash/redis";
import { SEED_ITEMS } from "./seedItems";

// 価格表（項目マスタ）の読み書き。
//
// 【仕組み】
// Vercelの「Storage」タブから Upstash Redis を接続すると、環境変数
// （KV_REST_API_URL / KV_REST_API_TOKEN、または UPSTASH_REDIS_REST_URL /
// UPSTASH_REDIS_REST_TOKEN）が自動的に設定されます。これらが存在する
// 場合は Redis に保存するので、全ユーザーで確実に共有・永続化されます。
//
// これらの環境変数が無い場合（ローカル開発時など）は、代わりに
// data/items.json というファイルへ読み書きします。これはローカルでは
// 問題なく動きますが、Vercelなどのサーバーレス環境では永続化されない
// ため、本番運用では必ずRedisを接続してください（README参照）。

const REDIS_KEY = "dental-invoice:items";

function getRedis() {
  const url =
    process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token =
    process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  return new Redis({ url, token });
}

const DATA_DIR = path.join(process.cwd(), "data");
const DATA_FILE = path.join(DATA_DIR, "items.json");

async function readItemsFromFile() {
  try {
    const raw = await fs.readFile(DATA_FILE, "utf-8");
    const data = JSON.parse(raw);
    if (Array.isArray(data.items) && data.items.length > 0) {
      return data.items;
    }
  } catch (e) {
    // ファイルがまだ無い場合などは初期データにフォールバック
  }
  return SEED_ITEMS;
}

async function writeItemsToFile(items) {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(
    DATA_FILE,
    JSON.stringify({ items, updatedAt: new Date().toISOString() }, null, 2),
    "utf-8"
  );
}

export async function readItems() {
  const redis = getRedis();
  if (redis) {
    try {
      const items = await redis.get(REDIS_KEY);
      if (Array.isArray(items) && items.length > 0) return items;
    } catch (e) {
      console.error("Redisからの読み込みに失敗しました", e);
    }
    return SEED_ITEMS;
  }
  return readItemsFromFile();
}

export async function writeItems(items) {
  const redis = getRedis();
  if (redis) {
    await redis.set(REDIS_KEY, items);
    return;
  }
  await writeItemsToFile(items);
}

export function isUsingRedis() {
  return getRedis() !== null;
}
