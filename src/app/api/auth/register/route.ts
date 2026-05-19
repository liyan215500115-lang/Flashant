import "server-only";

import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";

export async function POST(req: Request) {
  const { email, name, password } = await req.json();

  if (!email || !password) {
    return NextResponse.json(
      { error: "email and password are required" },
      { status: 400 }
    );
  }

  if (password.length < 6) {
    return NextResponse.json(
      { error: "password too short" },
      { status: 400 }
    );
  }

  // Check existing
  const existing = await db.user.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json(
      { error: "email already registered" },
      { status: 409 }
    );
  }

  const hashed = await bcrypt.hash(password, 10);

  const user = await db.user.create({
    data: {
      email,
      name: name || email.split("@")[0],
      password: hashed,
      emailVerified: new Date(), // auto-verify for credentials
    },
    select: { id: true, name: true, email: true, role: true },
  });

  return NextResponse.json({ user }, { status: 201 });
}
