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
    const validatedData = userDetailsSchema
      .pick({ name: true, phoneNumber: true, age: true })
      .parse(data);

    const updatedUser = await prisma.user.update({
      where: { email: session.user.email },
      data: validatedData,
    });

    return new Response(JSON.stringify(updatedUser));
  } catch (error) {
    return new Response("Error updating profile", { status: 500 });
  }
}