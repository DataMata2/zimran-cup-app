import Link from "next/link";

/** Slim strip on top of the example persona's plan. */
export function ExampleBanner() {
  return (
    <div className="border-b border-amber-mid/40 bg-amber-soft">
      <p className="mx-auto w-full max-w-6xl px-4 py-2.5 text-sm text-ink sm:px-6">
        You&rsquo;re viewing an example.{" "}
        <Link href="/start" className="font-semibold text-accent underline underline-offset-4 hover:text-accent-hover">
          Start with your own numbers →
        </Link>
      </p>
    </div>
  );
}
