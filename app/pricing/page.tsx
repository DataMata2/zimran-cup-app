import { redirect } from "next/navigation";

// The product lives at /plan; this path is kept as a redirect for old links.
export default function Page() {
  redirect("/plan");
}
