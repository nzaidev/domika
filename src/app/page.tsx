import { redirect } from "next/navigation";

// The home page is the dashboard. (The root is auth-protected in proxy.ts, so
// signed-out visitors are sent to /sign-in before this runs.)
export default function Home() {
  redirect("/dashboard");
}
