'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
    const [password, setPassword] = useState('')
    const [error, setError] = useState('')
    const router = useRouter()

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault()
        const res = await fetch('/api/auth/login', {
            method: 'POST',
            body: JSON.stringify({ password }),
        })

        if (res.ok) {
            router.push('/admin')
        } else {
            setError('Mật khẩu không chính xác')
        }
    }

    return (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', background: 'var(--bg-primary)' }}>
            <div className="card" style={{ width: '400px', textAlign: 'center' }}>
                <h1 style={{ marginBottom: '1.5rem' }}>Admin Dashboard</h1>
                <form onSubmit={handleLogin}>
                    <input
                        type="password"
                        placeholder="Nhập mật khẩu quản trị"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        style={{ marginBottom: '1rem' }}
                    />
                    {error && <p style={{ color: 'var(--danger)', marginBottom: '1rem', fontSize: '0.9rem' }}>{error}</p>}
                    <button type="submit" className="btn-primary" style={{ width: '100%' }}>Đăng nhập</button>
                </form>
            </div>
        </div>
    )
}
