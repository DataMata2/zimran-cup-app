import { Button } from "@/components/ui/button";
import { startGuest } from "@/app/actions";

export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 px-4 py-24 text-center">
      <p className="text-sm font-medium text-muted-foreground">Placeholder</p>
      <h1 className="max-w-xl text-4xl font-semibold tracking-tight">Placeholder headline for the product</h1>
      <p className="max-w-md text-muted-foreground">One-line placeholder description of what the product does.</p>
      <form action={startGuest}>
        <Button type="submit" size="lg">
          Try it (no sign-up)
        </Button>
      </form>
    </main>
  );
}
