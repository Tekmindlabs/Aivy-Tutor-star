import { User } from "@prisma/client";

declare global {
  interface UserProfile extends User {
    phoneNumber?: string | null;
    age?: number | null;
    interests?: string[];
  }
}

export {};