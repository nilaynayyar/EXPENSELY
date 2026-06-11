import { NextResponse } from "next/server";
import os from "os";

export async function GET() {
  const interfaces = os.networkInterfaces();
  let lanIp = "localhost";

  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name] ?? []) {
      // Skip internal (loopback) and non-IPv4 addresses
      if (!iface.internal && iface.family === "IPv4") {
        lanIp = iface.address;
        break;
      }
    }
    if (lanIp !== "localhost") break;
  }

  return NextResponse.json({ ip: lanIp });
}
