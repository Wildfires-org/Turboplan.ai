import { getProfileByUserId } from "@wildfires-org/turboplan-db/queries";
import { Button, Input, Label } from "@wildfires-org/turboplan-utils";

import { auth } from "@/app/(auth)/auth";
import { ProfilePhotoUpload } from "@/components/profile-photo-upload";
import { UiScaleSection } from "@/components/settings/ui-scale-section";
import { PANEL_CLASS, PANEL_TITLE_CLASS } from "@/lib/glass";
import { cn } from "@/lib/utils";
import { updateProfileAction } from "./actions";
import { AccessTokensSection } from "./components/access-tokens-section";
import {
  PROFILE_DIVIDER_CLASS,
  PROFILE_LABEL_CLASS,
  PROFILE_SECTION_TITLE_CLASS,
  ProfilePageFrame,
} from "./components/profile-page-frame";
import { ProfileTabs } from "./components/profile-tabs";

type ProfileFieldProps = {
  id: string;
  label: string;
  placeholder: string;
  defaultValue?: string | null;
};

const ProfileField = ({
  id,
  label,
  placeholder,
  defaultValue,
}: ProfileFieldProps) => (
  <div className="space-y-1.5">
    <Label htmlFor={id} className={PROFILE_LABEL_CLASS}>
      {label}
    </Label>
    <Input
      id={id}
      name={id}
      defaultValue={defaultValue || ""}
      placeholder={placeholder}
    />
  </div>
);

export default async function ProfilePage() {
  const session = await auth();
  const userProfile = session?.user?.id
    ? await getProfileByUserId(session.user.id)
    : null;

  return (
    <ProfilePageFrame>
      <ProfileTabs
        profileContent={
          <section
            aria-labelledby="profile-information-title"
            className={PANEL_CLASS}
          >
            <h2 id="profile-information-title" className={PANEL_TITLE_CLASS}>
              Profile information
            </h2>

            <div className={cn(PROFILE_DIVIDER_CLASS, "mt-4 py-5")}>
              <ProfilePhotoUpload
                currentAvatarUrl={userProfile?.avatarUrl}
                userId={session?.user?.id}
                firstName={userProfile?.firstName}
                lastName={userProfile?.lastName}
              />
            </div>

            <form action={updateProfileAction}>
              <div className={cn(PROFILE_DIVIDER_CLASS, "space-y-1.5 py-5")}>
                <Label htmlFor="email" className={PROFILE_LABEL_CLASS}>
                  Email
                </Label>
                <Input id="email" value={session?.user?.email || ""} disabled />
              </div>

              <div className={cn(PROFILE_DIVIDER_CLASS, "py-5")}>
                <h3 className={cn(PROFILE_SECTION_TITLE_CLASS, "mb-3")}>
                  Personal information
                </h3>
                <div className="space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <ProfileField
                      id="firstName"
                      label="First Name"
                      placeholder="Enter first name"
                      defaultValue={userProfile?.firstName}
                    />
                    <ProfileField
                      id="lastName"
                      label="Last Name"
                      placeholder="Enter last name"
                      defaultValue={userProfile?.lastName}
                    />
                  </div>
                  <ProfileField
                    id="phone"
                    label="Phone"
                    placeholder="Enter phone number"
                    defaultValue={userProfile?.phone}
                  />
                </div>
              </div>

              <div className={cn(PROFILE_DIVIDER_CLASS, "py-5")}>
                <h3 className={cn(PROFILE_SECTION_TITLE_CLASS, "mb-3")}>
                  Address
                </h3>
                <div className="space-y-4">
                  <ProfileField
                    id="streetAddress"
                    label="Street Address"
                    placeholder="Enter street address"
                    defaultValue={userProfile?.streetAddress}
                  />
                  <div className="grid gap-4 sm:grid-cols-2">
                    <ProfileField
                      id="unitNumber"
                      label="Unit Number"
                      placeholder="Apt, Suite, etc."
                      defaultValue={userProfile?.unitNumber}
                    />
                    <ProfileField
                      id="city"
                      label="City or Town"
                      placeholder="Enter city"
                      defaultValue={userProfile?.city}
                    />
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <ProfileField
                      id="state"
                      label="State"
                      placeholder="Enter state"
                      defaultValue={userProfile?.state}
                    />
                    <ProfileField
                      id="zipCode"
                      label="Zip Code"
                      placeholder="Enter zip code"
                      defaultValue={userProfile?.zipCode}
                    />
                  </div>
                </div>
              </div>

              <div className={cn(PROFILE_DIVIDER_CLASS, "py-5")}>
                <h3 className={cn(PROFILE_SECTION_TITLE_CLASS, "mb-3")}>
                  Work information
                </h3>
                <div>
                  <ProfileField
                    id="jobTitle"
                    label="Job Title"
                    placeholder="Enter job title"
                    defaultValue={userProfile?.jobTitle}
                  />
                </div>
              </div>

              <div
                className={cn(PROFILE_DIVIDER_CLASS, "flex justify-end pt-4")}
              >
                <Button type="submit" variant="brand" className="h-10 px-5">
                  Save changes
                </Button>
              </div>
            </form>
          </section>
        }
        tokensContent={<AccessTokensSection />}
        appearanceContent={<UiScaleSection />}
      />
    </ProfilePageFrame>
  );
}
