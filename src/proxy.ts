import { NextResponse, type NextRequest } from "next/server";

// Bu proxy yalnız kaba yönlendirme yapar (oturum çerezi var mı?).
// Rol/organizasyon bazlı gerçek yetki kontrolü her sayfanın kendi server
// component'inde src/lib/auth/guards.ts (requireUser/requireStaff) ile
// yapılır — "menüde görünmüyor" güvenlik sayılmaz.
const COOKIE_NAME = "bb_session";

export function proxy(request: NextRequest) {
  const hasSession = request.cookies.has(COOKIE_NAME);

  if (!hasSession) {
    const loginUrl = new URL("/giris", request.url);
    loginUrl.searchParams.set("next", request.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/uye/:path*", "/personel/:path*"],
};
