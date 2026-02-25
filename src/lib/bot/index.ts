import { bot } from './bot'
import { setupStaffHandlers } from './handlers/staff'
import { setupSourceHandlers } from './handlers/source'

export function initializeBot() {
    setupStaffHandlers()
    setupSourceHandlers()

    console.log('Bot initialized handlers.')
}

// For separate process execution
if (require.main === module) {
    initializeBot()
    bot.start().then(() => console.log('Bot started!'))
}
