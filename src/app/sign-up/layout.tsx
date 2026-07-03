import { ClerkProvider } from "@clerk/nextjs";
import { esES } from "@clerk/localizations";

export default function SignUpLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <ClerkProvider localization={esES}>{children}</ClerkProvider>;
}
