import { bot } from '../bot'
import prisma from '../../prisma'

export function setupSourceHandlers() {
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
        const adminGroupSetting = await prisma.setting.findUnique({ where: { key: 'ADMIN_GROUP_ID' } })
        const adminGroupId = adminGroupSetting?.value || process.env.ADMIN_GROUP_ID
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

    // Handle TEXT messages from source
    bot.on('message:text', async (ctx: any, next: any) => {
        if (ctx.user?.role !== 'SOURCE') return await next()

        const sourceId = ctx.user.telegramId
        const conversation = await getConversation(sourceId)

        if (!conversation) {
            return await ctx.reply('Không có cuộc hội thoại nào đang diễn ra.')
        }

        const messageText = ctx.message?.text
        if (!messageText) return

        const sourceName = conversation.source?.name || ctx.user.name || 'Nguồn'
        const staffId = conversation.staffId

        try {
            // Forward to staff with source name
            await ctx.api.sendMessage(staffId, `[Phản hồi từ Nguồn ${sourceName}]\n\n${messageText}`)

            // Save log
            await prisma.message.create({
                data: {
                    conversationId: conversation.id,
                    senderRole: 'SOURCE',
                    text: messageText
                }
            })

            // Update conversation timestamp
            await prisma.conversation.update({
                where: { id: conversation.id },
                data: { updatedAt: new Date() }
            })

            await logToAdmin(ctx, conversation, sourceName, sourceId, messageText)
        } catch (err) {
            console.error('Error forwarding text to staff:', err)
            await ctx.reply('❌ Lỗi khi gửi phản hồi lại cho nhân viên.')
        }
    })

    // Handle PHOTO messages from source
    bot.on('message:photo', async (ctx: any, next: any) => {
        if (ctx.user?.role !== 'SOURCE') return await next()

        const sourceId = ctx.user.telegramId
        const conversation = await getConversation(sourceId)

        if (!conversation) {
            return await ctx.reply('Không có cuộc hội thoại nào đang diễn ra.')
        }

        const photo = ctx.message?.photo
        if (!photo || photo.length === 0) return

        const sourceName = conversation.source?.name || ctx.user.name || 'Nguồn'
        const staffId = conversation.staffId
        // Get highest resolution photo
        const fileId = photo[photo.length - 1].file_id
        const caption = ctx.message?.caption || ''

        try {
            // Forward photo to staff with source name as caption
            await ctx.api.sendPhoto(staffId, fileId, {
                caption: `[Phản hồi từ Nguồn ${sourceName}]${caption ? '\n\n' + caption : ''}`
            })

            // Save log (store caption or placeholder)
            await prisma.message.create({
                data: {
                    conversationId: conversation.id,
                    senderRole: 'SOURCE',
                    text: caption ? `[Ảnh] ${caption}` : '[Ảnh]'
                }
            })

            // Update conversation timestamp
            await prisma.conversation.update({
                where: { id: conversation.id },
                data: { updatedAt: new Date() }
            })

            const adminGroupSetting = await prisma.setting.findUnique({ where: { key: 'ADMIN_GROUP_ID' } })
            const adminGroupId = adminGroupSetting?.value || process.env.ADMIN_GROUP_ID
            if (adminGroupId) {
                await ctx.api.sendPhoto(adminGroupId, fileId, {
                    caption:
                        `💬 LOG NGUỒN -> NHÂN VIÊN\n` +
                        `ID: ${conversation.id}\n` +
                        `Nhân viên: ${conversation.staffId}\n` +
                        `Nguồn: ${sourceName} (${sourceId})` +
                        (caption ? `\nCaption: ${caption}` : '')
                })
            }
        } catch (err) {
            console.error('Error forwarding photo to staff:', err)
            await ctx.reply('❌ Lỗi khi gửi ảnh lại cho nhân viên.')
        }
    })
}
