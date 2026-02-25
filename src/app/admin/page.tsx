'use client'

import { useState, useEffect } from 'react'

type Tab = 'users' | 'sources' | 'conversations' | 'settings'

export default function AdminDashboard() {
    const [activeTab, setActiveTab] = useState<Tab>('users')
    const [data, setData] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [selectedConversation, setSelectedConversation] = useState<string | null>(null)
    const [messages, setMessages] = useState<any[]>([])

    // Settings State
    const [settings, setSettings] = useState<any[]>([])
    const [newSetting, setNewSetting] = useState({ key: '', value: '' })

    // Modal State
    const [showModal, setShowModal] = useState(false)
    const [modalType, setModalType] = useState<'user' | 'source'>('user')
    const [modalAction, setModalAction] = useState<'add' | 'edit'>('add')
    const [currentItem, setCurrentItem] = useState<any>(null)
    const [formData, setFormData] = useState<any>({})

    useEffect(() => {
        fetchData()
    }, [activeTab])

    const fetchData = async () => {
        setLoading(true)
        const res = await fetch(`/api/${activeTab}`)
        if (res.ok) {
            const json = await res.json()
            setData(json)
            if (activeTab === 'settings') {
                setSettings(json)
            }
        }
        setLoading(false)
    }

    const updateSetting = async (key: string, value: string) => {
        const res = await fetch('/api/settings', {
            method: 'POST',
            body: JSON.stringify({ key, value })
        })
        if (res.ok) {
            fetchData()
        }
    }

    const fetchMessages = async (id: string) => {
        setSelectedConversation(id)
        const res = await fetch(`/api/conversations?id=${id}`)
        if (res.ok) {
            const json = await res.json()
            setMessages(json)
        }
    }

    const openModal = (type: 'user' | 'source', action: 'add' | 'edit', item: any = null) => {
        setModalType(type)
        setModalAction(action)
        setCurrentItem(item)
        setFormData(item || {})
        setShowModal(true)
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        const endpoint = modalType === 'user' ? '/api/users' : '/api/sources'
        const method = modalAction === 'add' ? 'POST' : 'PUT'

        const res = await fetch(endpoint, {
            method,
            body: JSON.stringify(formData),
        })

        if (res.ok) {
            setShowModal(false)
            fetchData()
        }
    }

    return (
        <div className="container">
            <header style={{ marginBottom: '2.5rem' }}>
                <h1 style={{ fontSize: '2rem', fontWeight: '800' }}>Admin Panel</h1>
                <p style={{ color: 'var(--text-secondary)' }}>Quản lý hệ thống chat ẩn danh</p>
            </header>

            <nav className="nav">
                {(['users', 'sources', 'conversations', 'settings'] as Tab[]).map((tab) => (
                    <button
                        key={tab}
                        className={`nav-link ${activeTab === tab ? 'active' : ''}`}
                        onClick={() => setActiveTab(tab)}
                        style={{ background: 'transparent', padding: '0.5rem 0' }}
                    >
                        {tab.charAt(0).toUpperCase() + tab.slice(1)}
                    </button>
                ))}
            </nav>

            <div className="card">
                {loading ? (
                    <p>Đang tải dữ liệu...</p>
                ) : (
                    <table className="table">
                        <thead>
                            {activeTab === 'users' && (
                                <tr>
                                    <th>Tên</th>
                                    <th>Telegram ID</th>
                                    <th>Vai trò</th>
                                    <th>Hành động</th>
                                </tr>
                            )}
                            {activeTab === 'sources' && (
                                <tr>
                                    <th>Tên nguồn</th>
                                    <th>Chat ID</th>
                                    <th>Trạng thái</th>
                                    <th>Hành động</th>
                                </tr>
                            )}
                            {activeTab === 'conversations' && (
                                <tr>
                                    <th>ID</th>
                                    <th>Nhân viên</th>
                                    <th>Nguồn</th>
                                    <th>Cập nhật</th>
                                    <th>Hành động</th>
                                </tr>
                            )}
                            {activeTab === 'settings' && (
                                <tr>
                                    <th>Tên Cấu Hình (Key)</th>
                                    <th>Giá Trị (Value)</th>
                                    <th>Hành động</th>
                                </tr>
                            )}
                        </thead>
                        <tbody>
                            {activeTab === 'settings' ? (
                                settings.map((s) => (
                                    <tr key={s.id}>
                                        <td><code>{s.key}</code></td>
                                        <td>
                                            <input
                                                defaultValue={s.value}
                                                id={`setting-input-${s.id}`}
                                                style={{ width: '100%', padding: '0.4rem' }}
                                            />
                                        </td>
                                        <td>
                                            <button
                                                className="btn-primary"
                                                style={{ padding: '0.25rem 0.75rem', fontSize: '0.8rem' }}
                                                onClick={() => {
                                                    const input = document.getElementById(`setting-input-${s.id}`) as HTMLInputElement
                                                    updateSetting(s.key, input?.value || s.value)
                                                }}
                                            >
                                                Lưu
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            ) : data.map((item) => (
                                <tr key={item.id}>
                                    {activeTab === 'users' && (
                                        <>
                                            <td>{item.name}</td>
                                            <td>{item.telegramId}</td>
                                            <td><span className={`badge badge-${(item.role || 'STAFF').toLowerCase()}`}>{item.role || 'STAFF'}</span></td>
                                            <td>
                                                <button className="btn-primary" style={{ fontSize: '0.8rem', marginRight: '0.5rem', padding: '0.25rem 0.75rem' }} onClick={() => openModal('user', 'edit', item)}>Sửa</button>
                                                <button className="btn-danger" style={{ fontSize: '0.8rem', padding: '0.25rem 0.75rem' }} onClick={async () => {
                                                    if (confirm('Xoá người dùng này?')) {
                                                        await fetch('/api/users', { method: 'DELETE', body: JSON.stringify({ id: item.id }) })
                                                        fetchData()
                                                    }
                                                }}>Xoá</button>
                                            </td>
                                        </>
                                    )}
                                    {activeTab === 'sources' && (
                                        <>
                                            <td>{item.name}</td>
                                            <td>{item.telegramChatId}</td>
                                            <td><span className={`badge badge-${(item.status || 'ACTIVE').toLowerCase()}`}>{item.status || 'ACTIVE'}</span></td>
                                            <td>
                                                <button className="btn-primary" style={{ fontSize: '0.8rem', marginRight: '0.5rem', padding: '0.25rem 0.75rem' }} onClick={() => openModal('source', 'edit', item)}>Sửa</button>
                                                <button className="btn-danger" style={{ fontSize: '0.8rem', padding: '0.25rem 0.75rem' }} onClick={async () => {
                                                    if (confirm('Xoá nguồn này?')) {
                                                        await fetch('/api/sources', { method: 'DELETE', body: JSON.stringify({ id: item.id }) })
                                                        fetchData()
                                                    }
                                                }}>Xoá</button>
                                            </td>
                                        </>
                                    )}
                                    {activeTab === 'conversations' && (
                                        <>
                                            <td>{item.id.slice(0, 8)}...</td>
                                            <td>{item.staff?.name || item.staffId}</td>
                                            <td>{item.sourceId}</td>
                                            <td>{new Date(item.updatedAt).toLocaleString()}</td>
                                            <td>
                                                <button className="btn-primary" style={{ padding: '0.25rem 0.75rem', fontSize: '0.8rem' }} onClick={() => fetchMessages(item.id)}>Chi tiết</button>
                                            </td>
                                        </>
                                    )}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>

            {/* User Create Button */}
            {activeTab === 'users' && (
                <button className="btn-primary" style={{ marginTop: '2rem' }} onClick={() => openModal('user', 'add')}>
                    + Thêm người dùng mới
                </button>
            )}

            {/* Source Create Button */}
            {activeTab === 'sources' && (
                <button className="btn-primary" style={{ marginTop: '2rem' }} onClick={() => openModal('source', 'add')}>
                    + Thêm nguồn mới
                </button>
            )}

            {/* Add Setting Logic */}
            {activeTab === 'settings' && (
                <div style={{ marginTop: '2rem', display: 'flex', gap: '1rem', alignItems: 'flex-end' }}>
                    <div>
                        <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem' }}>Key mới</label>
                        <input value={newSetting.key} onChange={e => setNewSetting({ ...newSetting, key: e.target.value })} placeholder="Vd: ADMIN_GROUP_ID" />
                    </div>
                    <div>
                        <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem' }}>Value mới</label>
                        <input value={newSetting.value} onChange={e => setNewSetting({ ...newSetting, value: e.target.value })} placeholder="Vd: -100123456789" />
                    </div>
                    <button className="btn-primary" onClick={() => {
                        updateSetting(newSetting.key, newSetting.value)
                        setNewSetting({ key: '', value: '' })
                    }}>Thêm cấu hình</button>
                </div>
            )}

            {/* Input Modal */}
            {showModal && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1100 }} onClick={() => setShowModal(false)}>
                    <div className="card glass" style={{ width: '450px', padding: '2rem' }} onClick={e => e.stopPropagation()}>
                        <h2 style={{ marginBottom: '1.5rem' }}>{modalAction === 'add' ? 'Thêm' : 'Sửa'} {modalType === 'user' ? 'Người dùng' : 'Nguồn'}</h2>
                        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            {modalType === 'user' ? (
                                <>
                                    <div>
                                        <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Tên hiển thị</label>
                                        <input
                                            value={formData.name || ''}
                                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                            placeholder="Nhập tên..."
                                            required
                                        />
                                    </div>
                                    <div>
                                        <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Telegram ID</label>
                                        <input
                                            value={formData.telegramId || ''}
                                            onChange={(e) => setFormData({ ...formData, telegramId: e.target.value })}
                                            placeholder="Nhập Telegram ID..."
                                            required
                                            disabled={modalAction === 'edit'}
                                        />
                                    </div>
                                    <div>
                                        <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Vai trò</label>
                                        <select
                                            value={formData.role || 'STAFF'}
                                            onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                                            style={{ width: '100%', padding: '0.75rem', borderRadius: 'var(--radius)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', border: '1px solid var(--border)' }}
                                        >
                                            <option value="STAFF">STAFF</option>
                                            <option value="SOURCE">SOURCE</option>
                                            <option value="ADMIN">ADMIN</option>
                                        </select>
                                    </div>
                                </>
                            ) : (
                                <>
                                    <div>
                                        <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Tên nguồn</label>
                                        <input
                                            value={formData.name || ''}
                                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                            placeholder="Nhập tên nguồn..."
                                            required
                                        />
                                    </div>
                                    <div>
                                        <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Telegram Chat ID</label>
                                        <input
                                            value={formData.telegramChatId || ''}
                                            onChange={(e) => setFormData({ ...formData, telegramChatId: e.target.value })}
                                            placeholder="Nhập Chat ID..."
                                            required
                                        />
                                    </div>
                                    <div>
                                        <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Trạng thái</label>
                                        <select
                                            value={formData.status || 'ACTIVE'}
                                            onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                                            style={{ width: '100%', padding: '0.75rem', borderRadius: 'var(--radius)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', border: '1px solid var(--border)' }}
                                        >
                                            <option value="ACTIVE">ACTIVE</option>
                                            <option value="INACTIVE">INACTIVE</option>
                                        </select>
                                    </div>
                                </>
                            )}
                            <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
                                <button type="button" className="btn-danger" style={{ flex: 1, background: 'rgba(239, 68, 68, 0.1)', color: 'var(--danger)', border: '1px solid var(--danger)' }} onClick={() => setShowModal(false)}>Hủy</button>
                                <button type="submit" className="btn-primary" style={{ flex: 1 }}>{modalAction === 'add' ? 'Tạo mới' : 'Cập nhật'}</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Conversation Detail Modal */}
            {selectedConversation && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }} onClick={() => setSelectedConversation(null)}>
                    <div className="card glass" style={{ width: '600px', maxHeight: '80vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                            <h2>Chi tiết hội thoại</h2>
                            <button onClick={() => setSelectedConversation(null)} style={{ background: 'transparent', color: 'var(--text-secondary)', fontSize: '1.5rem' }}>&times;</button>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            {messages.map((m) => (
                                <div key={m.id} style={{ alignSelf: m.senderRole === 'STAFF' ? 'flex-start' : 'flex-end', background: m.senderRole === 'STAFF' ? 'var(--bg-secondary)' : 'var(--accent)', padding: '0.75rem', borderRadius: '8px', maxWidth: '80%' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', marginBottom: '0.25rem' }}>
                                        <p style={{ fontSize: '0.7rem', fontWeight: 'bold', color: m.senderRole === 'STAFF' ? 'var(--text-secondary)' : 'rgba(255,255,255,0.7)' }}>{m.senderRole}</p>
                                        <p style={{ fontSize: '0.7rem', color: m.senderRole === 'STAFF' ? 'var(--text-secondary)' : 'rgba(255,255,255,0.7)' }}>{new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                                    </div>
                                    <p>{m.text}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
