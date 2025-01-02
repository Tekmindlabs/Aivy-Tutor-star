import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { userDetailsSchema } from "@/lib/validations/onboarding";

export async function PUT(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return new Response("Unauthorized", { status: 401 });
    }

    const data = await req.json();
    
    // Add validation
    if (!data.name) {
      return new Response(JSON.stringify({ error: "Name is required" }), { 
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Log the data before update
    console.log("Updating user with data:", validatedData);

    const updatedUser = await prisma.user.update({
      where: { email: session.user.email },
      data: validatedData,
    });

    return new Response(JSON.stringify(updatedUser), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error("Detailed profile update error:", error);
    return new Response(JSON.stringify({ 
      error: "Error updating profile",
      details: error.message 
    }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}