import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

export async function GET() {
  try {
    const supabase = await createClient();
    const { error } = await supabase
      .from("organizations")
      .select("id", { count: "exact", head: true });

    if (error) {
      return NextResponse.json(
        {
          ok: false,
          message: "Supabase에는 연결됐지만 B.SORI 스키마를 확인하지 못했습니다.",
          detail: error.message,
        },
        { status: 503 },
      );
    }

    return NextResponse.json({
      ok: true,
      message: "Supabase 연결과 B.SORI 데이터베이스 스키마가 정상입니다.",
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message: "Supabase 환경변수 또는 연결 설정을 확인하세요.",
        detail: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
