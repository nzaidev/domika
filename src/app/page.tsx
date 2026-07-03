import { DomikaWireframePrototype } from "./DomikaWireframePrototype";

const variants = ["command", "pipeline", "exchange"] as const;

type Variant = (typeof variants)[number];

function resolveVariant(value: string | string[] | undefined): Variant {
  const candidate = Array.isArray(value) ? value[0] : value;

  if (candidate && variants.includes(candidate as Variant)) {
    return candidate as Variant;
  }

  return "command";
}

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ variant?: string | string[] | undefined }>;
}) {
  const query = await searchParams;
  const variant = resolveVariant(query.variant);

  return <DomikaWireframePrototype activeVariant={variant} />;
}
