import { eq } from "drizzle-orm";

import { db } from "../db-client";
import { type Profile, profile, UserRole, user } from "../schemas";

export async function getProfileByUserId(
  userId: string,
): Promise<Profile | null> {
  try {
    const [userProfile] = await db
      .select()
      .from(profile)
      .where(eq(profile.userId, userId));
    return userProfile || null;
  } catch (error) {
    console.error("Failed to get profile from database");
    throw error;
  }
}

export async function createProfile({
  userId,
  firstName,
  lastName,
  phone,
  city,
  streetAddress,
  unitNumber,
  state,
  zipCode,
  avatarUrl,
  jobTitle,
  userRole,
}: {
  userId: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  city?: string;
  streetAddress?: string;
  unitNumber?: string;
  state?: string;
  zipCode?: string;
  avatarUrl?: string | null;
  jobTitle?: string;
  userRole?: UserRole;
}) {
  try {
    const now = new Date();
    return await db.insert(profile).values({
      userId,
      firstName,
      lastName,
      phone,
      city,
      streetAddress,
      unitNumber,
      state,
      zipCode,
      avatarUrl,
      jobTitle,
      userRole,
      createdAt: now,
      updatedAt: now,
    });
  } catch (error) {
    console.error("Failed to create profile in database");
    throw error;
  }
}

export async function updateProfile({
  userId,
  firstName,
  lastName,
  phone,
  city,
  streetAddress,
  unitNumber,
  state,
  zipCode,
  avatarUrl,
  jobTitle,
  userRole,
}: {
  userId: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  city?: string;
  streetAddress?: string;
  unitNumber?: string;
  state?: string;
  zipCode?: string;
  avatarUrl?: string | null;
  jobTitle?: string;
  userRole?: UserRole;
}) {
  try {
    return await db
      .update(profile)
      .set({
        firstName,
        lastName,
        phone,
        city,
        streetAddress,
        unitNumber,
        state,
        zipCode,
        avatarUrl,
        jobTitle,
        userRole,
        updatedAt: new Date(),
      })
      .where(eq(profile.userId, userId));
  } catch (error) {
    console.error("Failed to update profile in database");
    throw error;
  }
}

export async function getUserWithProfile(userId: string) {
  try {
    const result = await db
      .select({
        user: user,
        profile: profile,
      })
      .from(user)
      .leftJoin(profile, eq(user.id, profile.userId))
      .where(eq(user.id, userId));

    return result[0] || null;
  } catch (error) {
    console.error("Failed to get user with profile from database");
    throw error;
  }
}

// Type exports for profile operations
export interface CreateProfileRequest {
  userId: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  city?: string;
  streetAddress?: string;
  unitNumber?: string;
  state?: string;
  zipCode?: string;
  avatarUrl?: string;
  jobTitle?: string;
  userRole?: UserRole;
}

export interface UpdateProfileRequest {
  userId: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  city?: string;
  streetAddress?: string;
  unitNumber?: string;
  state?: string;
  zipCode?: string;
  avatarUrl?: string;
  jobTitle?: string;
  userRole?: UserRole;
}

export interface UserWithProfile {
  user: {
    id: string;
    email: string;
    emailVerified: Date | null;
  };
  profile: Profile | null;
}
