import { WorldProfileClient } from "@/components/world-profile-client";
import { requireAuthenticatedAppUser } from "@/lib/app-user";
import { getWorldPayload } from "@/lib/world-data";

export default async function GuidePage({
  params,
}: {
  params: { worldId: string };
}) {
  const { world } = await getWorldPayload(params.worldId);
  const appUser = await requireAuthenticatedAppUser();

  return <WorldProfileClient worldId={params.worldId} world={world} villages={world.villages} username={appUser.username} />;
}
