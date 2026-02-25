import 'dotenv/config'
import { bot } from './bot'
import { setupStaffHandlers } from './handlers/staff'
import { setupSourceHandlers } from './handlers/source'

setupStaffHandlers()
setupSourceHandlers()

console.log('🤖 Bot handlers initialized.')

bot.start({
    onStart: () => console.log('✅ Telegram Bot started! Đang lắng nghe tin nhắn...')
})
