import { WorldProfileClient } from "@/components/world-profile-client";
import { requireAuthenticatedAppUser } from "@/lib/app-user";

export default async function GuidePage({
  params,
}: {
  params: { worldId: string };
}) {
  const appUser = await requireAuthenticatedAppUser();

  return <WorldProfileClient worldId={params.worldId} username={appUser.username} />;
}
