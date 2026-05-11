import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const { passphrase } = await request.json()

    // Validate passphrase
    const correctPassphrase = process.env.APP_PASSPHRASE

    if (!correctPassphrase) {
      console.warn("APP_PASSPHRASE is not set in environment variables.")
      // If not set, we might want to either block access or allow it (dev mode). Let's block it for security.
      return NextResponse.json(
        { success: false, error: "Server configuration error" },
        { status: 500 }
      )
    }

    if (process.env.NODE_ENV !== 'development' && passphrase !== correctPassphrase) {
      return NextResponse.json(
        { success: false, error: "Invalid passphrase" },
        { status: 401 }
      )
    }

    // Set HTTP-only cookie
    const response = NextResponse.json({ success: true })

    response.cookies.set({
      name: 'auth_session',
      value: 'authenticated',
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 30, // 30 days
    })

    return response
  } catch (error) {
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    )
  }
}
