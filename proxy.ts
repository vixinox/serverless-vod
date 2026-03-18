import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";

export async function proxy(request: NextRequest) {
    const { pathname } = request.nextUrl;

    const session = await auth.api.getSession({
        headers: request.headers,
    });

    if (!session) {
        return NextResponse.redirect(new URL("/login", request.url));
    }

    if (pathname === "/studio" || pathname === "/studio/") {
        return NextResponse.redirect(new URL("/studio/contents", request.url));
    }

    return NextResponse.next();
}

export const config = {
    matcher: ["/studio/:path*"],
};
