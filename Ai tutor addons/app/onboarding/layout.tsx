import { auth } from "@/auth";
import { redirect } from "next/navigation";

export default async function OnboardingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  
  if (!session) {
    redirect("/api/auth/signin");
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-white to-gray-100 dark:from-gray-900 dark:to-black">
      <main className="container mx-auto px-4 py-8">
        {children}
      </main>
    </div>
  );
}