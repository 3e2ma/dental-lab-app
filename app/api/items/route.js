import { NextResponse } from "next/server";
import { readItems, writeItems, isUsingRedis } from "@/lib/store";

// 常に最新のファイル内容を読みに行く（キャッシュしない）
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const items = await readItems();
    return NextResponse.json({ items, persistent: isUsingRedis() });
  } catch (e) {
    return NextResponse.json(
      { error: "価格表の読み込みに失敗しました" },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    if (!Array.isArray(body.items)) {
      return NextResponse.json(
        { error: "items は配列で送ってください" },
        { status: 400 }
      );
    }
    await writeItems(body.items);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      { error: "価格表の保存に失敗しました" },
      { status: 500 }
    );
  }
}
