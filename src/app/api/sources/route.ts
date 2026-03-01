import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export async function GET() {
    const sources = await prisma.source.findMany()
    return NextResponse.json(sources)
}

export async function POST(req: Request) {
    const body = await req.json()
    const source = await prisma.source.create({
        data: {
            name: body.name,
            telegramChatId: body.telegramChatId,
            status: body.status || 'ACTIVE',
            note: body.note
        } as any
    })
    return NextResponse.json(source)
}

export async function PUT(req: Request) {
    const body = await req.json()
    const source = await prisma.source.update({
        where: { id: body.id },
        data: {
            name: body.name,
            telegramChatId: body.telegramChatId,
            status: body.status,
            note: body.note
        } as any
    })
    return NextResponse.json(source)
}

export async function DELETE(req: Request) {
    const { id } = await req.json()
    await prisma.source.delete({ where: { id } })
    return NextResponse.json({ success: true })
}
