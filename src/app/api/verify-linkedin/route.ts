import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const { liAt, jsessionid, rawHeaders } = await req.json();

    if (!liAt || !jsessionid) {
      return NextResponse.json(
        { success: false, error: "Missing LinkedIn cookies" },
        { status: 400 }
      );
    }

    let fetchHeaders: any = {
      "csrf-token": jsessionid.replace(/"/g, ''),
      "cookie": `li_at=${liAt}; JSESSIONID=${jsessionid}`,
      "accept": "application/vnd.linkedin.normalized+json+2.1",
      "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    };

    if (rawHeaders) {
      try {
        const parsed = JSON.parse(rawHeaders);
        fetchHeaders = { ...parsed };
        
        // Ensure critical ones are correct
        fetchHeaders["csrf-token"] = jsessionid.replace(/"/g, '');
        // We do not overwrite Cookie entirely, but ensure li_at and JSESSIONID are in it
        if (fetchHeaders["Cookie"]) {
           if (!fetchHeaders["Cookie"].includes("li_at=")) {
             fetchHeaders["Cookie"] += `; li_at=${liAt}`;
           }
        } else {
           fetchHeaders["cookie"] = `li_at=${liAt}; JSESSIONID=${jsessionid}`;
        }
      } catch (e) {
        // use defaults if parse fails
      }
    }

    // Ping LinkedIn Voyager API to verify cookies are valid
    const res = await fetch("https://www.linkedin.com/voyager/api/me", {
      method: "GET",
      headers: fetchHeaders,
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
  } catch (error: any) {
    console.error("LinkedIn verification error:", error);
    return NextResponse.json(
      { success: false, error: `Network error: ${error?.message || 'Failed to verify cookies'}` },
      { status: 500 }
    );
  }
}
