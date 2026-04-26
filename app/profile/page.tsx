import { ProfileClient } from "@/components/profile-client";
import { requireAuthenticatedAppUser } from "@/lib/app-user";
import { listWorldSummaries } from "@/lib/world-data";

export default async function ProfilePage() {
  const [worlds, appUser] = await Promise.all([
    listWorldSummaries(),
    requireAuthenticatedAppUser(),
  ]);

  return (
    <ProfileClient
      initialUsername={appUser.username}
      globalScore={0}
      medals={[]}
      history={[]}
      worlds={worlds}
    />
  );
}
