import './globals.css'
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
    title: 'Anonymous Chat - Admin Panel',
    description: 'Quản trị hệ thống chat ẩn danh Telegram',
}

export default function RootLayout({
    children,
}: {
    children: React.ReactNode
}) {
    return (
        <html lang="vi">
            <body className={inter.className}>{children}</body>
        </html>
    )
}
