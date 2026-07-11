import { ClerkProvider } from "@clerk/nextjs";
import { esES } from "@clerk/localizations";
import { DomikaAppShell } from "@/components/domika/DomikaAppShell";
import { getUnreadNotificationCount } from "@/lib/domain/notifications";

export default async function ProtectedAppLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const unreadNotifications = await getUnreadNotificationCount().catch(() => 0);

  return (
    <ClerkProvider localization={esES}>
      <DomikaAppShell unreadNotifications={unreadNotifications}>
        {children}
      </DomikaAppShell>
    </ClerkProvider>
  );
}
