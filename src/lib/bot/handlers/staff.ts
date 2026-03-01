import { InlineKeyboard } from 'grammy'
import { bot, MyContext } from '../bot'
import prisma from '../../prisma'

export function setupStaffHandlers() {
    // /start only greets, does NOT register users
    bot.command('start', async (ctx: MyContext) => {
        if (!ctx.chat) return
        const chatId = ctx.chat.id.toString()
        const chatType = ctx.chat.type
        const isGroup = chatType === 'group' || chatType === 'supergroup'
        const telegramId = ctx.from?.id.toString() || 'không xác định'

        if (isGroup) {
            return await ctx.reply(`Xin chào! 👋\n\nĐây là một nhóm (${chatType}).\nID của nhóm này là: \`${chatId}\`\n\nĐể nhận tin nhắn tại nhóm này, hãy dùng ID trên để đăng ký tài khoản Nhân Viên (STAFF) hoặc Nguồn (SOURCE).`)
        }

        // Private chat logic
        if (!ctx.user) {
            return await ctx.reply(`Xin chào ${ctx.from?.first_name || 'bạn'}! 👋\n\nID Telegram của bạn là: \`${telegramId}\`\n\nBạn chưa được đăng ký trong hệ thống. Vui lòng gửi ID này cho quản trị viên để được cấp quyền.`)
        }

        if (ctx.user.role === 'SOURCE') {
            return await ctx.reply(`Xin chào Nguồn ${ctx.user.name}. ID: \`${telegramId}\`\nBạn sẽ nhận được tin nhắn từ nhân viên khi có yêu cầu.`)
        }

        if (ctx.user.role === 'ADMIN') {
            return await ctx.reply(`Xin chào Quản trị viên ${ctx.user.name}. ID: \`${telegramId}\`\nBạn có thể xem log tin nhắn trong group admin.`)
        }

        if (ctx.user.role === 'STAFF') {
            return await ctx.reply(`Xin chào Nhân viên ${ctx.user.name}. ID: \`${telegramId}\`\nDùng lệnh /menu để chọn nguồn chat.`)
        }

        await ctx.reply(`Xin chào ${ctx.user.name}. ID: \`${telegramId}\`\nVai trò của bạn chưa được xác định.`)
    })

    // Specialized menu command for staff
    bot.command('menu', async (ctx: MyContext, next) => {
        if (ctx.user?.role !== 'STAFF' && ctx.user?.role !== 'ADMIN') {
            return await next()
        }

        const sources = await prisma.source.findMany({
            where: { status: 'ACTIVE' }
        })

        const keyboard = new InlineKeyboard()
        sources.forEach((source: any) => {
            keyboard.text(source.name, `select_source:${source.telegramChatId}`).row()
        })

        // Add disconnect option
        keyboard.text('🛑 Không gửi cho ai (Dừng kết nối)', 'select_source:none').row()

        await ctx.reply('Chọn nguồn cần chat:', { reply_markup: keyboard })
    })

    // Helper: get admin group ID
    async function getAdminGroupId() {
        const setting = await prisma.setting.findUnique({ where: { key: 'ADMIN_GROUP_ID' } })
        const value = setting?.value || process.env.ADMIN_GROUP_ID

        // Safeguard: Check if it's the placeholder or not a valid number-like ID
        if (!value || value === 'your_admin_group_id_here' || isNaN(Number(value.replace('-', '')))) {
            return null
        }
        return value
    }

    // Helper: get active conversation for staff
    async function getConversation(staffId: string) {
        return prisma.conversation.findFirst({
            where: { staffId },
            orderBy: { updatedAt: 'desc' },
            include: { source: true }
        })
    }

    // Handle source selection
    bot.callbackQuery(/^select_source:(.+)$/, async (ctx: MyContext) => {
        if (!ctx.match) return await ctx.answerCallbackQuery('Lỗi xử lý.')
        const sourceChatId = ctx.match[1]
        const staffId = ctx.user?.telegramId

        if (!staffId) return

        if (sourceChatId === 'none') {
            await prisma.conversation.deleteMany({
                where: { staffId }
            })
            await ctx.answerCallbackQuery('Đã dừng kết nối.')
            return await ctx.reply('Đã dừng kết nối. Bạn sẽ không gửi tin nhắn tự động cho bất kỳ nguồn nào.')
        }

        const source = await prisma.source.findUnique({
            where: { telegramChatId: sourceChatId }
        })

        if (!source) {
            return await ctx.answerCallbackQuery('Nguồn không tồn tại.')
        }

        // Upsert conversation mapping
        await prisma.conversation.upsert({
            where: {
                id: `${staffId}_${sourceChatId}`
            },
            create: {
                id: `${staffId}_${sourceChatId}`,
                staffId,
                sourceId: sourceChatId
            },
            update: {
                updatedAt: new Date()
            }
        })

        await ctx.answerCallbackQuery()
        await ctx.reply(`Đã kết nối với nguồn: ${source.name}. Gửi tin nhắn hoặc ảnh để bắt đầu.`)
    })

    // Handle TEXT messages from staff
    bot.on('message:text', async (ctx: MyContext, next: any) => {
        if (!ctx.chat || ctx.user?.role !== 'STAFF') return await next()

        const staffId = ctx.user.telegramId
        const replyToMessageId = ctx.message?.reply_to_message?.message_id.toString()

        let targetSourceId: string | null = null
        let conversationId: string | null = null

        if (replyToMessageId) {
            // Priority: Check if replying to a forwarded message
            const originalMsg = await prisma.message.findFirst({
                where: {
                    telegramMessageId: replyToMessageId,
                    targetChatId: ctx.chat.id.toString()
                },
                include: { conversation: { include: { source: true } } }
            } as any)

            if (originalMsg) {
                targetSourceId = (originalMsg as any).conversation.sourceId
                conversationId = (originalMsg as any).conversationId
            }
        }

        if (!targetSourceId) {
            // Fallback: Use manual selection
            const conversation = await getConversation(staffId)
            if (conversation) {
                targetSourceId = conversation.sourceId
                conversationId = conversation.id
            }
        }

        if (!targetSourceId || !conversationId) {
            return await ctx.reply('❌ Vui lòng "Trình bày" (Reply) vào tin nhắn của nguồn hoặc chọn nguồn từ menu /menu trước.')
        }

        const messageText = ctx.message?.text
        if (!messageText) return

        try {
            const forwarded = await ctx.api.sendMessage(targetSourceId, `[Tin nhắn từ Nhân viên]\n\n${messageText}\n\n*(Reply tin nhắn này để trả lời)*`, { parse_mode: 'Markdown' })

            await prisma.message.create({
                data: {
                    conversationId: conversationId,
                    senderRole: 'STAFF',
                    text: messageText,
                    telegramMessageId: forwarded.message_id.toString(),
                    targetChatId: targetSourceId
                } as any
            })

            await prisma.conversation.update({
                where: { id: conversationId },
                data: { updatedAt: new Date() }
            })

            const adminGroupId = await getAdminGroupId()
            if (adminGroupId) {
                await ctx.api.sendMessage(adminGroupId,
                    `💬 LOG NHÂN VIÊN -> NGUỒN\n` +
                    `ID: ${conversationId}\n` +
                    `Nhân viên: ${ctx.user.name} (${staffId})\n` +
                    `Nguồn: ${targetSourceId}\n` +
                    `Nội dung: ${messageText}`
                )
            }

            await ctx.reply('✅ Đã gửi.')
        } catch (err) {
            console.error('Error forwarding text to source:', err)
            await ctx.reply('❌ Lỗi khi gửi tin nhắn đến nguồn.')
        }
    })

    // Handle PHOTO messages from staff
    bot.on('message:photo', async (ctx: MyContext, next: any) => {
        if (!ctx.chat || ctx.user?.role !== 'STAFF') return await next()

        const staffId = ctx.user.telegramId
        const replyToMessageId = ctx.message?.reply_to_message?.message_id.toString()

        let targetSourceId: string | null = null
        let conversationId: string | null = null

        if (replyToMessageId && ctx.chat) {
            const originalMsg = await prisma.message.findFirst({
                where: {
                    telegramMessageId: replyToMessageId,
                    targetChatId: ctx.chat.id.toString()
                },
                include: { conversation: { include: { source: true } } }
            } as any) // Typecast for now as Prisma client might not be regenerated

            if (originalMsg) {
                targetSourceId = (originalMsg as any).conversation.sourceId
                conversationId = (originalMsg as any).conversationId
            }
        }

        if (!targetSourceId) {
            const conversation = await getConversation(staffId)
            if (conversation) {
                targetSourceId = conversation.sourceId
                conversationId = conversation.id
            }
        }

        if (!targetSourceId || !conversationId) {
            return await ctx.reply('❌ Vui lòng "Trình bày" (Reply) vào ảnh của nguồn hoặc chọn nguồn từ menu /menu trước.')
        }

        const photo = (ctx.message as any)?.photo
        if (!photo || photo.length === 0) return

        const fileId = photo[photo.length - 1].file_id
        const caption = (ctx.message as any)?.caption || ''

        try {
            const forwarded = await ctx.api.sendPhoto(targetSourceId, fileId, {
                caption: `[Tin nhắn từ Nhân viên]${caption ? '\n\n' + caption : ''}\n\n*(Reply tin nhắn này để trả lời)*`,
                parse_mode: 'Markdown'
            })

            await prisma.message.create({
                data: {
                    conversationId: conversationId,
                    senderRole: 'STAFF',
                    text: caption ? `[Ảnh] ${caption}` : '[Ảnh]',
                    telegramMessageId: forwarded.message_id.toString(),
                    targetChatId: targetSourceId
                } as any
            })

            await prisma.conversation.update({
                where: { id: conversationId },
                data: { updatedAt: new Date() }
            })

            const adminGroupId = await getAdminGroupId()
            if (adminGroupId) {
                await ctx.api.sendPhoto(adminGroupId, fileId, {
                    caption:
                        `💬 LOG NHÂN VIÊN -> NGUỒN\n` +
                        `ID: ${conversationId}\n` +
                        `Nhân viên: ${ctx.user.name} (${staffId})\n` +
                        `Nguồn: ${targetSourceId}` +
                        (caption ? `\nCaption: ${caption}` : '')
                })
            }

            await ctx.reply('✅ Đã gửi ảnh.')
        } catch (err) {
            console.error('Error forwarding photo to source:', err)
            await ctx.reply('❌ Lỗi khi gửi ảnh đến nguồn.')
        }
    })
}
