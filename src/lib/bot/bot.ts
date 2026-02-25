import { Bot, Context } from 'grammy'
import prisma from '../prisma'

export interface MyContext extends Context {
    user?: {
        telegramId: string
        role: string
        name: string
    }
}

const token = process.env.TELEGRAM_BOT_TOKEN
if (!token) {
    throw new Error('TELEGRAM_BOT_TOKEN is not defined')
}

export const bot = new Bot<MyContext>(token)

// Middleware to check user role (does NOT auto-register)
bot.use(async (ctx, next) => {
    if (!ctx.from) return await next()

    const telegramId = ctx.from.id.toString()

    const user = await prisma.user.findUnique({
        where: { telegramId }
    })

    if (user) {
        ctx.user = {
            telegramId: user.telegramId,
            role: user.role,
            name: user.name || 'Unknown'
        }
    } else {
        // Check if this person is a registered Source
        const source = await prisma.source.findUnique({
            where: { telegramChatId: telegramId }
        })
        if (source) {
            ctx.user = {
                telegramId,
                role: 'SOURCE',
                name: source.name
            }
        }
    }

    await next()
})

bot.catch((err) => {
    console.error('Bot error:', err)
})
