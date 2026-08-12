import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

async function verifyAdmin(req: Request) {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return false;
  const token = authHeader.replace("Bearer ", "");
  
  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !user) return false;

  const adminEmails = (process.env.NEXT_PUBLIC_ADMIN_EMAILS || "").split(",");
  return adminEmails.includes(user.email || "");
}

export async function GET(req: Request, { params }: { params: Promise<{ userId: string }> }) {
  if (!(await verifyAdmin(req))) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  
  const { userId } = await params;
  if (!userId) {
    return NextResponse.json({ success: false, error: "Missing userId" }, { status: 400 });
  }

  try {
    const [
      appStateRes,
      templatesRes,
      recipientsRes,
      executionLogsRes,
      sentLogsRes
    ] = await Promise.all([
      supabaseAdmin.from("automailsend_app_state").select("*").eq("user_id", userId).single(),
      supabaseAdmin.from("automailsend_templates").select("*").eq("user_id", userId),
      supabaseAdmin.from("automailsend_recipients").select("*").eq("user_id", userId).order("created_at", { ascending: false }).limit(200),
      supabaseAdmin.from("automailsend_execution_logs").select("*").eq("user_id", userId).order("created_at", { ascending: false }).limit(200),
      supabaseAdmin.from("automailsend_sent_log").select("*").eq("user_id", userId).order("created_at", { ascending: false }).limit(200)
    ]);

    const data = {
      app_state: appStateRes.data || {},
      templates: templatesRes.data || [],
      recipients: recipientsRes.data || [],
      execution_logs: executionLogsRes.data || [],
      sent_logs: sentLogsRes.data || []
    };

    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
