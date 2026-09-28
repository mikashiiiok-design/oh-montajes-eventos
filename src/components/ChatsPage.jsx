import { useEffect, useRef, useState } from 'react'
import { ArrowLeft, Check, Circle, ClipboardList, FileText, ImagePlus, LoaderCircle, MessageCircle, RotateCcw, Search, Send, UserRound, X } from 'lucide-react'
import { chatAccessRoles, chatReopenRoles, getRoleInfo } from '../../shared/roles.js'
import { apiRequest } from '../utils/api.js'
import { compressChatImage } from '../utils/compressChatImage.js'
import companyLogo from '../assets/LOGO-OH.webp'
import QuoteWorkflowPanel from './QuoteWorkflowPanel.jsx'
import './ChatsPage.css'

const staffRoles = new Set(chatAccessRoles)
const reopenRoles = new Set(chatReopenRoles)
const formatCurrency = new Intl.NumberFormat('es-CO', {
  style: 'currency',
  currency: 'COP',
  maximumFractionDigits: 0,
})
const formatTime = new Intl.DateTimeFormat('es-CO', { hour: '2-digit', minute: '2-digit' })
const formatDate = new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'short', year: 'numeric' })
const formatDateTime = new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
const quoteStatusLabels = { sent: 'Pendiente de respuesta', accepted: 'Aceptada', rejected: 'Rechazada', superseded: 'Reemplazada' }
const taskStatusLabels = { assigned: 'Asignada', in_progress: 'En curso', completed: 'Completada', blocked: 'Bloqueada' }
const orderStatusLabels = { planning: 'En planificación', scheduled: 'Programado', in_progress: 'En curso', completed: 'Completado', cancelled: 'Cancelado' }

function formatRecordId(id) {
  return `OH-${String(id).padStart(6, '0')}`
}

function mergeMessages(currentMessages, refreshedMessages) {
  const messagesById = new Map(currentMessages.map((message) => [String(message.id), message]))
  refreshedMessages.forEach((message) => messagesById.set(String(message.id), message))
  return [...messagesById.values()]
}

function ChatsPage() {
  const [account, setAccount] = useState(null)
  const [chats, setChats] = useState([])
  const [chatSearch, setChatSearch] = useState('')
  const [activeChat, setActiveChat] = useState(null)
  const [selectedChatId, setSelectedChatId] = useState(() => new URLSearchParams(window.location.search).get('chat'))
  const [draft, setDraft] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const [selectedImage, setSelectedImage] = useState(null)
  const [imagePreview, setImagePreview] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isSending, setIsSending] = useState(false)
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false)
  const [respondingToQuoteId, setRespondingToQuoteId] = useState(null)
  const [isInvoiceOpen, setIsInvoiceOpen] = useState(false)
  const [isWorkflowOpen, setIsWorkflowOpen] = useState(false)
  const [error, setError] = useState('')
  const invoiceDialogRef = useRef(null)
  const workflowDialogRef = useRef(null)
  const messageListRef = useRef(null)
  const shouldAutoScrollRef = useRef(true)
  const imagePreviewRef = useRef('')
  const typingTimeoutRef = useRef(null)
  const isStaff = staffRoles.has(account?.role)
  const canReopenChat = reopenRoles.has(account?.role)
  const isAuthorized = account?.role === 'client' || isStaff
  const activeChatId = activeChat?.id
  const activeMessageCount = activeChat?.messages.length
  const activeReadMessageCount = activeChat?.messages.filter((message) => String(message.senderId) === String(account?.id) && message.isRead).length ?? 0
  const activeTypingUserIds = activeChat?.typingUsers?.map((user) => user.id).join(',') ?? ''
  const normalizedChatSearch = chatSearch.trim().toLocaleLowerCase()
  const filteredChats = normalizedChatSearch
    ? chats.filter((chat) => [
      chat.customer_name,
      chat.customer_email,
      `cliente ${formatRecordId(chat.customer_id)}`,
      `chat ${formatRecordId(chat.id)}`,
    ].some((value) => value?.toLocaleLowerCase().includes(normalizedChatSearch)))
    : chats
  const openChats = filteredChats.filter((chat) => chat.status === 'open')
  const closedChats = filteredChats.filter((chat) => chat.status === 'closed')

  useEffect(() => {
    const previousTitle = document.title
    document.title = 'Chats de cotización | OH Montajes y Eventos'
    return () => { document.title = previousTitle }
  }, [])

  useEffect(() => {
    let isActive = true

    async function initialize() {
      try {
        const { account: activeAccount } = await apiRequest('/api/auth/me')
        if (!activeAccount) {
          window.location.assign('/cuenta?modo=login')
          return
        }
        if (!isActive) return
        setAccount(activeAccount)
        if (activeAccount.role !== 'client' && !staffRoles.has(activeAccount.role)) return
        const { chats: activeChats } = await apiRequest('/api/chats')
        if (isActive) {
          setChats(activeChats)
        }
      } catch (requestError) {
        if (isActive) setError(requestError.message)
      } finally {
        if (isActive) setIsLoading(false)
      }
    }

    initialize()
    return () => { isActive = false }
  }, [])

  useEffect(() => {
    if (isLoading || !isAuthorized) return undefined
    let isActive = true
    const refreshChats = async () => {
      try {
        const { chats: activeChats } = await apiRequest('/api/chats')
        if (isActive) setChats(activeChats)
      } catch {
        return undefined
      }
      return undefined
    }
    const intervalId = window.setInterval(refreshChats, 5000)
    return () => {
      isActive = false
      window.clearInterval(intervalId)
    }
  }, [isAuthorized, isLoading])

  useEffect(() => {
    if (!selectedChatId || !isAuthorized) return undefined

    let isActive = true
    let isRefreshing = false
    const refreshConversation = async () => {
      if (isRefreshing) return
      isRefreshing = true
      try {
        const { chat } = await apiRequest(`/api/chats/${selectedChatId}`)
        if (isActive) {
          setActiveChat((current) => current?.id === chat.id
            ? { ...chat, messages: mergeMessages(current.messages, chat.messages) }
            : chat)
          setError('')
        }
      } catch (requestError) {
        if (isActive) setError(requestError.message)
      } finally {
        isRefreshing = false
      }
    }
    const refreshWhenVisible = () => {
      if (document.visibilityState === 'visible') refreshConversation()
    }
    refreshConversation()
    const intervalId = window.setInterval(refreshConversation, 2000)
    window.addEventListener('focus', refreshWhenVisible)
    document.addEventListener('visibilitychange', refreshWhenVisible)
    return () => {
      isActive = false
      window.clearInterval(intervalId)
      window.removeEventListener('focus', refreshWhenVisible)
      document.removeEventListener('visibilitychange', refreshWhenVisible)
    }
  }, [isAuthorized, selectedChatId])

  useEffect(() => {
    if (!activeChatId || !selectedChatId || !isAuthorized) return undefined

    const markConversationRead = () => {
      if (document.visibilityState !== 'visible') return
      apiRequest(`/api/chats/${selectedChatId}/read`, { method: 'POST' }).catch(() => {})
    }
    markConversationRead()
    window.addEventListener('focus', markConversationRead)
    document.addEventListener('visibilitychange', markConversationRead)

    return () => {
      window.removeEventListener('focus', markConversationRead)
      document.removeEventListener('visibilitychange', markConversationRead)
    }
  }, [activeChatId, activeMessageCount, isAuthorized, selectedChatId])

  useEffect(() => {
    if (!selectedChatId || !isAuthorized || !isTyping) return undefined

    const publishTyping = () => {
      apiRequest(`/api/chats/${selectedChatId}/typing`, {
        method: 'POST',
        body: JSON.stringify({ isTyping: true }),
      }).catch(() => {})
    }
    publishTyping()
    const intervalId = window.setInterval(publishTyping, 3000)

    return () => {
      window.clearInterval(intervalId)
      apiRequest(`/api/chats/${selectedChatId}/typing`, {
        method: 'POST',
        body: JSON.stringify({ isTyping: false }),
      }).catch(() => {})
    }
  }, [isAuthorized, isTyping, selectedChatId])

  useEffect(() => {
    if (shouldAutoScrollRef.current) scrollToLatestMessage()
  }, [activeChat?.messages.length, activeReadMessageCount, activeTypingUserIds])

  useEffect(() => {
    const dialog = invoiceDialogRef.current
    if (!dialog) return
    if (isInvoiceOpen && !dialog.open) dialog.showModal()
    if (!isInvoiceOpen && dialog.open) dialog.close()
  }, [isInvoiceOpen])

  useEffect(() => {
    const dialog = workflowDialogRef.current
    if (!dialog) return
    if (isWorkflowOpen && !dialog.open) dialog.showModal()
    if (!isWorkflowOpen && dialog.open) dialog.close()
  }, [isWorkflowOpen])

  useEffect(() => () => {
    if (imagePreviewRef.current) URL.revokeObjectURL(imagePreviewRef.current)
    window.clearTimeout(typingTimeoutRef.current)
  }, [])

  function setImageFile(file) {
    if (imagePreviewRef.current) URL.revokeObjectURL(imagePreviewRef.current)
    imagePreviewRef.current = file ? URL.createObjectURL(file) : ''
    setImagePreview(imagePreviewRef.current)
    setSelectedImage(file)
  }

  function markTyping() {
    setIsTyping(true)
    window.clearTimeout(typingTimeoutRef.current)
    typingTimeoutRef.current = window.setTimeout(() => setIsTyping(false), 2400)
  }

  function scrollToLatestMessage() {
    const messageList = messageListRef.current
    if (!messageList) return
    const behavior = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth'
    messageList.scrollTo({ top: messageList.scrollHeight, behavior })
  }

  function handleMessageListScroll() {
    const messageList = messageListRef.current
    if (!messageList) return
    shouldAutoScrollRef.current = messageList.scrollHeight - messageList.scrollTop - messageList.clientHeight < 72
  }

  function selectChat(chatId) {
    const nextId = String(chatId)
    setIsTyping(false)
    window.clearTimeout(typingTimeoutRef.current)
    shouldAutoScrollRef.current = true
    setSelectedChatId(nextId)
    setActiveChat(null)
    setError('')
    window.history.replaceState(null, '', `/cuenta/chats?chat=${encodeURIComponent(nextId)}`)
  }

  async function handleSubmit(event) {
    event.preventDefault()
    if (!activeChat || (!draft.trim() && !selectedImage) || isSending) return
    setError('')
    setIsSending(true)
    window.clearTimeout(typingTimeoutRef.current)

    try {
      const image = selectedImage ? await compressChatImage(selectedImage) : undefined
      const { message } = await apiRequest(`/api/chats/${activeChat.id}/messages`, {
        method: 'POST',
        body: JSON.stringify({ body: draft.trim(), image }),
      })
      shouldAutoScrollRef.current = true
      setActiveChat((current) => current?.id === activeChat.id
        ? { ...current, messages: [...current.messages, message] }
        : current)
      setIsTyping(false)
      setDraft('')
      setImageFile(null)
      const { chats: activeChats } = await apiRequest('/api/chats')
      setChats(activeChats)
    } catch (requestError) {
      setError(requestError.message)
      setIsTyping(false)
    } finally {
      setIsSending(false)
    }
  }

  async function refreshSelectedConversation() {
    if (!selectedChatId) return
    try {
      const [{ chat }, { chats: activeChats }] = await Promise.all([
        apiRequest(`/api/chats/${selectedChatId}`),
        apiRequest('/api/chats'),
      ])
      setActiveChat((current) => current?.id === chat.id
        ? { ...chat, messages: mergeMessages(current.messages, chat.messages) }
        : chat)
      setChats(activeChats)
    } catch (requestError) {
      setError(requestError.message)
    }
  }

  async function respondToQuote(quote, action) {
    if (!activeChat || respondingToQuoteId) return
    setRespondingToQuoteId(String(quote.id))
    setError('')
    try {
      await apiRequest(`/api/chats/${activeChat.id}/workflow/quotes/${quote.id}/${action}`, {
        method: 'POST',
        body: JSON.stringify({}),
      })
      await refreshSelectedConversation()
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setRespondingToQuoteId(null)
    }
  }

  function handleComposerKeyDown(event) {
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault()
      event.currentTarget.form?.requestSubmit()
    }
  }

  async function updateConversationStatus(action) {
    if (!activeChat || isUpdatingStatus) return
    const nextStatus = action === 'reopen' ? 'open' : 'closed'
    setIsUpdatingStatus(true)
    setError('')
    try {
      await apiRequest(`/api/chats/${activeChat.id}/${action}`, { method: 'POST' })
      setActiveChat((current) => current ? { ...current, status: nextStatus } : current)
      const { chats: activeChats } = await apiRequest('/api/chats')
      setChats(activeChats)
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setIsUpdatingStatus(false)
    }
  }

  function renderChatItem(chat) {
    return (
      <button
        type="button"
        key={chat.id}
        className={`chats-list-item${String(chat.id) === selectedChatId ? ' is-selected' : ''}`}
        onClick={() => selectChat(chat.id)}
      >
        <span className="chats-list-avatar"><UserRound size={17} /></span>
        <span className="chats-list-copy">
          <span className="chats-list-meta">
            <strong>{isStaff ? chat.customer_name : `Cotización ${formatRecordId(chat.id)}`}</strong>
            <time dateTime={chat.last_message_at}>{formatTime.format(new Date(chat.last_message_at))}</time>
          </span>
          <span className="chats-list-identifiers"><span>Cliente {formatRecordId(chat.customer_id)}</span><span>Chat {formatRecordId(chat.id)}</span></span>
          <span className="chats-list-preview">
            {chat.last_message || (chat.last_message_has_image ? 'Imagen adjunta' : 'Solicitud de cotización')}
          </span>
          <span className="chats-list-status"><Circle size={7} fill="currentColor" /> {chat.status === 'open' ? 'Abierto' : 'Cerrado'}</span>
        </span>
      </button>
    )
  }

  const invoiceTotal = activeChat?.items.reduce((total, item) => total + Number(item.unit_price) * item.quantity, 0) ?? 0

  if (isLoading) {
    return <main className="chats-page"><div className="chats-state"><LoaderCircle size={22} className="chats-spinner" /> Cargando conversaciones…</div></main>
  }

  if (!isAuthorized) {
    return (
      <main className="chats-page">
        <div className="chats-state chats-state-error">
          <MessageCircle size={24} />
          <h1>Acceso restringido</h1>
          <p>Este espacio está disponible para clientes y personal autorizado.</p>
          <a href="/cuenta">Volver a mi cuenta</a>
        </div>
      </main>
    )
  }

  return (
    <main className="chats-page">
      <header className="chats-topbar">
        <a className="chats-brand" href="/" aria-label="OH Montajes y Eventos, inicio">
          <img src={companyLogo} alt="OH Montajes y Eventos" />
        </a>
        <a className="chats-back" href="/cuenta"><ArrowLeft size={16} /> Mi cuenta</a>
      </header>

      <section className="chats-layout" aria-label={isStaff ? 'Panel de chats del equipo' : 'Mis chats de cotización'}>
        <aside className={`chats-rail${selectedChatId ? ' has-selection' : ''}`}>
          <div className="chats-rail-heading">
            <p className="chats-eyebrow"><span>OH / ATENCIÓN</span> {isStaff ? 'Equipo' : 'Cliente'}</p>
            <h1>{isStaff ? 'Conversaciones' : 'Mis cotizaciones'}</h1>
            <p>{isStaff ? 'Chats abiertos y cerrados con clientes' : 'Sigue aquí tus solicitudes'}</p>
          </div>
          <div className="chats-list" aria-live="polite">
            <label className="chats-list-search">
              <Search size={15} aria-hidden="true" />
              <input type="search" value={chatSearch} onChange={(event) => setChatSearch(event.target.value)} placeholder="Buscar por nombre o ID" aria-label="Buscar chats por nombre, ID de cliente o ID de chat" />
              {chatSearch && <button type="button" onClick={() => setChatSearch('')} aria-label="Limpiar búsqueda"><X size={15} /></button>}
            </label>
            {normalizedChatSearch && filteredChats.length === 0 ? (
              <p className="chats-list-search-empty">No encontramos chats con ese nombre o ID.</p>
            ) : (
              <>
                <section className="chats-list-section" aria-labelledby="open-chats-title">
                  <h2 id="open-chats-title">Abiertos <span>{openChats.length}</span></h2>
                  {openChats.length > 0
                    ? openChats.map((chat) => renderChatItem(chat))
                    : <div className="chats-list-section-empty"><p>{isStaff ? 'No hay chats abiertos.' : 'No tienes cotizaciones abiertas.'}</p>{!isStaff && chats.length === 0 && <a href="/galeria">Explorar galería</a>}</div>}
                </section>
                <section className="chats-list-section" aria-labelledby="closed-chats-title">
                  <h2 id="closed-chats-title">Cerrados <span>{closedChats.length}</span></h2>
                  {closedChats.length > 0
                    ? closedChats.map((chat) => renderChatItem(chat))
                    : <p className="chats-list-section-empty">{isStaff ? 'No hay chats cerrados.' : 'No tienes cotizaciones cerradas.'}</p>}
                </section>
              </>
            )}
          </div>
          {chats.length > 0 && !selectedChatId && <p className="chats-select-prompt">Selecciona un chat para ver la conversación.</p>}
          <div className="chats-rail-footer"><span>{account.name}</span><span>{isStaff ? 'Panel de equipo' : 'Atención OH'}</span></div>
        </aside>

        <section className={`chats-conversation${selectedChatId ? ' has-chat' : ''}`} aria-label="Conversación">
          {activeChat ? (
            <>
              <header className="chat-conversation-header">
                <button className="chat-mobile-back" type="button" aria-label="Volver a conversaciones" onClick={() => { setSelectedChatId(null); setActiveChat(null); window.history.replaceState(null, '', '/cuenta/chats') }}>
                  <ArrowLeft size={18} />
                </button>
                <span className="chat-header-avatar"><UserRound size={19} /></span>
                <div className="chat-header-copy">
                  <strong>{isStaff ? activeChat.customerName : 'Equipo OH Montajes'}</strong>
                  <span>Cliente {formatRecordId(activeChat.customerId)} · Chat {formatRecordId(activeChat.id)}{isStaff ? ` · ${activeChat.customerEmail}` : ''}</span>
                </div>
                <span className={`chat-status${activeChat.status === 'open' ? ' is-open' : ''}`}>
                  <Circle size={7} fill="currentColor" /> {activeChat.status === 'open' ? 'Abierto' : 'Cerrado'}
                </span>
                <button className="chat-workflow-button" type="button" onClick={() => setIsWorkflowOpen(true)} title="Cotización y pedido" aria-label="Abrir cotización y pedido">
                  <ClipboardList size={16} /><span>Cotización y pedido</span>
                </button>
                <button className="chat-invoice-button" type="button" onClick={() => setIsInvoiceOpen(true)}>
                  <FileText size={16} /> <span>Ver solicitud</span>
                </button>
                {isStaff && activeChat.status === 'open' && (
                  <button className="chat-close-button" type="button" onClick={() => updateConversationStatus('close')} disabled={isUpdatingStatus} title="Cerrar conversación" aria-label="Cerrar conversación">
                    {isUpdatingStatus ? <LoaderCircle size={17} className="chats-spinner" /> : <X size={17} />}
                  </button>
                )}
                {canReopenChat && activeChat.status === 'closed' && (
                  <button className="chat-reopen-button" type="button" onClick={() => updateConversationStatus('reopen')} disabled={isUpdatingStatus} title="Reabrir conversación" aria-label="Reabrir conversación">
                    {isUpdatingStatus ? <LoaderCircle size={17} className="chats-spinner" /> : <RotateCcw size={17} />}
                  </button>
                )}
              </header>

              <div className="chat-message-list" ref={messageListRef} onScroll={handleMessageListScroll} aria-live="polite">
                <div className="chat-start-note">
                  <span>Solicitud recibida</span>
                  <p>El equipo de OH Montajes y Eventos revisará disponibilidad, personalizaciones y costos, y te enviará la cotización final por este chat. Mantente atento.</p>
                  <time>{formatDate.format(new Date(activeChat.createdAt))}</time>
                </div>
                {activeChat.messages.map((message) => {
                  const isOwnMessage = String(message.senderId) === String(account.id)
                  const senderName = message.senderName ?? (isOwnMessage ? account.name : 'Equipo OH')
                  const senderRole = getRoleInfo(message.senderRole)
                  return (
                    <article className={`chat-message${isOwnMessage ? ' is-own' : ''}`} key={message.id}>
                      <span className="chat-message-author" aria-label={`${senderName}, ${senderRole.label}`}>
                        {senderName}
                        <span className="chat-message-role" data-role={senderRole.id} style={{ '--role-color': senderRole.color }}>{senderRole.label}</span>
                      </span>
                      {message.order ? (
                        <div className="chat-quote-embed chat-order-embed" aria-label={`Pedido OH-${String(message.order.id).padStart(6, '0')}`}>
                          <div className="chat-quote-embed-main">
                            <div className="chat-quote-embed-heading"><span>OH / PEDIDO</span><small data-status={message.order.status}>{orderStatusLabels[message.order.status] ?? message.order.status}</small></div>
                            <strong className="chat-quote-embed-title">Pedido OH-{String(message.order.id).padStart(6, '0')}</strong>
                            <div className="chat-quote-embed-event"><strong>{message.order.eventName}</strong><span>{message.order.venue}</span></div>
                            <div className="chat-order-embed-dates">
                              <span>Montaje <b>{formatDateTime.format(new Date(message.order.setupAt))}</b></span>
                              <span>Evento <b>{formatDateTime.format(new Date(message.order.eventAt))}</b></span>
                              <span>Desmontaje <b>{formatDateTime.format(new Date(message.order.dismantleAt))}</b></span>
                            </div>
                            <div className="chat-order-embed-coordinator"><span>Coordinación general</span><strong>{message.order.coordinatorName}</strong></div>
                            <div className="chat-order-embed-tasks">
                              <strong>Tareas asignadas</strong>
                              {message.order.tasks.map((task) => (
                                <div key={task.label}><span>{task.label} · {task.assignedToName}</span><b>{taskStatusLabels[task.status] ?? task.status}</b></div>
                              ))}
                            </div>
                            <div className="chat-quote-embed-footer">
                              <time dateTime={message.createdAt}>{formatTime.format(new Date(message.createdAt))}</time>
                              {isOwnMessage && message.isRead && <span>Mensaje visto.</span>}
                            </div>
                          </div>
                        </div>
                      ) : message.quote ? (
                        <div className="chat-quote-embed" aria-label={`Cotización versión ${message.quote.version}`}>
                          <div className="chat-quote-embed-main">
                            <div className="chat-quote-embed-heading"><span>OH / COTIZACIÓN</span><small data-status={message.quote.status}>{quoteStatusLabels[message.quote.status]}</small></div>
                            <strong className="chat-quote-embed-title">Cotización · versión {message.quote.version}</strong>
                            {(message.quote.status === 'accepted' || message.quote.status === 'rejected') && (
                              <p className="chat-quote-decision-notice" role="status">
                                {account.role === 'client'
                                  ? `Tú ${message.quote.status === 'accepted' ? 'aceptaste' : 'rechazaste'} la cotización ${message.quote.version}.`
                                  : `El cliente ${message.quote.status === 'accepted' ? 'aceptó' : 'rechazó'} la cotización ${message.quote.version}.`}
                              </p>
                            )}
                            <div className="chat-quote-embed-event"><strong>{message.quote.eventName}</strong><span>{message.quote.venue}</span></div>
                            <div className="chat-quote-embed-dates"><span>Montaje <b>{formatDateTime.format(new Date(message.quote.setupAt))}</b></span><span>Desmontaje <b>{formatDateTime.format(new Date(message.quote.dismantleAt))}</b></span></div>
                            <div className="chat-quote-embed-subtotal"><span>Subtotal de líneas</span><strong>{formatCurrency.format(Number(message.quote.subtotalAmount))}</strong></div>
                            {Number(message.quote.adjustmentAmount) !== 0 && (
                              <div className="chat-quote-embed-adjustment"><span>Ajuste <b>{formatCurrency.format(Number(message.quote.adjustmentAmount))}</b></span>{message.quote.adjustmentNote && <small>{message.quote.adjustmentNote}</small>}</div>
                            )}
                            <div className="chat-quote-embed-total"><span>Precio final</span><strong>{formatCurrency.format(Number(message.quote.totalAmount))}</strong></div>
                            <div className="chat-quote-embed-actions">
                              <button className="chat-quote-view-button" type="button" onClick={() => setIsWorkflowOpen(true)}>Ver cotización</button>
                              {account.role === 'client' && activeChat.status === 'open' && message.quote.status === 'sent' && message.quote.isLatest && (
                                <>
                                  <button className="chat-quote-reject-button" type="button" onClick={() => respondToQuote(message.quote, 'reject')} disabled={respondingToQuoteId !== null}>
                                    {respondingToQuoteId === String(message.quote.id) ? <LoaderCircle size={14} className="chats-spinner" /> : <X size={14} />} Rechazar
                                  </button>
                                  <button className="chat-quote-accept-button" type="button" onClick={() => respondToQuote(message.quote, 'accept')} disabled={respondingToQuoteId !== null}>
                                    {respondingToQuoteId === String(message.quote.id) ? <LoaderCircle size={14} className="chats-spinner" /> : <Check size={14} />} Aprobar
                                  </button>
                                </>
                              )}
                            </div>
                            <div className="chat-quote-embed-footer">
                              <time dateTime={message.createdAt}>{formatTime.format(new Date(message.createdAt))}</time>
                              {isOwnMessage && message.isRead && <span>Mensaje visto.</span>}
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="chat-message-bubble">
                          {message.body && <p>{message.body}</p>}
                          {message.imageUrl && <a href={message.imageUrl} target="_blank" rel="noreferrer"><img src={message.imageUrl} alt="Imagen adjunta a la conversación" loading="lazy" onLoad={() => { if (shouldAutoScrollRef.current) scrollToLatestMessage() }} /></a>}
                          <time dateTime={message.createdAt}>{formatTime.format(new Date(message.createdAt))}</time>
                          {isOwnMessage && message.isRead && <span className="chat-message-read">Mensaje visto.</span>}
                        </div>
                      )}
                    </article>
                  )
                })}
                {activeChat.typingUsers?.length > 0 && (() => {
                  const typingUser = activeChat.typingUsers[0]
                  const typingRole = getRoleInfo(typingUser.role)
                  return (
                    <article className="chat-message chat-message-typing" role="status" aria-label={`${typingUser.name} está escribiendo`}>
                      <span className="chat-message-author">
                        {typingUser.name}
                        <span className="chat-message-role" data-role={typingRole.id} style={{ '--role-color': typingRole.color }}>{typingRole.label}</span>
                      </span>
                      <span className="chat-typing-bubble" aria-hidden="true">
                        <span />
                        <span />
                        <span />
                      </span>
                    </article>
                  )
                })()}
              </div>

              {error && <p className="chat-error" role="alert">{error}</p>}
              {activeChat.status === 'open' ? (
                <form className="chat-composer" onSubmit={handleSubmit}>
                  {selectedImage && (
                    <div className="chat-image-preview">
                      <img src={imagePreview} alt="Vista previa de la imagen seleccionada" />
                      <span>{selectedImage.name}</span>
                      <button type="button" onClick={() => setImageFile(null)} aria-label="Quitar imagen"><X size={15} /></button>
                    </div>
                  )}
                  <label className="chat-attach-button" title="Adjuntar imagen">
                    <ImagePlus size={19} />
                    <input type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => { const file = event.target.files?.[0] ?? null; setImageFile(file); if (file) markTyping(); event.currentTarget.value = '' }} />
                  </label>
                  <textarea value={draft} onChange={(event) => { setDraft(event.target.value); markTyping() }} onKeyDown={handleComposerKeyDown} maxLength={2000} rows={1} placeholder="Escribe un mensaje…" aria-label="Escribe un mensaje" />
                  <button className="chat-send-button" type="submit" disabled={isSending || (!draft.trim() && !selectedImage)} aria-label="Enviar mensaje" title="Enviar mensaje">
                    {isSending ? <LoaderCircle size={17} className="chats-spinner" /> : <Send size={17} />}
                  </button>
                </form>
              ) : (
                <div className="chat-closed-notice"><Check size={16} /> Esta conversación está cerrada.</div>
              )}
            </>
          ) : (
            <div className="chats-welcome">
              <span><MessageCircle size={25} /></span>
              <h2>{chats.length ? 'Elige una conversación' : 'Aquí comienza la conversación'}</h2>
              <p>{chats.length ? 'Selecciona un chat de la lista para ver los mensajes y la cotización.' : 'Cuando solicites una cotización desde la galería, el chat aparecerá aquí.'}</p>
              {chats.length === 0 && !isStaff && <a href="/galeria">Ir a la galería</a>}
            </div>
          )}
        </section>
      </section>

      {activeChat && (
        <dialog className="chat-workflow-dialog" ref={workflowDialogRef} onClose={() => setIsWorkflowOpen(false)} onCancel={(event) => { event.preventDefault(); setIsWorkflowOpen(false) }}>
          <QuoteWorkflowPanel chat={activeChat} account={account} isStaff={isStaff} isOpen={isWorkflowOpen} onClose={() => setIsWorkflowOpen(false)} onQuoteSubmitted={refreshSelectedConversation} />
        </dialog>
      )}

      <dialog className="chat-invoice-dialog" ref={invoiceDialogRef} onClose={() => setIsInvoiceOpen(false)} onCancel={(event) => { event.preventDefault(); setIsInvoiceOpen(false) }}>
        {activeChat && (
          <div className="chat-invoice-content">
            <header className="chat-invoice-header">
              <div><p className="chats-eyebrow"><span>OH / SOLICITUD</span> Valores de referencia</p><h2>Resumen de solicitud</h2></div>
              <button type="button" aria-label="Cerrar solicitud" onClick={() => setIsInvoiceOpen(false)}><X size={19} /></button>
            </header>
            <div className="chat-invoice-customer"><span>Cliente</span><strong>{activeChat.customerName ?? account.name}</strong><small>{activeChat.customerEmail ?? account.email}</small></div>
            <div className="chat-invoice-items">
              {activeChat.items.map((item) => (
                <div className="chat-invoice-item" key={item.product_id}>
                  <div><span>{item.category_name}</span><strong>{item.product_name}</strong><small>{item.quantity} × {formatCurrency.format(Number(item.unit_price))}</small></div>
                  <strong>{formatCurrency.format(Number(item.unit_price) * item.quantity)}</strong>
                </div>
              ))}
            </div>
            <div className="chat-invoice-total"><span>Referencia del catálogo</span><strong>{formatCurrency.format(invoiceTotal)}</strong></div>
            <p className="chat-invoice-note">Este importe no es una cotización final. El equipo confirmará disponibilidad, personalizaciones y costos desde Cotización y pedido.</p>
          </div>
        )}
      </dialog>
    </main>
  )
}

export default ChatsPage