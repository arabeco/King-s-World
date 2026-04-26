import { redirect } from "next/navigation";

export default function OperationsPage({
  params,
  searchParams,
}: {
  params: { worldId: string };
  searchParams: { v?: string; m?: string; sb?: string; b?: string };
}) {
  const paramsString = new URLSearchParams();
  if (searchParams.v) paramsString.set("v", searchParams.v);
  if (searchParams.m) paramsString.set("m", searchParams.m);
  if (searchParams.sb) paramsString.set("sb", searchParams.sb);
  if (searchParams.b) paramsString.set("b", searchParams.b);
  redirect(`/world/${params.worldId}/intelligence?${paramsString.toString()}`);
}
