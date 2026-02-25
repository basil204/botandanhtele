import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export async function GET(req: Request) {
    const { searchParams } = new URL(req.url)
    const conversationId = searchParams.get('id')

    if (conversationId) {
        const messages = await prisma.message.findMany({
            where: { conversationId },
            orderBy: { createdAt: 'asc' }
        })
        return NextResponse.json(messages)
    }

    const conversations = await prisma.conversation.findMany({
        include: {
            staff: true,
            messages: {
                orderBy: { createdAt: 'desc' },
                take: 1
            }
        },
        orderBy: { updatedAt: 'desc' }
    })

    return NextResponse.json(conversations)
}
