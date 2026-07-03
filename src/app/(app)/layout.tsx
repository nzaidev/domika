import { ClerkProvider } from "@clerk/nextjs";
import { esES } from "@clerk/localizations";
import { DomikaAppShell } from "@/components/domika/DomikaAppShell";

export default function ProtectedAppLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider localization={esES}>
      <DomikaAppShell>{children}</DomikaAppShell>
    </ClerkProvider>
  );
}
