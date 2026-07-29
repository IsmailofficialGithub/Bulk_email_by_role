import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const { liAt, jsessionid } = await req.json();

    if (!liAt || !jsessionid) {
      return NextResponse.json(
        { success: false, error: "Missing LinkedIn cookies" },
        { status: 400 }
      );
    }

    // Ping LinkedIn Voyager API to verify cookies are valid
    const res = await fetch("https://www.linkedin.com/voyager/api/me", {
      method: "GET",
      headers: {
        "csrf-token": jsessionid.replace(/"/g, ''), // sometimes JSESSIONID has quotes
        "cookie": `li_at=${liAt}; JSESSIONID=${jsessionid}`,
        "accept": "application/vnd.linkedin.normalized+json+2.1",
      },
    });

    if (res.ok || res.status === 200) {
      return NextResponse.json({ success: true });
    } else {
      // Typically returns 401 if unauthorized
      return NextResponse.json(
        { success: false, error: "Invalid or expired LinkedIn cookies" },
        { status: 401 }
      );
    }
  } catch (error) {
    console.error("LinkedIn verification error:", error);
    return NextResponse.json(
      { success: false, error: "Network error verifying cookies" },
      { status: 500 }
    );
  }
}
