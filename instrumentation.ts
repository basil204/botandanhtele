export async function register() {
    // Only run in the Node.js (server) environment, not in the Edge runtime
    if (process.env.NEXT_RUNTIME !== 'edge') {
        const { initializeBot } = await import('./src/lib/bot/index')
        const { bot } = await import('./src/lib/bot/bot')

        initializeBot()
        bot.start().then(() => console.log('✅ Telegram Bot started!'))
        console.log('🤖 Bot initialized alongside web server.')
    }
}
