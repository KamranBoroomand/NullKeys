import { buildPageMetadata } from "@/app/metadata";
import { BenchmarkScreen } from "@/features/benchmark-mode/benchmark-screen";

export const metadata = buildPageMetadata(
  "Typing Test",
  "Run repeatable local typing tests with fixed conditions, replay, and detailed review graphs.",
  "/typing-test",
);

export default function TypingTestPage() {
  return <BenchmarkScreen />;
}
