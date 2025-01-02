"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { User } from "@prisma/client";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/use-toast";

// Extend the User type to include the additional properties
interface ExtendedUser extends User {
  phoneNumber?: string;
  age?: number;
  interests?: string[];
}

interface ProfileEditFormProps {
  user: ExtendedUser;
  onComplete: () => void;
}

// Define a schema for the form
const profileSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  phoneNumber: z.string().optional(),
  age: z.number().min(13, "Must be at least 13 years old").optional(),
});

type ProfileFormValues = z.infer<typeof profileSchema>;

export function ProfileEditForm({ user, onComplete }: ProfileEditFormProps) {
  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      name: user.name || "",
      phoneNumber: user.phoneNumber || "",
      age: user.age || undefined,
    },
  });

  async function onSubmit(data: ProfileFormValues) {
    try {
      const response = await fetch("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!response.ok) throw new Error("Failed to update profile");

      toast({
        title: "Profile updated",
        description: "Your profile has been successfully updated.",
      });
      onComplete();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update profile. Please try again.",
        variant: "destructive",
      });
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Name</FormLabel>
              <FormControl>
                <Input {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="phoneNumber"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Phone Number</FormLabel>
              <FormControl>
                <Input {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="age"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Age</FormLabel>
              <FormControl>
                <Input
                  type="number"
                  {...field}
                  value={field.value || ""}
                  onChange={(e) => {
                    const value = e.target.value;
                    field.onChange(value ? parseInt(value) : undefined);
                  }}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit">Save Changes</Button>
      </form>
    </Form>
  );
}