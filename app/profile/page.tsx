import { ProfileClient } from "@/components/profile-client";
import { requireAuthenticatedAppUser } from "@/lib/app-user";


export default async function ProfilePage() {
  const appUser = await requireAuthenticatedAppUser();

  return (
    <ProfileClient
      initialUsername={appUser.username}
    />
  );
}
