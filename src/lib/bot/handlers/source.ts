import { bot, MyContext } from '../bot'
import prisma from '../../prisma'
import { InlineKeyboard } from 'grammy'

export function setupSourceHandlers() {
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

    // Helper: get active conversation for this source
    async function getConversation(sourceId: string) {
        return prisma.conversation.findFirst({
            where: { sourceId },
            orderBy: { updatedAt: 'desc' },
            include: { staff: true, source: true }
        })
    }

    // Helper: log to admin group
    async function logToAdmin(
        ctx: any,
        conversation: any,
        sourceName: string,
        sourceId: string,
        content: string
    ) {
        const adminGroupId = await getAdminGroupId()

        if (adminGroupId) {
            await ctx.api.sendMessage(
                adminGroupId,
                `💬 LOG NGUỒN -> NHÂN VIÊN\n` +
                `ID: ${conversation.id}\n` +
                `Nhân viên: ${conversation.staffId}\n` +
                `Nguồn: ${sourceName} (${sourceId})\n` +
                `Nội dung: ${content}`
            )
        }
    }

    // Specialized menu command for sources to select staff
    bot.command('menu', async (ctx: MyContext) => {
        if (ctx.user?.role !== 'SOURCE') {
            return await ctx.reply('Bạn không có quyền sử dụng lệnh này.')
        }

        const staffMembers = await prisma.user.findMany({
            where: { role: 'STAFF' }
        })

        const keyboard = new InlineKeyboard()
        staffMembers.forEach((staff: any) => {
            keyboard.text(staff.name || 'Nhân viên', `select_staff:${staff.telegramId}`).row()
        })

        // Add disconnect option
        keyboard.text('🛑 Không gửi cho ai (Dừng kết nối)', 'select_staff:none').row()

        await ctx.reply('Chọn nhân viên để chat:', { reply_markup: keyboard })
    })

    // Handle staff selection
    bot.callbackQuery(/^select_staff:(.+)$/, async (ctx: MyContext) => {
        if (ctx.user?.role !== 'SOURCE') return await ctx.answerCallbackQuery('Bạn không có quyền.')
        if (!ctx.match) return await ctx.answerCallbackQuery('Lỗi xử lý.')

        const staffId = ctx.match[1]
        const sourceId = ctx.user.telegramId

        if (staffId === 'none') {
            await prisma.conversation.deleteMany({
                where: { sourceId }
            })
            await ctx.answerCallbackQuery('Đã dừng kết nối.')
            return await ctx.reply('Đã dừng kết nối. Bạn sẽ không gửi tin nhắn tự động cho bất kỳ nhân viên nào.')
        }

        const staffMember = await prisma.user.findUnique({
            where: { telegramId: staffId }
        })

        if (!staffMember) {
            return await ctx.answerCallbackQuery('Nhân viên không tồn tại.')
        }

        // Upsert conversation mapping (id format: staffId_sourceId)
        const conversationId = `${staffId}_${sourceId}`
        await prisma.conversation.upsert({
            where: { id: conversationId },
            create: {
                id: conversationId,
                staffId,
                sourceId: sourceId
            },
            update: {
                updatedAt: new Date()
            }
        })

        await ctx.answerCallbackQuery()
        await ctx.reply(`Đã kết nối với nhân viên: ${staffMember.name}. Gửi tin nhắn hoặc ảnh để bắt đầu.`)

        // Notify staff member
        try {
            await ctx.api.sendMessage(staffId, `🔔 Nguồn ${ctx.user.name} đã chọn bạn để chat.`)
        } catch (err) {
            console.error('Error notifying staff of connection:', err)
        }
    })

    // Handle TEXT messages from source
    bot.on('message:text', async (ctx: any, next: any) => {
        if (!ctx.chat || ctx.user?.role !== 'SOURCE') return await next()

        const sourceId = ctx.user.telegramId
        const replyToMessageId = ctx.message?.reply_to_message?.message_id.toString()

        let targetStaffId: string | null = null
        let conversationId: string | null = null

        if (replyToMessageId) {
            // Priority: Check if replying to a forwarded message
            const originalMsg = await prisma.message.findFirst({
                where: {
                    telegramMessageId: replyToMessageId,
                    targetChatId: ctx.chat.id.toString()
                },
                include: { conversation: { include: { staff: true } } }
            } as any)

            if (originalMsg) {
                targetStaffId = (originalMsg as any).conversation.staffId
                conversationId = (originalMsg as any).conversationId
            }
        }

        if (!targetStaffId) {
            // Fallback: Use manual selection
            const conversation = await getConversation(sourceId)
            if (conversation) {
                targetStaffId = conversation.staffId
                conversationId = conversation.id
            }
        }

        if (!targetStaffId || !conversationId) {
            return await ctx.reply('❌ Vui lòng "Trình bày" (Reply) vào tin nhắn của nhân viên hoặc chọn nhân viên từ menu /menu trước.')
        }

        const messageText = ctx.message?.text
        if (!messageText) return

        const sourceName = ctx.user.name || 'Nguồn'

        try {
            // Forward to staff with source name
            const forwarded = await ctx.api.sendMessage(targetStaffId, `[Phản hồi từ Nguồn ${sourceName}]\n\n${messageText}\n\n*(Reply tin nhắn này để trả lời)*`, { parse_mode: 'Markdown' })

            // Save log
            await prisma.message.create({
                data: {
                    conversationId: conversationId,
                    senderRole: 'SOURCE',
                    text: messageText,
                    telegramMessageId: forwarded.message_id.toString(),
                    targetChatId: targetStaffId.toString()
                } as any
            })

            // Update conversation timestamp
            await prisma.conversation.update({
                where: { id: conversationId },
                data: { updatedAt: new Date() }
            })

            const conversationData = await prisma.conversation.findUnique({
                where: { id: conversationId },
                include: { source: true }
            })

            await logToAdmin(ctx, conversationData, sourceName, sourceId, messageText)
        } catch (err: any) {
            console.error('Error forwarding text to staff:', err)
            if (err.description?.includes('chat not found')) {
                await ctx.reply('❌ Không thể gửi tin nhắn cho nhân viên. Có thể họ chưa nhắn tin /start với bot hoặc bot không có trong nhóm của họ.')
            } else {
                await ctx.reply('❌ Lỗi khi gửi phản hồi lại cho nhân viên.')
            }
        }
    })

    // Handle PHOTO messages from source
    bot.on('message:photo', async (ctx: any, next: any) => {
        if (!ctx.chat || ctx.user?.role !== 'SOURCE') return await next()

        const sourceId = ctx.user.telegramId
        const replyToMessageId = ctx.message?.reply_to_message?.message_id.toString()

        let targetStaffId: string | null = null
        let conversationId: string | null = null

        if (replyToMessageId) {
            const originalMsg = await prisma.message.findFirst({
                where: {
                    telegramMessageId: replyToMessageId,
                    targetChatId: ctx.chat.id.toString()
                },
                include: { conversation: { include: { staff: true } } }
            } as any)

            if (originalMsg) {
                targetStaffId = (originalMsg as any).conversation.staffId
                conversationId = (originalMsg as any).conversationId
            }
        }

        if (!targetStaffId) {
            const conversation = await getConversation(sourceId)
            if (conversation) {
                targetStaffId = conversation.staffId
                conversationId = conversation.id
            }
        }

        if (!targetStaffId || !conversationId) {
            return await ctx.reply('❌ Vui lòng "Trình bày" (Reply) vào tin nhắn của nhân viên hoặc chọn nhân viên từ menu /menu trước.')
        }

        const photo = ctx.message?.photo
        if (!photo || photo.length === 0) return

        const sourceName = ctx.user.name || 'Nguồn'
        // Get highest resolution photo
        const fileId = photo[photo.length - 1].file_id
        const caption = ctx.message?.caption || ''

        try {
            // Forward photo to staff with source name as caption
            const forwarded = await ctx.api.sendPhoto(targetStaffId, fileId, {
                caption: `[Phản hồi từ Nguồn ${sourceName}]${caption ? '\n\n' + caption : ''}\n\n*(Reply tin nhắn này để trả lời)*`,
                parse_mode: 'Markdown'
            })

            // Save log (store caption or placeholder)
            await prisma.message.create({
                data: {
                    conversationId: conversationId,
                    senderRole: 'SOURCE',
                    text: caption ? `[Ảnh] ${caption}` : '[Ảnh]',
                    telegramMessageId: forwarded.message_id.toString(),
                    targetChatId: targetStaffId.toString()
                } as any
            })

            // Update conversation timestamp
            await prisma.conversation.update({
                where: { id: conversationId },
                data: { updatedAt: new Date() }
            })

            const conversationData = await prisma.conversation.findUnique({
                where: { id: conversationId },
                include: { source: true }
            })

            const adminGroupSetting = await prisma.setting.findUnique({ where: { key: 'ADMIN_GROUP_ID' } })
            const adminGroupId = adminGroupSetting?.value || process.env.ADMIN_GROUP_ID
            if (adminGroupId) {
                await ctx.api.sendPhoto(adminGroupId, fileId, {
                    caption:
                        `💬 LOG NGUỒN -> NHÂN VIÊN\n` +
                        `ID: ${conversationId}\n` +
                        `Nhân viên: ${targetStaffId}\n` +
                        `Nguồn: ${sourceName} (${sourceId})` +
                        (caption ? `\nCaption: ${caption}` : '')
                })
            }
        } catch (err: any) {
            console.error('Error forwarding photo to staff:', err)
            if (err.description?.includes('chat not found')) {
                await ctx.reply('❌ Không thể gửi ảnh cho nhân viên. Họ cần nhấn /start với bot hoặc thêm bot vào nhóm của họ.')
            } else {
                await ctx.reply('❌ Lỗi khi gửi ảnh lại cho nhân viên.')
            }
        }
    })
}
