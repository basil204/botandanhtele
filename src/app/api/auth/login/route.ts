import { NextResponse } from 'next/server'
import { SignJWT } from 'jose'
import { cookies } from 'next/headers'

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET)

export async function POST(req: Request) {
    try {
        const { password } = await req.json()

        if (password === process.env.ADMIN_PASSWORD) {
            const token = await new SignJWT({ role: 'ADMIN' })
                .setProtectedHeader({ alg: 'HS256' })
                .setExpirationTime('24h')
                .sign(JWT_SECRET)

            cookies().set('admin-token', token, {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: 'lax',
                maxAge: 60 * 60 * 24 // 1 day
            })

            return NextResponse.json({ success: true })
        }

        return NextResponse.json({ error: 'Mật khẩu không đúng' }, { status: 401 })
    } catch (error) {
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
    }
}
