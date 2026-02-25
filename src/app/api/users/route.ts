import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export async function GET() {
    const users = await prisma.user.findMany()
    return NextResponse.json(users)
}

export async function POST(req: Request) {
    const body = await req.json()
    const user = await prisma.user.create({
        data: {
            telegramId: body.telegramId,
            name: body.name,
            role: body.role || 'STAFF'
        }
    })
    return NextResponse.json(user)
}

export async function PUT(req: Request) {
    const body = await req.json()
    const user = await prisma.user.update({
        where: { id: body.id },
        data: {
            role: body.role,
            name: body.name
        }
    })
    return NextResponse.json(user)
}

export async function DELETE(req: Request) {
    const { id } = await req.json()
    await prisma.user.delete({ where: { id } })
    return NextResponse.json({ success: true })
}
