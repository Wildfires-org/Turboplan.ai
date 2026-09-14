import { getProfileByUserId } from "@wildfires-org/turboplan-db/queries";
import { Button, Input, Label } from "@wildfires-org/turboplan-utils";

import { auth } from "@/app/(auth)/auth";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { ProfilePhotoUpload } from "@/components/profile-photo-upload";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { updateProfileAction } from "./actions";
import { AccessTokensSection } from "./components/access-tokens-section";
import { ProfileTabs } from "./components/profile-tabs";

export default async function ProfilePage() {
  const session = await auth();
  const userProfile = session?.user?.id
    ? await getProfileByUserId(session.user.id)
    : null;

  const breadcrumbs = [{ label: "Profile", isActive: true }];

  return (
    <div className="flex flex-col shrink-0 min-h-screen">
      <DashboardHeader breadcrumbs={breadcrumbs} />
      <div className="flex-1 container mx-auto p-6">
        <div className="max-w-6xl mx-auto">
          <ProfileTabs
            profileContent={
              <Card>
                <CardHeader>
                  <CardTitle>Profile Information</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="mb-8 pb-6 border-b border-slate-600">
                    <ProfilePhotoUpload
                      currentAvatarUrl={userProfile?.avatarUrl}
                      userId={session?.user?.id!}
                      firstName={userProfile?.firstName}
                      lastName={userProfile?.lastName}
                    />
                  </div>

                  <form action={updateProfileAction} className="space-y-6">
                    <div>
                      <Label htmlFor="email" className="text-sm font-medium">
                        Email
                      </Label>
                      <Input
                        id="email"
                        value={session?.user?.email || ""}
                        disabled
                        className="mt-1"
                      />
                    </div>

                    <div>
                      <h3 className="text-lg font-semibold mb-3">
                        Personal Information
                      </h3>
                      <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <Label
                              htmlFor="firstName"
                              className="text-sm font-medium"
                            >
                              First Name
                            </Label>
                            <Input
                              id="firstName"
                              name="firstName"
                              defaultValue={userProfile?.firstName || ""}
                              placeholder="Enter first name"
                              className="mt-1"
                            />
                          </div>
                          <div>
                            <Label
                              htmlFor="lastName"
                              className="text-sm font-medium"
                            >
                              Last Name
                            </Label>
                            <Input
                              id="lastName"
                              name="lastName"
                              defaultValue={userProfile?.lastName || ""}
                              placeholder="Enter last name"
                              className="mt-1"
                            />
                          </div>
                        </div>
                        <div>
                          <Label
                            htmlFor="phone"
                            className="text-sm font-medium"
                          >
                            Phone
                          </Label>
                          <Input
                            id="phone"
                            name="phone"
                            defaultValue={userProfile?.phone || ""}
                            placeholder="Enter phone number"
                            className="mt-1"
                          />
                        </div>
                      </div>
                    </div>

                    <div>
                      <h3 className="text-lg font-semibold mb-3">Address</h3>
                      <div className="space-y-4">
                        <div>
                          <Label
                            htmlFor="streetAddress"
                            className="text-sm font-medium"
                          >
                            Street Address
                          </Label>
                          <Input
                            id="streetAddress"
                            name="streetAddress"
                            defaultValue={userProfile?.streetAddress || ""}
                            placeholder="Enter street address"
                            className="mt-1"
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <Label
                              htmlFor="unitNumber"
                              className="text-sm font-medium"
                            >
                              Unit Number
                            </Label>
                            <Input
                              id="unitNumber"
                              name="unitNumber"
                              defaultValue={userProfile?.unitNumber || ""}
                              placeholder="Apt, Suite, etc."
                              className="mt-1"
                            />
                          </div>
                          <div>
                            <Label
                              htmlFor="city"
                              className="text-sm font-medium"
                            >
                              City or Town
                            </Label>
                            <Input
                              id="city"
                              name="city"
                              defaultValue={userProfile?.city || ""}
                              placeholder="Enter city"
                              className="mt-1"
                            />
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <Label
                              htmlFor="state"
                              className="text-sm font-medium"
                            >
                              State
                            </Label>
                            <Input
                              id="state"
                              name="state"
                              defaultValue={userProfile?.state || ""}
                              placeholder="Enter state"
                              className="mt-1"
                            />
                          </div>
                          <div>
                            <Label
                              htmlFor="zipCode"
                              className="text-sm font-medium"
                            >
                              Zip Code
                            </Label>
                            <Input
                              id="zipCode"
                              name="zipCode"
                              defaultValue={userProfile?.zipCode || ""}
                              placeholder="Enter zip code"
                              className="mt-1"
                            />
                          </div>
                        </div>
                      </div>
                    </div>

                    <div>
                      <h3 className="text-lg font-semibold mb-3">
                        Work Information
                      </h3>
                      <div>
                        <Label
                          htmlFor="jobTitle"
                          className="text-sm font-medium"
                        >
                          Job Title
                        </Label>
                        <Input
                          id="jobTitle"
                          name="jobTitle"
                          defaultValue={userProfile?.jobTitle || ""}
                          placeholder="Enter job title"
                          className="mt-1"
                        />
                      </div>
                    </div>

                    <div className="pt-4">
                      <Button type="submit" className="w-full">
                        Save Changes
                      </Button>
                    </div>
                  </form>
                </CardContent>
              </Card>
            }
            tokensContent={<AccessTokensSection />}
          />
        </div>
      </div>
    </div>
  );
}
