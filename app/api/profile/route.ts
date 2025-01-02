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
    
    // Update validation to handle all fields
    const validatedData = {
      name: data.name,
      phoneNumber: data.phoneNumber || null,
      age: data.age ? parseInt(data.age) : null,
    };

    const updatedUser = await prisma.user.update({
      where: { email: session.user.email },
      data: validatedData,
    });

    return new Response(JSON.stringify(updatedUser), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error("Profile update error:", error);
    return new Response(JSON.stringify({ error: "Error updating profile" }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}