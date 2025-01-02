import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { userDetailsSchema } from "@/lib/validations/onboarding";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const body = await req.json();
    const validatedData = userDetailsSchema.parse(body);

    await prisma.user.update({
      where: { id: session.user.id },
      data: {
        ...validatedData,
        onboarded: true,
      },
    });

    return new NextResponse("OK", { status: 200 });
  } catch (error) {
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}