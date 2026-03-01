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
    if (!ctx.chat) return await next()

    const chatId = ctx.chat.id.toString()

    // Priority: Specific Chat/Group ID identification
    // If a group is registered in User/Source, then everyone in that group is considered that role
    const user = await prisma.user.findUnique({
        where: { telegramId: chatId }
    })

    if (user) {
        ctx.user = {
            telegramId: user.telegramId,
            role: user.role,
            name: user.name || 'Unknown'
        }
    } else {
        // Check if this chat ID is a registered Source
        const source = await prisma.source.findUnique({
            where: { telegramChatId: chatId }
        })
        if (source) {
            ctx.user = {
                telegramId: chatId,
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
