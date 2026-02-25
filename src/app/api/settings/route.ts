import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export async function GET() {
    try {
        const settings = await prisma.setting.findMany()
        return NextResponse.json(settings)
    } catch (error) {
        return NextResponse.json({ error: 'Failed to fetch settings' }, { status: 500 })
    }
}

export async function POST(request: Request) {
    try {
        const body = await request.json()
        const { key, value } = body

        if (!key || value === undefined) {
            return NextResponse.json({ error: 'Key and value are required' }, { status: 400 })
        }

        const setting = await prisma.setting.upsert({
            where: { key },
            update: { value },
            create: { key, value }
        })

        return NextResponse.json(setting)
    } catch (error) {
        return NextResponse.json({ error: 'Failed to update setting' }, { status: 500 })
    }
}
