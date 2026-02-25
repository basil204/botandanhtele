import { InlineKeyboard } from 'grammy'
import { bot, MyContext } from '../bot'
import prisma from '../../prisma'

export function setupStaffHandlers() {
    // /start only greets, does NOT register users
    bot.command('start', async (ctx: MyContext) => {
        const telegramId = ctx.from?.id.toString() || 'không xác định'

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
    bot.command('menu', async (ctx: MyContext) => {
        if (ctx.user?.role !== 'STAFF' && ctx.user?.role !== 'ADMIN') {
            return await ctx.reply('Bạn không có quyền sử dụng lệnh này.')
        }

        const sources = await prisma.source.findMany({
            where: { status: 'ACTIVE' }
        })

        if (sources.length === 0) {
            return await ctx.reply('Hiện tại không có nguồn nào hoạt động.')
        }

        const keyboard = new InlineKeyboard()
        sources.forEach((source: any) => {
            keyboard.text(source.name, `select_source:${source.telegramChatId}`).row()
        })

        await ctx.reply('Chọn nguồn cần chat:', { reply_markup: keyboard })
    })

    // Handle source selection
    bot.callbackQuery(/^select_source:(.+)$/, async (ctx: MyContext) => {
        if (!ctx.match) return await ctx.answerCallbackQuery('Lỗi xử lý.')
        const sourceChatId = ctx.match[1]
        const staffId = ctx.user?.telegramId

        if (!staffId) return

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

    // Helper: get admin group ID
    async function getAdminGroupId() {
        const setting = await prisma.setting.findUnique({ where: { key: 'ADMIN_GROUP_ID' } })
        return setting?.value || process.env.ADMIN_GROUP_ID
    }

    // Helper: get active conversation for staff
    async function getConversation(staffId: string) {
        return prisma.conversation.findFirst({
            where: { staffId },
            orderBy: { updatedAt: 'desc' },
            include: { source: true }
        })
    }

    // Handle TEXT messages from staff
    bot.on('message:text', async (ctx: MyContext, next: any) => {
        if (ctx.user?.role !== 'STAFF') return await next()

        const staffId = ctx.user.telegramId
        const conversation = await getConversation(staffId)

        if (!conversation) {
            return await ctx.reply('Vui lòng chọn nguồn từ menu /menu trước.')
        }

        const messageText = ctx.message?.text
        if (!messageText) return
        const sourceId = conversation.sourceId

        try {
            await ctx.api.sendMessage(sourceId, `[Tin nhắn từ Nhân viên]\n\n${messageText}`)

            await prisma.message.create({
                data: {
                    conversationId: conversation.id,
                    senderRole: 'STAFF',
                    text: messageText
                }
            })

            await prisma.conversation.update({
                where: { id: conversation.id },
                data: { updatedAt: new Date() }
            })

            const adminGroupId = await getAdminGroupId()
            if (adminGroupId) {
                await ctx.api.sendMessage(adminGroupId,
                    `💬 LOG NHÂN VIÊN -> NGUỒN\n` +
                    `ID: ${conversation.id}\n` +
                    `Nhân viên: ${ctx.user.name} (${staffId})\n` +
                    `Nguồn: ${(conversation.source as any)?.name || sourceId}\n` +
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
        if (ctx.user?.role !== 'STAFF') return await next()

        const staffId = ctx.user.telegramId
        const conversation = await getConversation(staffId)

        if (!conversation) {
            return await ctx.reply('Vui lòng chọn nguồn từ menu /menu trước.')
        }

        const photo = (ctx.message as any)?.photo
        if (!photo || photo.length === 0) return

        const fileId = photo[photo.length - 1].file_id
        const caption = (ctx.message as any)?.caption || ''
        const sourceId = conversation.sourceId

        try {
            await ctx.api.sendPhoto(sourceId, fileId, {
                caption: `[Tin nhắn từ Nhân viên]${caption ? '\n\n' + caption : ''}`
            })

            await prisma.message.create({
                data: {
                    conversationId: conversation.id,
                    senderRole: 'STAFF',
                    text: caption ? `[Ảnh] ${caption}` : '[Ảnh]'
                }
            })

            await prisma.conversation.update({
                where: { id: conversation.id },
                data: { updatedAt: new Date() }
            })

            const adminGroupId = await getAdminGroupId()
            if (adminGroupId) {
                await ctx.api.sendPhoto(adminGroupId, fileId, {
                    caption:
                        `💬 LOG NHÂN VIÊN -> NGUỒN\n` +
                        `ID: ${conversation.id}\n` +
                        `Nhân viên: ${ctx.user.name} (${staffId})\n` +
                        `Nguồn: ${(conversation.source as any)?.name || sourceId}` +
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
