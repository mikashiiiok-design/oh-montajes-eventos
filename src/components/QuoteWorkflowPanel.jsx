import { useEffect, useState } from 'react'
import { Check, LoaderCircle, Plus, Send, Trash2, X } from 'lucide-react'
import { galleryCategories } from '../data/gallery.js'
import { getRoleInfo } from '../../shared/roles.js'
import { apiRequest } from '../utils/api.js'
import './QuoteWorkflowPanel.css'

const catalogProducts = galleryCategories.flatMap((category) => category.products.map((product) => ({
  ...product,
  categoryName: category.name,
})) )
const productById = new Map(catalogProducts.map((product) => [product.id, product]))
const taskDefinitions = [
  { key: 'preparation', label: 'Preparar mobiliario' },
  { key: 'delivery', label: 'Despacho y transporte' },
  { key: 'installation', label: 'Montaje' },
  { key: 'dismantling', label: 'Desmontaje' },
  { key: 'return_check', label: 'Retorno e inspección' },
]
const quoteStatuses = {
  sent: 'Enviada',
  accepted: 'Aceptada',
  rejected: 'Rechazada',
  superseded: 'Reemplazada',
}
const taskStatuses = {
  assigned: 'Asignada',
  in_progress: 'En curso',
  completed: 'Completada',
  blocked: 'Bloqueada',
}
const formatCurrency = new Intl.NumberFormat('es-CO', {
  style: 'currency',
  currency: 'COP',
  maximumFractionDigits: 0,
})
const formatDate = new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'short', year: 'numeric' })
const formatDateTime = new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })

function makeQuoteLine(item = {}) {
  const product = productById.get(item.productId ?? item.product_id)
  return {
    key: globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`,
    productId: product?.id ?? '',
    productName: product?.name ?? item.productName ?? item.product_name ?? '',
    categoryName: product?.categoryName ?? item.categoryName ?? item.category_name ?? '',
    description: product?.detail ?? item.description ?? '',
    quantity: Number(item.quantity ?? 1),
    unitPrice: Number(item.unitPrice ?? item.unit_price ?? product?.price ?? 0),
    customizations: item.customizations ?? {},
  }
}

function toDateTimeLocal(value) {
  if (!value) return ''
  const date = new Date(value)
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
}

function QuoteWorkflowPanel({ chat, account, isStaff, isOpen, onClose, onQuoteSubmitted }) {
  const [workflow, setWorkflow] = useState({ quotes: [], order: null })
  const [staff, setStaff] = useState([])
  const [quoteLines, setQuoteLines] = useState(() => chat.items.map((item) => makeQuoteLine(item)))
  const [quoteTerms, setQuoteTerms] = useState('')
  const [quoteEventName, setQuoteEventName] = useState('')
  const [quoteVenue, setQuoteVenue] = useState('')
  const [quoteFinalAmount, setQuoteFinalAmount] = useState('')
  const [adjustmentNote, setAdjustmentNote] = useState('')
  const [quoteSetupAt, setQuoteSetupAt] = useState('')
  const [quoteDismantleAt, setQuoteDismantleAt] = useState('')
  const [orderDraft, setOrderDraft] = useState({
    eventName: '',
    venue: '',
    setupAt: '',
    eventAt: '',
    dismantleAt: '',
    coordinatorId: String(account.id),
    taskAssignments: Object.fromEntries(taskDefinitions.map((task) => [task.key, String(account.id)])),
  })
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [isAccepting, setIsAccepting] = useState(null)
  const [isRejecting, setIsRejecting] = useState(null)
  const [updatingTaskId, setUpdatingTaskId] = useState(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const latestQuote = workflow.quotes[0] ?? null
  const acceptedQuote = workflow.quotes.find((quote) => quote.status === 'accepted')
  const quoteSubtotal = quoteLines.reduce((total, line) => total + Number(line.quantity || 0) * Number(line.unitPrice || 0), 0)
  const quoteTotal = quoteFinalAmount === '' ? quoteSubtotal : Number(quoteFinalAmount)
  const quoteAdjustment = quoteTotal - quoteSubtotal
  const orderEventName = acceptedQuote?.event_name ?? orderDraft.eventName
  const orderVenue = acceptedQuote?.venue ?? orderDraft.venue
  const orderSetupAt = toDateTimeLocal(acceptedQuote?.setup_at) || orderDraft.setupAt
  const orderDismantleAt = toDateTimeLocal(acceptedQuote?.dismantle_at) || orderDraft.dismantleAt

  useEffect(() => {
    if (!isOpen) return undefined
    let isActive = true

    async function loadWorkflow() {
      setIsLoading(true)
      try {
        const requests = [apiRequest(`/api/chats/${chat.id}/workflow`)]
        if (isStaff) requests.push(apiRequest(`/api/chats/${chat.id}/workflow/staff`))
        const [workflowResult, staffResult] = await Promise.all(requests)
        if (isActive) {
          setWorkflow(workflowResult)
          setStaff(staffResult?.staff ?? [])
        }
      } catch (requestError) {
        if (isActive) setError(requestError.message)
      } finally {
        if (isActive) setIsLoading(false)
      }
    }

    loadWorkflow()
    return () => { isActive = false }
  }, [chat.id, isOpen, isStaff])

  function updateQuoteLine(key, changes) {
    setQuoteLines((current) => current.map((line) => line.key === key ? { ...line, ...changes } : line))
  }

  function updateCustomization(key, field, value) {
    setQuoteLines((current) => current.map((line) => line.key === key
      ? { ...line, customizations: { ...line.customizations, [field]: value } }
      : line))
  }

  async function refreshWorkflow() {
    const result = await apiRequest(`/api/chats/${chat.id}/workflow`)
    setWorkflow(result)
  }

  async function submitQuote(event) {
    event.preventDefault()
    if (isSaving) return
    if (!quoteSetupAt || !quoteDismantleAt || new Date(quoteSetupAt) >= new Date(quoteDismantleAt)) {
      setError('Indica fechas válidas de montaje y desmontaje, en ese orden.')
      return
    }
    if (!quoteEventName.trim() || !quoteVenue.trim()) {
      setError('Indica el nombre del evento y el lugar antes de enviar la cotización.')
      return
    }
    if (!Number.isSafeInteger(quoteTotal) || quoteTotal < 0) {
      setError('El precio final debe ser un importe válido.')
      return
    }
    if (quoteAdjustment !== 0 && !adjustmentNote.trim()) {
      setError('Explica el motivo del ajuste al subtotal.')
      return
    }
    setError('')
    setNotice('')
    setIsSaving(true)
    try {
      const toIsoString = (value) => new Date(value).toISOString()
      await apiRequest(`/api/chats/${chat.id}/workflow/quotes`, {
        method: 'POST',
        body: JSON.stringify({
          items: quoteLines.map((line) => ({
            productId: line.productId || undefined,
            productName: line.productName,
            categoryName: line.categoryName,
            description: line.description,
            quantity: Number(line.quantity),
            unitPrice: Number(line.unitPrice),
            customizations: Object.fromEntries(Object.entries(line.customizations).filter(([, value]) => value.trim())),
          })),
          eventName: quoteEventName,
          venue: quoteVenue,
          totalAmount: quoteTotal,
          adjustmentNote,
          terms: quoteTerms,
          setupAt: toIsoString(quoteSetupAt),
          dismantleAt: toIsoString(quoteDismantleAt),
        }),
      })
      await onQuoteSubmitted?.()
      onClose()
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setIsSaving(false)
    }
  }

  async function acceptQuote(quote) {
    if (isAccepting) return
    setError('')
    setNotice('')
    setIsAccepting(quote.id)
    try {
      await apiRequest(`/api/chats/${chat.id}/workflow/quotes/${quote.id}/accept`, { method: 'POST' })
      await refreshWorkflow()
      setNotice('Aceptaste esta cotización. El equipo ya puede preparar el pedido.')
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setIsAccepting(null)
    }
  }

  async function rejectQuote(quote) {
    if (isRejecting) return
    setError('')
    setNotice('')
    setIsRejecting(quote.id)
    try {
      await apiRequest(`/api/chats/${chat.id}/workflow/quotes/${quote.id}/reject`, {
        method: 'POST',
        body: JSON.stringify({}),
      })
      await refreshWorkflow()
      setNotice('Cotización rechazada. Puedes escribirle al equipo para solicitar ajustes.')
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setIsRejecting(null)
    }
  }

  async function createOrder(event) {
    event.preventDefault()
    if (isSaving) return
    setError('')
    setNotice('')
    setIsSaving(true)
    try {
      const toIsoString = (value) => new Date(value).toISOString()
      await apiRequest(`/api/chats/${chat.id}/workflow/orders`, {
        method: 'POST',
        body: JSON.stringify({
          ...orderDraft,
          eventName: orderEventName,
          venue: orderVenue,
          setupAt: toIsoString(orderSetupAt),
          eventAt: toIsoString(orderDraft.eventAt),
          dismantleAt: toIsoString(orderDismantleAt),
        }),
      })
      await refreshWorkflow()
      setNotice('Pedido creado y asignado para planificación.')
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setIsSaving(false)
    }
  }

  async function updateTask(taskId, status) {
    setError('')
    setUpdatingTaskId(taskId)
    try {
      await apiRequest(`/api/chats/${chat.id}/workflow/tasks/${taskId}`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      })
      await refreshWorkflow()
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setUpdatingTaskId(null)
    }
  }

  function changeProduct(line, productId) {
    const product = productById.get(productId)
    updateQuoteLine(line.key, {
      productId,
      productName: product?.name ?? '',
      categoryName: product?.categoryName ?? '',
      description: product?.detail ?? '',
      unitPrice: product?.price ?? 0,
    })
  }

  return (
    <div className="quote-workflow-panel">
      <header className="quote-workflow-header">
        <div>
          <p className="chats-eyebrow"><span>OH / COMERCIAL</span> Del chat al pedido</p>
          <h2>Cotización y pedido</h2>
          <p>La solicitud inicial es una referencia. El pedido se crea solo después de que aceptes el precio final.</p>
        </div>
        <button className="quote-workflow-close" type="button" onClick={onClose} aria-label="Cerrar cotización y pedido"><X size={18} /></button>
      </header>

      {error && <p className="quote-workflow-error" role="alert">{error}</p>}
      {notice && <p className="quote-workflow-notice" role="status">{notice}</p>}

      {isLoading ? (
        <div className="quote-workflow-state"><LoaderCircle size={20} className="chats-spinner" /> Cargando cotización y pedido…</div>
      ) : (
        <div className="quote-workflow-content">
          <section className="quote-workflow-section">
            <div className="quote-workflow-section-heading">
              <div><p className="quote-workflow-kicker">01 / PRECIO FINAL</p><h3>Versiones de cotización</h3></div>
              <span className="quote-workflow-count">{workflow.quotes.length}</span>
            </div>

            {workflow.quotes.length === 0 && <p className="quote-workflow-empty">Aún no hay una oferta formal. Los valores del carrito son solo referencias.</p>}
            {workflow.quotes.map((quote) => (
              <article className="quote-version" key={quote.id}>
                <header className="quote-version-header">
                  <div><strong>Versión {quote.version}</strong><span className={`quote-status is-${quote.status}`}>{quoteStatuses[quote.status]}</span></div>
                  <strong className="quote-version-total">{formatCurrency.format(Number(quote.total_amount))}</strong>
                </header>
                <div className="quote-version-event"><strong>{quote.event_name}</strong><span>{quote.venue}</span></div>
                <div className="quote-version-items">
                  {quote.items.map((item) => (
                    <div className="quote-version-item" key={item.id}>
                      <div><strong>{item.quantity} × {item.product_name}</strong><span>{item.category_name}{item.description ? ` · ${item.description}` : ''}</span>
                        {Object.entries(item.customizations ?? {}).length > 0 && <small>{Object.entries(item.customizations).map(([field, value]) => `${field}: ${value}`).join(' · ')}</small>}
                      </div>
                      <span>{formatCurrency.format(Number(item.unit_price) * item.quantity)}</span>
                    </div>
                  ))}
                </div>
                {Number(quote.adjustment_amount) !== 0 && (
                  <div className="quote-version-adjustment">
                    <span>Ajuste sobre subtotal <b>{formatCurrency.format(Number(quote.adjustment_amount))}</b></span>
                    {quote.adjustment_note && <small>{quote.adjustment_note}</small>}
                  </div>
                )}
                {quote.terms && <p className="quote-version-terms">{quote.terms}</p>}
                <footer className="quote-version-footer">
                  <span>Enviada por {quote.created_by_name} · {formatDate.format(new Date(quote.created_at))}</span>
                  {account.role === 'client' && quote.status === 'sent' && quote.isLatest && !workflow.order && (
                    <div className="quote-response-actions">
                      <button className="quote-reject-button" type="button" onClick={() => rejectQuote(quote)} disabled={isAccepting !== null || isRejecting !== null}>
                        {isRejecting === quote.id ? <LoaderCircle size={15} className="chats-spinner" /> : <X size={15} />} Rechazar
                      </button>
                      <button className="quote-accept-button" type="button" onClick={() => acceptQuote(quote)} disabled={isAccepting !== null || isRejecting !== null}>
                        {isAccepting === quote.id ? <LoaderCircle size={15} className="chats-spinner" /> : <Check size={15} />} Aceptar
                      </button>
                    </div>
                  )}
                  {quote.status === 'accepted' && <strong className="quote-accepted-by">Aceptada por {quote.accepted_by_name}</strong>}
                  {quote.status === 'rejected' && <strong className="quote-rejected-by">Rechazada por {quote.rejected_by_name}</strong>}
                </footer>
                <div className="quote-version-dates"><span>Montaje <b>{formatDateTime.format(new Date(quote.setup_at))}</b></span><span>Desmontaje <b>{formatDateTime.format(new Date(quote.dismantle_at))}</b></span></div>
                {quote.rejection_reason && <p className="quote-version-rejection">Motivo: {quote.rejection_reason}</p>}
              </article>
            ))}

            {isStaff && !workflow.order && !acceptedQuote && chat.status === 'open' && (
              <form className="quote-create-form" onSubmit={submitQuote}>
                <div className="quote-create-heading">
                  <h4>{latestQuote ? 'Preparar nueva versión' : 'Preparar precio final'}</h4>
                  <p>Confirma disponibilidad, personalizaciones y costos antes de enviarla.</p>
                </div>
                <div className="quote-line-list">
                  {quoteLines.map((line) => (
                    <fieldset className="quote-line-editor" key={line.key}>
                      <legend>Artículo o servicio</legend>
                      <div className="quote-line-product-row">
                        <select aria-label="Producto de la cotización" value={line.productId} onChange={(event) => changeProduct(line, event.target.value)}>
                          <option value="">Artículo/servicio personalizado</option>
                          {galleryCategories.map((category) => (
                            <optgroup label={category.name} key={category.id}>
                              {category.products.map((product) => <option value={product.id} key={product.id}>{product.name}</option>)}
                            </optgroup>
                          ))}
                        </select>
                        <label>Cantidad<input type="number" min="1" max="99" required value={line.quantity} onChange={(event) => updateQuoteLine(line.key, { quantity: event.target.value })} /></label>
                        <label>Precio unitario<input type="number" min="0" max="1000000000" step="1000" required value={line.unitPrice} onChange={(event) => updateQuoteLine(line.key, { unitPrice: event.target.value })} /></label>
                        <button className="quote-remove-line" type="button" onClick={() => setQuoteLines((current) => current.filter((item) => item.key !== line.key))} aria-label="Quitar artículo"><Trash2 size={16} /></button>
                      </div>
                      {!line.productId && (
                        <div className="quote-line-manual-row">
                          <label>Nombre<input maxLength={160} required value={line.productName} onChange={(event) => updateQuoteLine(line.key, { productName: event.target.value })} placeholder="Transporte, montaje u otro servicio" /></label>
                          <label>Categoría<input maxLength={100} value={line.categoryName} onChange={(event) => updateQuoteLine(line.key, { categoryName: event.target.value })} placeholder="Servicio" /></label>
                          <label>Descripción<input maxLength={300} value={line.description} onChange={(event) => updateQuoteLine(line.key, { description: event.target.value })} placeholder="Alcance del servicio" /></label>
                        </div>
                      )}
                      <div className="quote-customization-grid">
                        <label>Color<input maxLength={300} value={line.customizations.color ?? ''} onChange={(event) => updateCustomization(line.key, 'color', event.target.value)} placeholder="Ej. verde oliva / RAL 6003" /></label>
                        <label>Acabado<input maxLength={300} value={line.customizations.finish ?? ''} onChange={(event) => updateCustomization(line.key, 'finish', event.target.value)} placeholder="Ej. mate" /></label>
                        <label>Medidas<input maxLength={300} value={line.customizations.dimensions ?? ''} onChange={(event) => updateCustomization(line.key, 'dimensions', event.target.value)} placeholder="Si requiere una medida especial" /></label>
                        <label>Otros detalles<input maxLength={300} value={line.customizations.details ?? ''} onChange={(event) => updateCustomization(line.key, 'details', event.target.value)} placeholder="Personalización o referencia" /></label>
                      </div>
                    </fieldset>
                  ))}
                </div>
                <button className="quote-add-line" type="button" onClick={() => setQuoteLines((current) => [...current, makeQuoteLine()])}><Plus size={15} /> Agregar artículo o servicio</button>
                <div className="quote-terms-grid">
                  <label>Condiciones<textarea maxLength={2000} rows={3} value={quoteTerms} onChange={(event) => setQuoteTerms(event.target.value)} placeholder="Disponibilidad, transporte, montaje u otras condiciones acordadas." /></label>
                  <label>Feria o evento<input maxLength={160} required value={quoteEventName} onChange={(event) => setQuoteEventName(event.target.value)} placeholder="Nombre del evento" /></label>
                  <label>Lugar<input maxLength={240} required value={quoteVenue} onChange={(event) => setQuoteVenue(event.target.value)} placeholder="Recinto, pabellón y dirección" /></label>
                  <label>Fecha y hora de montaje<input type="datetime-local" required value={quoteSetupAt} onChange={(event) => setQuoteSetupAt(event.target.value)} /></label>
                  <label>Fecha y hora de desmontaje<input type="datetime-local" required value={quoteDismantleAt} onChange={(event) => setQuoteDismantleAt(event.target.value)} /></label>
                </div>
                <div className="quote-create-footer">
                  <div className="quote-price-controls">
                    <span>Subtotal de líneas <strong>{formatCurrency.format(quoteSubtotal)}</strong></span>
                    <label>Precio final acordado<input type="number" min="0" max="10000000000000" step="1000" value={quoteFinalAmount} placeholder={String(quoteSubtotal)} onChange={(event) => setQuoteFinalAmount(event.target.value)} /></label>
                    <small>Si lo dejas vacío, se usará el subtotal de las líneas.</small>
                    {quoteAdjustment !== 0 && <span className="quote-adjustment-preview">Ajuste <strong>{formatCurrency.format(quoteAdjustment)}</strong></span>}
                  </div>
                  {quoteAdjustment !== 0 && <label className="quote-adjustment-reason">Motivo del ajuste<input maxLength={500} required value={adjustmentNote} onChange={(event) => setAdjustmentNote(event.target.value)} placeholder="Descuento, disponibilidad, costos adicionales…" /></label>}
                  <button className="quote-send-button" type="submit" disabled={isSaving || quoteLines.length === 0 || quoteTotal <= 0}>
                    {isSaving ? <LoaderCircle size={16} className="chats-spinner" /> : <Send size={15} />} Enviar cotización
                  </button>
                </div>
              </form>
            )}
            {isStaff && chat.status !== 'open' && !workflow.order && <p className="quote-workflow-empty">Reabre el chat para preparar o enviar una cotización.</p>}
            {acceptedQuote && isStaff && !workflow.order && (
              <p className="quote-workflow-notice">Cotización aceptada. Completa los datos del evento y las asignaciones para crear el pedido.</p>
            )}
          </section>

          <section className="quote-workflow-section quote-order-section">
            <div className="quote-workflow-section-heading">
              <div><p className="quote-workflow-kicker">02 / OPERACIÓN</p><h3>Pedido</h3></div>
              <span className={`quote-status${workflow.order ? ' is-accepted' : ''}`}>{workflow.order ? 'En planificación' : 'No creado'}</span>
            </div>

            {!workflow.order && !acceptedQuote && <p className="quote-workflow-empty">El pedido solo se crea después de que el cliente acepta una cotización.</p>}
            {isStaff && acceptedQuote && !workflow.order && (
              <form className="order-create-form" onSubmit={createOrder}>
                <div className="order-accepted-event"><p className="quote-workflow-kicker">DATOS DE LA COTIZACIÓN ACEPTADA</p><strong>{orderEventName}</strong><span>{orderVenue}</span><small>Evento, lugar y fechas de montaje/desmontaje se copian automáticamente.</small></div>
                {!acceptedQuote.event_name && <label>Nombre de la feria o evento<input maxLength={160} required value={orderEventName} onChange={(event) => setOrderDraft((current) => ({ ...current, eventName: event.target.value }))} placeholder="Nombre oficial del evento" /></label>}
                {!acceptedQuote.venue && <label>Lugar y dirección<input maxLength={240} required value={orderVenue} onChange={(event) => setOrderDraft((current) => ({ ...current, venue: event.target.value }))} placeholder="Recinto, pabellón y dirección" /></label>}
                <div className="order-date-grid">
                  <label>Montaje<input type="datetime-local" required readOnly={Boolean(acceptedQuote.setup_at)} value={orderSetupAt} onChange={(event) => setOrderDraft((current) => ({ ...current, setupAt: event.target.value }))} /></label>
                  <label>Evento<input type="datetime-local" required value={orderDraft.eventAt} onChange={(event) => setOrderDraft((current) => ({ ...current, eventAt: event.target.value }))} /></label>
                  <label>Desmontaje<input type="datetime-local" required readOnly={Boolean(acceptedQuote.dismantle_at)} value={orderDismantleAt} onChange={(event) => setOrderDraft((current) => ({ ...current, dismantleAt: event.target.value }))} /></label>
                </div>
                <label>Coordinación general<select required value={orderDraft.coordinatorId} onChange={(event) => setOrderDraft((current) => ({ ...current, coordinatorId: event.target.value }))}>
                  <option value="">Seleccionar responsable</option>
                  {staff.map((member) => <option value={member.id} key={member.id}>{member.name} · {getRoleInfo(member.role).label}</option>)}
                </select></label>
                <div className="order-task-assignments">
                  <h4>Responsables por tarea</h4>
                  {taskDefinitions.map((task) => (
                    <label key={task.key}>{task.label}<select required value={orderDraft.taskAssignments[task.key]} onChange={(event) => setOrderDraft((current) => ({ ...current, taskAssignments: { ...current.taskAssignments, [task.key]: event.target.value } }))}>
                      <option value="">Seleccionar responsable</option>
                      {staff.map((member) => <option value={member.id} key={member.id}>{member.name} · {getRoleInfo(member.role).label}</option>)}
                    </select></label>
                  ))}
                </div>
                <button className="quote-send-button order-create-button" type="submit" disabled={isSaving || staff.length === 0}>
                  {isSaving ? <LoaderCircle size={16} className="chats-spinner" /> : <Check size={16} />} Crear pedido y asignar tareas
                </button>
              </form>
            )}

            {workflow.order && (
              <div className="order-summary">
                <div className="order-summary-heading"><div><span>{workflow.order.event_name}</span><small>{workflow.order.venue}</small></div><strong>{workflow.order.coordinator_name}</strong></div>
                <div className="order-summary-dates"><span>Montaje <b>{formatDate.format(new Date(workflow.order.setup_at))}</b></span><span>Evento <b>{formatDate.format(new Date(workflow.order.event_at))}</b></span><span>Desmontaje <b>{formatDate.format(new Date(workflow.order.dismantle_at))}</b></span></div>
                <div className="order-task-list">
                  {workflow.order.tasks.map((task) => (
                    <label className="order-task-row" key={task.id}>
                      <span><strong>{task.label}</strong><small>{task.assigned_to_name}</small></span>
                      <select value={task.status} disabled={!isStaff || updatingTaskId === task.id} onChange={(event) => updateTask(task.id, event.target.value)} aria-label={`Estado de ${task.label}`}>
                        {Object.entries(taskStatuses).map(([value, label]) => <option value={value} key={value}>{label}</option>)}
                      </select>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  )
}

export default QuoteWorkflowPanel