import React, { useState, useEffect, useMemo } from 'react'
import DashboardLayout from '../components/DashboardLayout'
import { useAuth } from '../context/AuthContext'
import api from '../api/axios'
import {
    Plus,
    CheckCircle,
    XCircle,
    Clock,
    ArrowRight,
    Search,
    FileText,
    AlertCircle,
    User,
    Package,
    Truck,
    Calendar,
    ArrowDownLeft,
    ArrowUpRight,
    Filter,
    Download,
    Eye,
    ChevronRight,
    RefreshCw,
    Shield,
    Settings,
    Wrench,
    Briefcase,
    Info,
    Check,
    Pencil
} from 'lucide-react'

const Returnables = () => {
    const { user } = useAuth()
    const [loading, setLoading] = useState(true)
    const [activeTab, setActiveTab] = useState('pending') // pending, history
    const [history, setHistory] = useState([])
    const [pendingItems, setPendingItems] = useState([])
    const [officers, setOfficers] = useState([])

    // Filters
    const [filters, setFilters] = useState({
        search: '',
        status: '',
        officer: '',
        dateFrom: '',
        dateTo: '',
    })

    // Form States
    const [showInitiateModal, setShowInitiateModal] = useState(false)
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [formData, setFormData] = useState({
        material_description: '',
        vendor_name: '',
        reason_for_outward: '',
        officer_id: ''
    })

    // Edit modal
    const [editItem, setEditItem] = useState(null)
    const [editForm, setEditForm] = useState({ material_description: '', vendor_name: '', reason_for_outward: '' })
    const [isEditSubmitting, setIsEditSubmitting] = useState(false)

    // Reject confirm
    const [rejectItem, setRejectItem] = useState(null) // { item, type: 'outward'|'inward' }
    const [rejectRemarks, setRejectRemarks] = useState('')
    const [isRejecting, setIsRejecting] = useState(false)

    // Search for Security
    const [searchOutwardId, setSearchOutwardId] = useState('')
    const [searchResult, setSearchResult] = useState(null)
    const [searchError, setSearchError] = useState('')
    const [securityInwardItems, setSecurityInwardItems] = useState([]) // OUTWARD_COMPLETED items

    useEffect(() => {
        fetchData()
        if (user.role === 'STORE_MANAGER' || user.role === 'ADMIN') {
            fetchOfficers()
        }
    }, [user.role])

    const fetchData = async () => {
        setLoading(true)
        try {
            const historyRes = await api.get('/returnables/history')
            if (Array.isArray(historyRes.data)) {
                setHistory(historyRes.data)
            }

            if (user.role === 'OFFICER') {
                const outward = await api.get('/returnables/officer/pending-outward')
                const inward = await api.get('/returnables/officer/pending-inward')
                setPendingItems([...(outward.data || []), ...(inward.data || [])])
            } else if (user.role === 'SECURITY') {
                const outwardRes = await api.get('/returnables/security/pending-outward')
                setPendingItems(outwardRes.data || [])
                const inwardRes = await api.get('/returnables/security/pending-inward')
                setSecurityInwardItems(inwardRes.data || [])
            } else if (user.role === 'STORE_MANAGER') {
                const pendingRes = await api.get('/returnables/store/pending-final')
                setPendingItems(pendingRes.data || [])
            }
        } catch (err) {
            console.error('Error fetching data:', err)
        } finally {
            setLoading(false)
        }
    }

    const fetchOfficers = async () => {
        try {
            const res = await api.get('/officers')
            setOfficers(res.data)
        } catch (err) {
            console.error('Error fetching officers:', err)
        }
    }

    const filteredHistory = useMemo(() => {
        return history.filter(item => {
            const searchLower = filters.search.toLowerCase()
            const matchesSearch = !searchLower ||
                item.material_description.toLowerCase().includes(searchLower) ||
                item.vendor_name.toLowerCase().includes(searchLower) ||
                (item.outward_gate_pass_id && item.outward_gate_pass_id.toLowerCase().includes(searchLower)) ||
                (item.inward_gate_pass_id && item.inward_gate_pass_id.toLowerCase().includes(searchLower)) ||
                (item.officer_name && item.officer_name.toLowerCase().includes(searchLower))

            const matchesStatus = !filters.status || item.status === filters.status

            const matchesOfficer = !filters.officer || item.officer_name === filters.officer

            const itemDate = new Date(item.created_at)
            const matchesDateFrom = !filters.dateFrom || itemDate >= new Date(filters.dateFrom)
            const matchesDateTo = !filters.dateTo || itemDate <= new Date(filters.dateTo)

            return matchesSearch && matchesStatus && matchesOfficer && matchesDateFrom && matchesDateTo
        })
    }, [history, filters])

    const handleInitiate = async (e) => {
        e.preventDefault()
        setIsSubmitting(true)
        try {
            await api.post('/returnables', formData)
            setShowInitiateModal(false)
            setFormData({ material_description: '', vendor_name: '', reason_for_outward: '', officer_id: '' })
            fetchData()
        } catch (err) {
            alert('Failed to initiate returnable entry')
        } finally {
            setIsSubmitting(false)
        }
    }

    const handleOfficerAction = async (id, type) => {
        try {
            const endpoint = type === 'outward'
                ? `/returnables/${id}/approve-outward-officer`
                : `/returnables/${id}/approve-inward-officer`
            await api.post(endpoint)
            fetchData()
        } catch (err) {
            alert('Action failed')
        }
    }

    const openRejectModal = (item, type) => {
        setRejectItem({ item, type })
        setRejectRemarks('')
    }

    const handleReject = async () => {
        if (!rejectItem) return
        setIsRejecting(true)
        try {
            const endpoint = rejectItem.type === 'outward'
                ? `/returnables/${rejectItem.item.id}/reject-outward-officer`
                : `/returnables/${rejectItem.item.id}/reject-inward-officer`
            await api.post(endpoint, { remarks: rejectRemarks })
            setRejectItem(null)
            fetchData()
        } catch (err) {
            alert('Rejection failed')
        } finally {
            setIsRejecting(false)
        }
    }

    const openEditModal = (item) => {
        setEditItem(item)
        setEditForm({
            material_description: item.material_description || '',
            vendor_name: item.vendor_name || '',
            reason_for_outward: item.reason_for_outward || ''
        })
    }

    const handleEditSave = async () => {
        if (!editItem) return
        setIsEditSubmitting(true)
        try {
            await api.patch(`/returnables/${editItem.id}`, editForm)
            setEditItem(null)
            fetchData()
        } catch (err) {
            alert('Edit failed')
        } finally {
            setIsEditSubmitting(false)
        }
    }

    const handleSecurityApproveOutward = async (id) => {
        try {
            await api.post(`/returnables/${id}/approve-outward-security`)
            fetchData()
        } catch (err) {
            alert('Approval failed')
        }
    }

    const handleSearch = async () => {
        setSearchError('')
        setSearchResult(null)
        try {
            const res = await api.get(`/returnables/search/${searchOutwardId}`)
            setSearchResult(res.data)
        } catch (err) {
            setSearchError('Invalid Outward Gate Pass ID or item already returned')
        }
    }

    const handleReceiveInward = async (id) => {
        try {
            await api.post(`/returnables/${id}/receive-inward-security`)
            setSearchResult(null)
            setSearchOutwardId('')
            fetchData()
        } catch (err) {
            alert('Receiving failed')
        }
    }

    const handleFinalize = async (id) => {
        try {
            await api.post(`/returnables/${id}/finalize`)
            fetchData()
        } catch (err) {
            alert('Finalization failed')
        }
    }

    const downloadPDF = async (id, type) => {
        try {
            const res = await api.get(`/returnables/${id}/pdf/${type}`, { responseType: 'blob' })
            const url = window.URL.createObjectURL(new Blob([res.data]))
            const link = document.createElement('a')
            link.href = url
            link.setAttribute('download', `Returnable_${type}_${id}.pdf`)
            document.body.appendChild(link)
            link.click()
            link.remove()
        } catch (err) {
            alert('Failed to download PDF')
        }
    }

    const getStatusBadge = (status) => {
        const statusMap = {
            'PENDING_OFFICER_OUTWARD': { label: 'OFFICER REVIEW', dot: '#f59e0b', bg: 'rgba(245,158,11,0.1)', border: 'rgba(245,158,11,0.25)' },
            'PENDING_SECURITY_OUTWARD': { label: 'SECURITY CLEARANCE', dot: '#60a5fa', bg: 'rgba(96,165,250,0.1)', border: 'rgba(96,165,250,0.25)' },
            'OUTWARD_COMPLETED': { label: 'WITH VENDOR', dot: '#34d399', bg: 'rgba(52,211,153,0.1)', border: 'rgba(52,211,153,0.25)' },
            'PENDING_OFFICER_INWARD': { label: 'INWARD REVIEW', dot: '#f59e0b', bg: 'rgba(245,158,11,0.1)', border: 'rgba(245,158,11,0.25)' },
            'PENDING_STORE_MANAGER_FINAL': { label: 'MANAGER HANDOVER', dot: '#818cf8', bg: 'rgba(129,140,248,0.1)', border: 'rgba(129,140,248,0.25)' },
            'COMPLETED': { label: 'CLOSED', dot: '#34d399', bg: 'rgba(52,211,153,0.1)', border: 'rgba(52,211,153,0.25)' },
            'REJECTED_OFFICER_OUTWARD': { label: 'REJECTED', dot: '#f87171', bg: 'rgba(248,113,113,0.1)', border: 'rgba(248,113,113,0.25)' },
        }
        const s = statusMap[status] || { label: status, dot: '#94a3b8', bg: 'rgba(148,163,184,0.08)', border: 'rgba(148,163,184,0.2)' }
        return (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '4px 12px', borderRadius: '20px', background: s.bg, border: `1px solid ${s.border}`, fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.07em', color: s.dot, whiteSpace: 'nowrap' }}>
                <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: s.dot, flexShrink: 0 }} />
                {s.label}
            </span>
        )
    }

    const accentMap = {
        'PENDING_OFFICER_OUTWARD': '#f59e0b',
        'PENDING_SECURITY_OUTWARD': '#60a5fa',
        'OUTWARD_COMPLETED': '#34d399',
        'PENDING_OFFICER_INWARD': '#f59e0b',
        'PENDING_STORE_MANAGER_FINAL': '#818cf8',
        'COMPLETED': '#34d399',
        'REJECTED_OFFICER_OUTWARD': '#f87171',
    }

    const StatusCard = ({ item }) => {
        const accent = accentMap[item.status] || '#64748b'
        const isOfficerEditable = user.role === 'OFFICER' &&
            (item.status === 'PENDING_OFFICER_OUTWARD' || item.status === 'PENDING_OFFICER_INWARD')

        return (
            <div style={{
                background: 'linear-gradient(160deg, rgba(15,23,42,0.95) 0%, rgba(15,23,42,0.8) 100%)',
                border: `1px solid rgba(255,255,255,0.07)`,
                borderTop: `2px solid ${accent}`,
                borderRadius: '16px',
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column',
                boxShadow: `0 4px 24px rgba(0,0,0,0.35), 0 0 0 1px rgba(255,255,255,0.03)`,
                transition: 'transform 0.2s ease, box-shadow 0.2s ease',
            }}>
                {/* ── Card Header ── */}
                <div style={{ padding: '1.25rem 1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem' }}>
                    <div style={{ display: 'flex', gap: '0.875rem', alignItems: 'center', minWidth: 0 }}>
                        <div style={{
                            width: '40px', height: '40px', borderRadius: '10px', flexShrink: 0,
                            background: `linear-gradient(135deg, ${accent}20, ${accent}10)`,
                            border: `1px solid ${accent}30`,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            color: accent
                        }}>
                            <Package size={18} />
                        </div>
                        <div style={{ minWidth: 0 }}>
                            <div style={{ fontWeight: 700, fontSize: '0.975rem', color: '#f1f5f9', letterSpacing: '-0.01em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {item.material_description}
                            </div>
                            <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '2px' }}>
                                <span style={{ color: '#475569' }}>Vendor</span>&nbsp;&middot;&nbsp;
                                <span style={{ color: '#93c5fd' }}>{item.vendor_name}</span>
                            </div>
                        </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }}>
                        {getStatusBadge(item.status)}
                        {isOfficerEditable && (
                            <button
                                title="Edit entry"
                                onClick={() => openEditModal(item)}
                                style={{
                                    width: '30px', height: '30px', borderRadius: '8px',
                                    background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
                                    cursor: 'pointer', color: '#64748b',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    transition: 'all 0.15s'
                                }}
                            >
                                <Pencil size={13} />
                            </button>
                        )}
                    </div>
                </div>

                {/* ── Reason Section ── */}
                {item.reason_for_outward && (
                    <div style={{ margin: '0 1.5rem', padding: '0.7rem 1rem', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '10px' }}>
                        <div style={{ fontSize: '0.67rem', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '4px', fontWeight: 600 }}>Reason</div>
                        <div style={{ fontSize: '0.85rem', color: '#94a3b8', lineHeight: '1.55' }}>{item.reason_for_outward}</div>
                    </div>
                )}

                {/* ── Meta Row ── */}
                <div style={{ margin: '0.875rem 1.5rem 0', display: 'flex', gap: '0', borderRadius: '10px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.05)' }}>
                    <div style={{ flex: 1, padding: '0.65rem 1rem', background: 'rgba(0,0,0,0.25)' }}>
                        <div style={{ fontSize: '0.65rem', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.07em', fontWeight: 600, marginBottom: '3px' }}>Initiated</div>
                        <div style={{ fontSize: '0.85rem', color: '#cbd5e1', fontWeight: 500 }}>{new Date(item.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</div>
                    </div>
                    <div style={{ width: '1px', background: 'rgba(255,255,255,0.05)' }} />
                    <div style={{ flex: 1, padding: '0.65rem 1rem', background: 'rgba(0,0,0,0.25)' }}>
                        <div style={{ fontSize: '0.65rem', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.07em', fontWeight: 600, marginBottom: '3px' }}>Officer</div>
                        <div style={{ fontSize: '0.85rem', color: '#cbd5e1', fontWeight: 500 }}>{item.officer_name || `#${item.officer_id}`}</div>
                    </div>
                </div>

                {/* ── Action Bar ── */}
                <div style={{ padding: '1rem 1.5rem', display: 'flex', gap: '0.625rem', marginTop: '0.25rem' }}>
                    {user.role === 'OFFICER' && item.status === 'PENDING_OFFICER_OUTWARD' && (<>
                        <button
                            onClick={() => handleOfficerAction(item.id, 'outward')}
                            style={{
                                flex: 1, padding: '0.65rem 1rem', borderRadius: '9px', border: 'none', cursor: 'pointer',
                                background: `linear-gradient(135deg, ${accent}CC, ${accent}99)`,
                                color: '#0f172a', fontWeight: 700, fontSize: '0.85rem', letterSpacing: '0.01em',
                                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                                boxShadow: `0 3px 12px ${accent}40`
                            }}
                        >
                            <Check size={14} /> Approve Outward
                        </button>
                        <button
                            onClick={() => openRejectModal(item, 'outward')}
                            style={{
                                padding: '0.65rem 1rem', borderRadius: '9px', cursor: 'pointer',
                                background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.2)',
                                color: '#fca5a5', fontWeight: 600, fontSize: '0.85rem',
                                display: 'flex', alignItems: 'center', gap: '6px'
                            }}
                        >
                            <XCircle size={14} /> Reject
                        </button>
                    </>)}
                    {user.role === 'OFFICER' && item.status === 'PENDING_OFFICER_INWARD' && (<>
                        <button
                            onClick={() => handleOfficerAction(item.id, 'inward')}
                            style={{
                                flex: 1, padding: '0.65rem 1rem', borderRadius: '9px', border: 'none', cursor: 'pointer',
                                background: `linear-gradient(135deg, ${accent}CC, ${accent}99)`,
                                color: '#0f172a', fontWeight: 700, fontSize: '0.85rem',
                                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                                boxShadow: `0 3px 12px ${accent}40`
                            }}
                        >
                            <Check size={14} /> Approve Inward
                        </button>
                        <button
                            onClick={() => openRejectModal(item, 'inward')}
                            style={{
                                padding: '0.65rem 1rem', borderRadius: '9px', cursor: 'pointer',
                                background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.2)',
                                color: '#fca5a5', fontWeight: 600, fontSize: '0.85rem',
                                display: 'flex', alignItems: 'center', gap: '6px'
                            }}
                        >
                            <XCircle size={14} /> Reject
                        </button>
                    </>)}
                    {user.role === 'SECURITY' && item.status === 'PENDING_SECURITY_OUTWARD' && (
                        <button
                            onClick={() => handleSecurityApproveOutward(item.id)}
                            style={{
                                flex: 1, padding: '0.65rem 1rem', borderRadius: '9px', border: 'none', cursor: 'pointer',
                                background: 'linear-gradient(135deg, #60a5faCC, #3b82f699)',
                                color: '#0f172a', fontWeight: 700, fontSize: '0.85rem',
                                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                                boxShadow: '0 3px 12px rgba(96,165,250,0.35)'
                            }}
                        >
                            <Shield size={14} /> Approve &amp; Generate Pass
                        </button>
                    )}
                    {user.role === 'STORE_MANAGER' && item.status === 'PENDING_STORE_MANAGER_FINAL' && (
                        <button
                            onClick={() => handleFinalize(item.id)}
                            style={{
                                flex: 1, padding: '0.65rem 1rem', borderRadius: '9px', border: 'none', cursor: 'pointer',
                                background: 'linear-gradient(135deg, #34d399CC, #10b98199)',
                                color: '#0f172a', fontWeight: 700, fontSize: '0.85rem',
                                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                                boxShadow: '0 3px 12px rgba(52,211,153,0.35)'
                            }}
                        >
                            <CheckCircle size={14} /> Confirm Handover
                        </button>
                    )}
                </div>
            </div>
        )
    }


    return (
        <DashboardLayout title="Returnables & Maintenance">
            <div className="container" style={{ maxWidth: '1300px' }}>

                {/* Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', gap: '2rem' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
                        <p style={{ color: '#475569', fontSize: '0.9rem', margin: 0 }}>Manage field devices sent for repair and maintenance across the plant.</p>
                        <div style={{ display: 'inline-flex', background: 'rgba(0,0,0,0.3)', borderRadius: '10px', padding: '3px', border: '1px solid rgba(255,255,255,0.06)' }}>
                            <button
                                onClick={() => setActiveTab('pending')}
                                style={{
                                    padding: '0.45rem 1.25rem', borderRadius: '8px', border: 'none', cursor: 'pointer', fontSize: '0.875rem', fontWeight: 600,
                                    background: activeTab === 'pending' ? 'rgba(59,130,246,0.85)' : 'transparent',
                                    color: activeTab === 'pending' ? '#fff' : '#64748b',
                                    transition: 'all 0.2s'
                                }}
                            >
                                Active Workflow
                            </button>
                            <button
                                onClick={() => setActiveTab('history')}
                                style={{
                                    padding: '0.45rem 1.25rem', borderRadius: '8px', border: 'none', cursor: 'pointer', fontSize: '0.875rem', fontWeight: 600,
                                    background: activeTab === 'history' ? 'rgba(59,130,246,0.85)' : 'transparent',
                                    color: activeTab === 'history' ? '#fff' : '#64748b',
                                    transition: 'all 0.2s'
                                }}
                            >
                                Unified History
                            </button>
                        </div>
                    </div>
                    {user.role === 'STORE_MANAGER' && (
                        <button
                            onClick={() => setShowInitiateModal(true)}
                            style={{
                                display: 'flex', alignItems: 'center', gap: '8px', padding: '0.7rem 1.4rem',
                                borderRadius: '11px', border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: '0.875rem',
                                background: 'linear-gradient(135deg, #3b82f6, #2563eb)', color: '#fff',
                                boxShadow: '0 4px 16px rgba(37,99,235,0.35)'
                            }}
                        >
                            <Plus size={17} /> New Returnable Entry
                        </button>
                    )}
                </div>

                {activeTab === 'pending' && (
                    <div style={{ display: 'grid', gridTemplateColumns: user.role === 'SECURITY' ? '1fr' : 'repeat(auto-fill, minmax(400px, 1fr))', gap: '1.5rem' }}>

                        {/* Security Inward Search — Live Global Filter */}
                        {user.role === 'SECURITY' && (() => {
                            const q = searchOutwardId.trim().toLowerCase()
                            const secFiltered = q
                                ? securityInwardItems.filter(it =>
                                    (it.material_description && it.material_description.toLowerCase().includes(q)) ||
                                    (it.vendor_name && it.vendor_name.toLowerCase().includes(q)) ||
                                    (it.officer_name && it.officer_name.toLowerCase().includes(q)) ||
                                    (it.outward_gate_pass_id && it.outward_gate_pass_id.toLowerCase().includes(q))
                                )
                                : securityInwardItems

                            return (
                                <div style={{ background: 'linear-gradient(160deg, rgba(15,23,42,0.98), rgba(15,23,42,0.85))', border: '1px solid rgba(96,165,250,0.15)', borderTop: '2px solid #60a5fa', borderRadius: '16px', padding: '2rem', boxShadow: '0 4px 24px rgba(0,0,0,0.3)' }}>
                                    {/* Header */}
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.875rem', marginBottom: '1.5rem' }}>
                                        <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'rgba(96,165,250,0.12)', border: '1px solid rgba(96,165,250,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#60a5fa', flexShrink: 0 }}>
                                            <Search size={18} />
                                        </div>
                                        <div>
                                            <div style={{ fontWeight: 700, fontSize: '1rem', color: '#f1f5f9' }}>Process Inward Return</div>
                                            <div style={{ fontSize: '0.8rem', color: '#475569', marginTop: '1px' }}>Search by material, vendor, officer, or gate pass ID.</div>
                                        </div>
                                        {securityInwardItems.length > 0 && (
                                            <div style={{ marginLeft: 'auto', padding: '4px 12px', borderRadius: '20px', background: 'rgba(96,165,250,0.1)', border: '1px solid rgba(96,165,250,0.2)', color: '#60a5fa', fontSize: '0.75rem', fontWeight: 700 }}>
                                                {secFiltered.length} / {securityInwardItems.length} items
                                            </div>
                                        )}
                                    </div>

                                    {/* Search Box */}
                                    <div style={{ position: 'relative', marginBottom: secFiltered.length > 0 ? '1.25rem' : '0' }}>
                                        <Search size={14} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#475569', pointerEvents: 'none' }} />
                                        <input
                                            type="text"
                                            placeholder="Type to filter: vendor, material, officer name, pass ID..."
                                            value={searchOutwardId}
                                            onChange={(e) => { setSearchOutwardId(e.target.value); setSearchResult(null); setSearchError('') }}
                                            style={{ width: '100%', paddingLeft: '36px', paddingRight: '12px', paddingTop: '0.7rem', paddingBottom: '0.7rem', background: 'rgba(0,0,0,0.35)', border: '1px solid rgba(96,165,250,0.2)', borderRadius: '10px', color: '#cbd5e1', fontSize: '0.9rem', outline: 'none', boxSizing: 'border-box', letterSpacing: '0.02em' }}
                                        />
                                    </div>

                                    {/* Results list */}
                                    {secFiltered.length === 0 && securityInwardItems.length > 0 && q && (
                                        <div style={{ padding: '1.5rem', textAlign: 'center', color: '#475569', fontSize: '0.875rem' }}>
                                            No items match "{searchOutwardId}"
                                        </div>
                                    )}
                                    {securityInwardItems.length === 0 && (
                                        <div style={{ padding: '1.5rem', textAlign: 'center', color: '#475569', fontSize: '0.875rem' }}>
                                            No items pending security outward clearance.
                                        </div>
                                    )}

                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                        {secFiltered.map(item => (
                                            <div key={item.id} style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(52,211,153,0.15)', borderLeft: '3px solid #34d399', borderRadius: '12px', padding: '1rem 1.25rem' }}>
                                                {/* Row 1: Material + Pass ID */}
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.625rem' }}>
                                                    <div>
                                                        <div style={{ fontWeight: 700, color: '#f1f5f9', fontSize: '0.9rem' }}>{item.material_description}</div>
                                                        <div style={{ fontSize: '0.78rem', marginTop: '2px' }}>
                                                            <span style={{ color: '#475569' }}>Vendor</span>&nbsp;·&nbsp;
                                                            <span style={{ color: '#7dd3fc' }}>{item.vendor_name}</span>
                                                        </div>
                                                    </div>
                                                    {item.outward_gate_pass_id && (
                                                        <span style={{ fontFamily: 'monospace', fontSize: '0.75rem', background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.25)', color: '#fbbf24', padding: '3px 10px', borderRadius: '6px', whiteSpace: 'nowrap' }}>
                                                            ↑ {item.outward_gate_pass_id}
                                                        </span>
                                                    )}
                                                </div>

                                                {/* Row 2: Officer + Sent-out date + button */}
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                                                    {item.officer_name && (
                                                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '3px 10px', borderRadius: '20px', background: 'rgba(129,140,248,0.08)', border: '1px solid rgba(129,140,248,0.2)' }}>
                                                            <User size={11} style={{ color: '#a5b4fc' }} />
                                                            <span style={{ fontSize: '0.78rem', fontWeight: 600, color: '#c4b5fd' }}>{item.officer_name}</span>
                                                        </div>
                                                    )}
                                                    {item.outward_approved_security_at && (
                                                        <div style={{ fontSize: '0.75rem', color: '#475569' }}>
                                                            Sent: {new Date(item.outward_approved_security_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                                                        </div>
                                                    )}
                                                    <button
                                                        onClick={() => handleReceiveInward(item.id)}
                                                        style={{ marginLeft: 'auto', padding: '0.5rem 1.1rem', borderRadius: '8px', border: 'none', cursor: 'pointer', background: 'linear-gradient(135deg, #34d399CC, #10b98199)', color: '#0f172a', fontWeight: 700, fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '6px', boxShadow: '0 2px 8px rgba(52,211,153,0.25)' }}
                                                    >
                                                        <ArrowDownLeft size={14} /> Verify &amp; Generate Inward Pass
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>

                                    {searchError && (
                                        <div style={{ marginTop: '1rem', display: 'flex', alignItems: 'center', gap: '0.625rem', color: '#fca5a5', background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.2)', padding: '0.75rem 1rem', borderRadius: '10px', fontSize: '0.875rem' }}>
                                            <AlertCircle size={16} /> {searchError}
                                        </div>
                                    )}
                                </div>
                            )
                        })()}


                        {user.role !== 'SECURITY' && pendingItems.map(item => (
                            <StatusCard key={item.id} item={item} />
                        ))}


                        {!loading && pendingItems.length === 0 && user.role !== 'SECURITY' && (
                            <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '5rem', background: 'rgba(255,255,255,0.02)', borderRadius: '24px', border: '2px dashed rgba(255,255,255,0.05)' }}>
                                <RefreshCw size={48} style={{ color: '#334155', marginBottom: '1.5rem' }} />
                                <h3 style={{ color: '#475569' }}>All clear! No pending actions at the moment.</h3>
                            </div>
                        )}
                    </div>
                )}

                {activeTab === 'history' && (() => {
                    // Build unique officer list from history for the filter dropdown
                    const officerOptions = [...new Set(history.map(h => h.officer_name).filter(Boolean))].sort()
                    return (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

                            {/* ── Filter Bar ── */}
                            <div style={{ background: 'linear-gradient(160deg, rgba(15,23,42,0.98), rgba(15,23,42,0.85))', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '14px', padding: '1.25rem 1.5rem', display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'flex-end' }}>

                                {/* Global Search */}
                                <div style={{ flex: '2 1 200px', minWidth: '160px' }}>
                                    <div style={{ fontSize: '0.67rem', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600, marginBottom: '6px' }}>Search</div>
                                    <div style={{ position: 'relative' }}>
                                        <Search size={13} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#475569' }} />
                                        <input
                                            type="text"
                                            placeholder="Vendor, Pass ID, material, officer..."
                                            value={filters.search}
                                            onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                                            style={{ width: '100%', paddingLeft: '30px', paddingRight: '10px', paddingTop: '0.55rem', paddingBottom: '0.55rem', background: 'rgba(0,0,0,0.35)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '9px', color: '#cbd5e1', fontSize: '0.85rem', outline: 'none', boxSizing: 'border-box' }}
                                        />
                                    </div>
                                </div>

                                {/* Status Filter */}
                                <div style={{ flex: '1 1 150px', minWidth: '140px' }}>
                                    <div style={{ fontSize: '0.67rem', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600, marginBottom: '6px' }}>Status</div>
                                    <select
                                        value={filters.status}
                                        onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                                        style={{ width: '100%', padding: '0.55rem 0.75rem', background: 'rgba(0,0,0,0.35)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '9px', color: '#cbd5e1', fontSize: '0.85rem', outline: 'none', cursor: 'pointer' }}
                                    >
                                        <option value="">All Statuses</option>
                                        <option value="PENDING_OFFICER_OUTWARD">Officer Review (Out)</option>
                                        <option value="PENDING_SECURITY_OUTWARD">Security Clearance</option>
                                        <option value="OUTWARD_COMPLETED">With Vendor</option>
                                        <option value="PENDING_OFFICER_INWARD">Inward Review</option>
                                        <option value="PENDING_STORE_MANAGER_FINAL">Manager Handover</option>
                                        <option value="COMPLETED">Closed</option>
                                        <option value="REJECTED_OFFICER_OUTWARD">Rejected</option>
                                    </select>
                                </div>

                                {/* Officer Filter */}
                                <div style={{ flex: '1 1 140px', minWidth: '130px' }}>
                                    <div style={{ fontSize: '0.67rem', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600, marginBottom: '6px' }}>Officer</div>
                                    <select
                                        value={filters.officer}
                                        onChange={(e) => setFilters({ ...filters, officer: e.target.value })}
                                        style={{ width: '100%', padding: '0.55rem 0.75rem', background: 'rgba(0,0,0,0.35)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '9px', color: filters.officer ? '#93c5fd' : '#cbd5e1', fontSize: '0.85rem', outline: 'none', cursor: 'pointer' }}
                                    >
                                        <option value="">All Officers</option>
                                        {officerOptions.map(name => (
                                            <option key={name} value={name}>{name}</option>
                                        ))}
                                    </select>
                                </div>

                                {/* Date Range */}
                                <div style={{ flex: '1 1 130px', minWidth: '110px' }}>
                                    <div style={{ fontSize: '0.67rem', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600, marginBottom: '6px' }}>From</div>
                                    <input
                                        type="date" value={filters.dateFrom}
                                        onChange={(e) => setFilters({ ...filters, dateFrom: e.target.value })}
                                        style={{ width: '100%', padding: '0.55rem 0.75rem', background: 'rgba(0,0,0,0.35)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '9px', color: '#cbd5e1', fontSize: '0.85rem', outline: 'none', boxSizing: 'border-box' }}
                                    />
                                </div>
                                <div style={{ flex: '1 1 130px', minWidth: '110px' }}>
                                    <div style={{ fontSize: '0.67rem', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600, marginBottom: '6px' }}>To</div>
                                    <input
                                        type="date" value={filters.dateTo}
                                        onChange={(e) => setFilters({ ...filters, dateTo: e.target.value })}
                                        style={{ width: '100%', padding: '0.55rem 0.75rem', background: 'rgba(0,0,0,0.35)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '9px', color: '#cbd5e1', fontSize: '0.85rem', outline: 'none', boxSizing: 'border-box' }}
                                    />
                                </div>

                                {/* Reset */}
                                <button
                                    onClick={() => setFilters({ search: '', status: '', officer: '', dateFrom: '', dateTo: '' })}
                                    style={{ padding: '0.55rem 1.1rem', borderRadius: '9px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.04)', color: '#64748b', fontSize: '0.82rem', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap', alignSelf: 'flex-end' }}
                                >
                                    Reset
                                </button>

                                {/* Active filter count pill */}
                                {(filters.search || filters.status || filters.officer || filters.dateFrom || filters.dateTo) && (
                                    <div style={{ alignSelf: 'flex-end', padding: '0.45rem 0.875rem', borderRadius: '20px', background: 'rgba(96,165,250,0.1)', border: '1px solid rgba(96,165,250,0.2)', color: '#60a5fa', fontSize: '0.75rem', fontWeight: 700, whiteSpace: 'nowrap' }}>
                                        {filteredHistory.length} result{filteredHistory.length !== 1 ? 's' : ''}
                                    </div>
                                )}
                            </div>

                            {/* ── Table ── */}
                            <div style={{ background: 'linear-gradient(160deg, rgba(15,23,42,0.98), rgba(15,23,42,0.85))', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '14px', overflow: 'hidden' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                    <thead>
                                        <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                                            {[['ID & Date', '1.25rem 1rem 1.25rem 1.5rem'], ['Item & Vendor', '1.25rem 1rem'], ['Pass IDs', '1.25rem 1rem'], ['Officer', '1.25rem 1rem'], ['Status', '1.25rem 1rem'], ['Docs', '1.25rem 1.5rem 1.25rem 1rem']].map(([label, pad], i) => (
                                                <th key={label} style={{ padding: pad, fontSize: '0.67rem', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700, textAlign: i === 5 ? 'right' : 'left', background: 'rgba(0,0,0,0.3)' }}>
                                                    {label}
                                                </th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredHistory.length === 0 && (
                                            <tr>
                                                <td colSpan={6} style={{ padding: '4rem', textAlign: 'center', color: '#334155' }}>
                                                    <RefreshCw size={32} style={{ marginBottom: '0.75rem', display: 'block', margin: '0 auto 0.75rem' }} />
                                                    <div style={{ fontSize: '0.9rem' }}>No records match the current filters</div>
                                                </td>
                                            </tr>
                                        )}
                                        {filteredHistory.map((item, idx) => (
                                            <tr
                                                key={item.id}
                                                style={{
                                                    borderBottom: idx < filteredHistory.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
                                                    transition: 'background 0.15s'
                                                }}
                                                onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.025)'}
                                                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                                            >
                                                {/* ID & Date */}
                                                <td style={{ padding: '1rem 1rem 1rem 1.5rem' }}>
                                                    <div style={{ fontWeight: 700, fontSize: '0.875rem', color: '#f1f5f9', fontFamily: 'monospace', letterSpacing: '0.02em' }}>#RET-{item.id}</div>
                                                    <div style={{ fontSize: '0.75rem', color: '#475569', marginTop: '2px' }}>
                                                        {new Date(item.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                                                    </div>
                                                </td>

                                                {/* Item & Vendor */}
                                                <td style={{ padding: '1rem' }}>
                                                    <div style={{ fontWeight: 600, fontSize: '0.875rem', color: '#e2e8f0' }}>{item.material_description}</div>
                                                    <div style={{ fontSize: '0.78rem', color: '#475569', marginTop: '2px' }}>
                                                        <span style={{ color: '#375569' }}>Vendor</span>&nbsp;·&nbsp;
                                                        <span style={{ color: '#7dd3fc' }}>{item.vendor_name}</span>
                                                    </div>
                                                </td>

                                                {/* Pass IDs */}
                                                <td style={{ padding: '1rem' }}>
                                                    <div style={{ fontSize: '0.75rem', fontFamily: 'monospace', display: 'flex', flexDirection: 'column', gap: '3px' }}>
                                                        {item.outward_gate_pass_id ? (
                                                            <span style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)', color: '#fbbf24', padding: '2px 8px', borderRadius: '5px', whiteSpace: 'nowrap' }}>
                                                                ↑ {item.outward_gate_pass_id}
                                                            </span>
                                                        ) : <span style={{ color: '#334155', fontSize: '0.7rem' }}>—</span>}
                                                        {item.inward_gate_pass_id && (
                                                            <span style={{ background: 'rgba(52,211,153,0.08)', border: '1px solid rgba(52,211,153,0.2)', color: '#6ee7b7', padding: '2px 8px', borderRadius: '5px', whiteSpace: 'nowrap' }}>
                                                                ↓ {item.inward_gate_pass_id}
                                                            </span>
                                                        )}
                                                    </div>
                                                </td>

                                                {/* Officer */}
                                                <td style={{ padding: '1rem' }}>
                                                    {item.officer_name ? (
                                                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '4px 10px', borderRadius: '20px', background: 'rgba(129,140,248,0.08)', border: '1px solid rgba(129,140,248,0.2)' }}>
                                                            <User size={11} style={{ color: '#a5b4fc' }} />
                                                            <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#c4b5fd' }}>{item.officer_name}</span>
                                                        </div>
                                                    ) : <span style={{ color: '#334155', fontSize: '0.75rem' }}>—</span>}
                                                </td>

                                                {/* Status */}
                                                <td style={{ padding: '1rem' }}>{getStatusBadge(item.status)}</td>

                                                {/* Docs */}
                                                <td style={{ padding: '1rem 1.5rem 1rem 1rem', textAlign: 'right' }}>
                                                    <div style={{ display: 'flex', gap: '0.4rem', justifyContent: 'flex-end' }}>
                                                        {item.outward_gate_pass_id && (
                                                            <button
                                                                title="Download Outward Pass"
                                                                onClick={() => downloadPDF(item.id, 'outward')}
                                                                style={{ width: '30px', height: '30px', borderRadius: '8px', background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.2)', color: '#fbbf24', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                                            >
                                                                <ArrowUpRight size={14} />
                                                            </button>
                                                        )}
                                                        {item.inward_gate_pass_id && (
                                                            <button
                                                                title="Download Inward Pass"
                                                                onClick={() => downloadPDF(item.id, 'inward')}
                                                                style={{ width: '30px', height: '30px', borderRadius: '8px', background: 'rgba(52,211,153,0.1)', border: '1px solid rgba(52,211,153,0.2)', color: '#6ee7b7', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                                            >
                                                                <ArrowDownLeft size={14} />
                                                            </button>
                                                        )}
                                                        {item.status === 'COMPLETED' && (
                                                            <button
                                                                title="Download Handover Receipt"
                                                                onClick={() => downloadPDF(item.id, 'handover')}
                                                                style={{ width: '30px', height: '30px', borderRadius: '8px', background: 'rgba(129,140,248,0.1)', border: '1px solid rgba(129,140,248,0.2)', color: '#a5b4fc', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                                            >
                                                                <FileText size={14} />
                                                            </button>
                                                        )}
                                                        {!item.outward_gate_pass_id && !item.inward_gate_pass_id && item.status !== 'COMPLETED' && (
                                                            <span style={{ color: '#334155', fontSize: '0.75rem' }}>—</span>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )
                })()}


                {/* Modern Initiate Modal */}
                {showInitiateModal && (
                    <div style={{
                        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                        background: 'rgba(2,6,23,0.85)', backdropFilter: 'blur(12px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
                    }}>
                        <div className="glass-panel" style={{
                            width: '100%', maxWidth: '600px', padding: '0',
                            border: '1px solid rgba(255,255,255,0.1)', overflow: 'hidden',
                            boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)',
                            animation: 'modalSlideIn 0.4s cubic-bezier(0.16, 1, 0.3, 1)'
                        }}>
                            {/* Modal Header */}
                            <div style={{
                                background: 'linear-gradient(to right, rgba(59,130,246,0.1), rgba(37,99,235,0.1))',
                                padding: '2rem', borderBottom: '1px solid rgba(255,255,255,0.08)',
                                display: 'flex', alignItems: 'center', gap: '1.25rem'
                            }}>
                                <div style={{
                                    width: '56px', height: '56px', borderRadius: '16px',
                                    background: 'rgba(59,130,246,0.2)', color: '#60a5fa',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center'
                                }}>
                                    <Wrench size={28} />
                                </div>
                                <div>
                                    <h2 style={{ fontSize: '1.5rem', margin: 0, color: '#f8fafc' }}>Initiate Maintenance</h2>
                                    <p style={{ color: '#94a3b8', margin: '4px 0 0 0', fontSize: '0.9rem' }}>Record device details for external service.</p>
                                </div>
                            </div>

                            <form onSubmit={handleInitiate} style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>
                                    <div className="form-group">
                                        <label className="label" style={{ fontSize: '0.8rem', color: '#64748b', marginBottom: '0.6rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                            <Package size={14} /> DEVICE / MATERIAL
                                        </label>
                                        <input
                                            type="text" required className="glass-input"
                                            value={formData.material_description}
                                            onChange={(e) => setFormData({ ...formData, material_description: e.target.value })}
                                            placeholder="e.g. Siemens PLC S7-1200"
                                            style={{ width: '100%', background: 'rgba(0,0,0,0.2)' }}
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label className="label" style={{ fontSize: '0.8rem', color: '#64748b', marginBottom: '0.6rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                            <Briefcase size={14} /> SERVICE VENDOR
                                        </label>
                                        <input
                                            type="text" required className="glass-input"
                                            value={formData.vendor_name}
                                            onChange={(e) => setFormData({ ...formData, vendor_name: e.target.value })}
                                            placeholder="e.g. TechRepairs Pvt Ltd"
                                            style={{ width: '100%', background: 'rgba(0,0,0,0.2)' }}
                                        />
                                    </div>
                                </div>

                                <div className="form-group">
                                    <label className="label" style={{ fontSize: '0.8rem', color: '#64748b', marginBottom: '0.6rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                        <Info size={14} /> REASON & SPECIFICATIONS
                                    </label>
                                    <textarea
                                        className="glass-input" style={{ minHeight: '100px', resize: 'vertical', width: '100%', background: 'rgba(0,0,0,0.2)', padding: '0.75rem' }}
                                        value={formData.reason_for_outward}
                                        onChange={(e) => setFormData({ ...formData, reason_for_outward: e.target.value })}
                                        placeholder="Enter maintenance details and serial numbers..."
                                    />
                                </div>

                                <div className="form-group">
                                    <label className="label" style={{ fontSize: '0.8rem', color: '#64748b', marginBottom: '0.6rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                        <User size={14} /> ASSIGN APPROVAL OFFICER
                                    </label>
                                    <div style={{ position: 'relative' }}>
                                        <select
                                            required className="glass-input" style={{ width: '100%', background: 'rgba(0,0,0,0.2)', appearance: 'none' }}
                                            value={formData.officer_id}
                                            onChange={(e) => setFormData({ ...formData, officer_id: e.target.value })}
                                        >
                                            <option value="" style={{ background: '#0f172a' }}>Select Authority</option>
                                            {officers.map(off => (
                                                <option key={off.id} value={off.id} style={{ background: '#0f172a' }}>{off.username} ({off.role})</option>
                                            ))}
                                        </select>
                                        <ChevronRight size={18} style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%) rotate(90deg)', color: '#64748b', pointerEvents: 'none' }} />
                                    </div>
                                </div>

                                <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
                                    <button
                                        type="submit"
                                        className="btn btn-primary"
                                        style={{
                                            flex: 2, padding: '0.8rem', borderRadius: '10px', fontWeight: 600,
                                            background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                                            boxShadow: '0 4px 12px rgba(37,99,235,0.2)'
                                        }}
                                        disabled={isSubmitting}
                                    >
                                        {isSubmitting ? 'Processing...' : (
                                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                                                <Check size={18} /> Initiate Workflow
                                            </div>
                                        )}
                                    </button>
                                    <button
                                        type="button"
                                        className="btn btn-secondary"
                                        style={{ flex: 1, padding: '0.8rem', borderRadius: '10px', background: 'rgba(255,255,255,0.05)' }}
                                        onClick={() => setShowInitiateModal(false)}
                                    >
                                        Cancel
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}
            </div>

            <style dangerouslySetInnerHTML={{
                __html: `
                @keyframes modalSlideIn {
                    from { opacity: 0; transform: translateY(20px) scale(0.98); }
                    to { opacity: 1; transform: translateY(0) scale(1); }
                }
                .glass-input:focus {
                    border-color: rgba(59, 130, 246, 0.5) !important;
                    box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.2) !important;
                    outline: none;
                }
            `}} />

            {/* ── Reject Confirmation Modal ── */}
            {rejectItem && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(2,6,23,0.85)', backdropFilter: 'blur(12px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
                    <div className="glass-panel" style={{ width: '100%', maxWidth: '480px', padding: '2rem', border: '1px solid rgba(239,68,68,0.25)', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)', animation: 'modalSlideIn 0.3s ease' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
                            <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'rgba(239,68,68,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#f87171', flexShrink: 0 }}>
                                <XCircle size={24} />
                            </div>
                            <div>
                                <h3 style={{ margin: 0, color: '#f8fafc' }}>Confirm Rejection</h3>
                                <p style={{ margin: '4px 0 0', color: '#94a3b8', fontSize: '0.9rem' }}>
                                    Reject <strong style={{ color: '#f8fafc' }}>{rejectItem.type}</strong> approval for "{rejectItem.item.material_description}"?
                                </p>
                            </div>
                        </div>
                        <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                            <label className="label" style={{ fontSize: '0.8rem', color: '#64748b', marginBottom: '0.5rem' }}>Remarks (optional)</label>
                            <textarea
                                className="glass-input"
                                style={{ width: '100%', minHeight: '80px', resize: 'vertical', background: 'rgba(0,0,0,0.2)', padding: '0.75rem' }}
                                placeholder="Reason for rejection..."
                                value={rejectRemarks}
                                onChange={(e) => setRejectRemarks(e.target.value)}
                            />
                        </div>
                        <div style={{ display: 'flex', gap: '1rem' }}>
                            <button
                                onClick={handleReject}
                                disabled={isRejecting}
                                style={{ flex: 1, padding: '0.8rem', borderRadius: '10px', background: 'rgba(239,68,68,0.8)', border: 'none', color: '#fff', fontWeight: 600, cursor: 'pointer', fontSize: '0.95rem' }}
                            >
                                {isRejecting ? 'Rejecting...' : 'Confirm Reject'}
                            </button>
                            <button
                                onClick={() => setRejectItem(null)}
                                style={{ flex: 1, padding: '0.8rem', borderRadius: '10px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#94a3b8', fontWeight: 500, cursor: 'pointer' }}
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Edit Entry Modal ── */}
            {editItem && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(2,6,23,0.85)', backdropFilter: 'blur(12px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
                    <div className="glass-panel" style={{ width: '100%', maxWidth: '560px', padding: '0', border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)', overflow: 'hidden', animation: 'modalSlideIn 0.3s ease' }}>
                        {/* Modal Header */}
                        <div style={{ background: 'linear-gradient(to right, rgba(59,130,246,0.1), rgba(37,99,235,0.1))', padding: '1.5rem 2rem', borderBottom: '1px solid rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                            <div style={{ width: '44px', height: '44px', borderRadius: '12px', background: 'rgba(59,130,246,0.2)', color: '#60a5fa', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                <Pencil size={20} />
                            </div>
                            <div>
                                <h3 style={{ margin: 0, color: '#f8fafc' }}>Edit Entry</h3>
                                <p style={{ margin: '2px 0 0', color: '#94a3b8', fontSize: '0.85rem' }}>Update the returnable entry details</p>
                            </div>
                        </div>

                        <div style={{ padding: '1.75rem 2rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                            <div className="form-group">
                                <label className="label" style={{ fontSize: '0.8rem', color: '#64748b', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <Package size={13} /> DEVICE / MATERIAL
                                </label>
                                <input
                                    type="text" className="glass-input"
                                    style={{ width: '100%', background: 'rgba(0,0,0,0.2)' }}
                                    value={editForm.material_description}
                                    onChange={(e) => setEditForm({ ...editForm, material_description: e.target.value })}
                                    placeholder="e.g. Siemens PLC S7-1200"
                                />
                            </div>
                            <div className="form-group">
                                <label className="label" style={{ fontSize: '0.8rem', color: '#64748b', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <Briefcase size={13} /> SERVICE VENDOR
                                </label>
                                <input
                                    type="text" className="glass-input"
                                    style={{ width: '100%', background: 'rgba(0,0,0,0.2)' }}
                                    value={editForm.vendor_name}
                                    onChange={(e) => setEditForm({ ...editForm, vendor_name: e.target.value })}
                                    placeholder="e.g. TechRepairs Pvt Ltd"
                                />
                            </div>
                            <div className="form-group">
                                <label className="label" style={{ fontSize: '0.8rem', color: '#64748b', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <Info size={13} /> REASON &amp; SPECIFICATIONS
                                </label>
                                <textarea
                                    className="glass-input"
                                    style={{ width: '100%', minHeight: '90px', resize: 'vertical', background: 'rgba(0,0,0,0.2)', padding: '0.75rem' }}
                                    value={editForm.reason_for_outward}
                                    onChange={(e) => setEditForm({ ...editForm, reason_for_outward: e.target.value })}
                                    placeholder="Maintenance details, serial numbers..."
                                />
                            </div>
                            <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem' }}>
                                <button
                                    onClick={handleEditSave}
                                    disabled={isEditSubmitting}
                                    style={{ flex: 2, padding: '0.8rem', borderRadius: '10px', background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)', border: 'none', color: '#fff', fontWeight: 600, cursor: 'pointer', fontSize: '0.95rem', boxShadow: '0 4px 12px rgba(37,99,235,0.2)' }}
                                >
                                    {isEditSubmitting ? 'Saving...' : 'Save Changes'}
                                </button>
                                <button
                                    onClick={() => setEditItem(null)}
                                    style={{ flex: 1, padding: '0.8rem', borderRadius: '10px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#94a3b8', fontWeight: 500, cursor: 'pointer' }}
                                >
                                    Cancel
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </DashboardLayout>

    )
}

export default Returnables
