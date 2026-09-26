import { useEffect, useRef, useState } from 'react'
import { ArrowLeft, ArrowRight, Minus, Plus, ShoppingBag, Trash2, TriangleAlert, X } from 'lucide-react'
import { galleryCategories } from '../data/gallery.js'
import { apiRequest } from '../utils/api.js'
import './GalleryPage.css'

const orderStorageKey = 'oh-gallery-order'
const formatCurrency = new Intl.NumberFormat('es-CO', {
  style: 'currency',
  currency: 'COP',
  maximumFractionDigits: 0,
})

function readSavedOrder() {
  try {
    const savedOrder = JSON.parse(window.sessionStorage.getItem(orderStorageKey) ?? '[]')
    return Array.isArray(savedOrder) ? savedOrder : []
  } catch {
    return []
  }
}

function GalleryPage() {
  const [activeCategoryId, setActiveCategoryId] = useState(null)
  const [order, setOrder] = useState(readSavedOrder)
  const [isOrderOpen, setIsOrderOpen] = useState(false)
  const [isOrderClosing, setIsOrderClosing] = useState(false)
  const [selectedProduct, setSelectedProduct] = useState(null)
  const [isQuantityClosing, setIsQuantityClosing] = useState(false)
  const [quantity, setQuantity] = useState(1)
  const [account, setAccount] = useState(null)
  const [isCheckingSession, setIsCheckingSession] = useState(true)
  const [quoteError, setQuoteError] = useState('')
  const [isQuoteNoticeOpen, setIsQuoteNoticeOpen] = useState(false)
  const [isQuoteNoticeClosing, setIsQuoteNoticeClosing] = useState(false)
  const quantityDialogRef = useRef(null)
  const orderDialogRef = useRef(null)
  const quoteNoticeDialogRef = useRef(null)
  const orderCloseTimeoutRef = useRef(null)
  const quantityCloseTimeoutRef = useRef(null)
  const quoteNoticeCloseTimeoutRef = useRef(null)

  const activeCategory = galleryCategories.find((category) => category.id === activeCategoryId)
  const orderCount = order.reduce((total, item) => total + item.quantity, 0)
  const orderTotal = order.reduce((total, item) => total + item.price * item.quantity, 0)

  useEffect(() => {
    const previousTitle = document.title
    const description = document.querySelector('meta[name="description"]')
    const previousDescription = description?.content
    const canonical = document.querySelector('link[rel="canonical"]')
    const previousCanonical = canonical?.href
    const pageDescription = 'Explora mobiliario y elementos para eventos: paneleria, sillas, decoracion, pantallas, barras y mas. Arma una lista y solicita una cotizacion.'

    document.title = 'Galeria de mobiliario para eventos | OH Montajes y Eventos'
    if (description) description.content = pageDescription
    else {
      const newDescription = document.createElement('meta')
      newDescription.name = 'description'
      newDescription.content = pageDescription
      document.head.append(newDescription)
    }
    if (canonical) canonical.href = `${window.location.origin}/galeria`
    else {
      const newCanonical = document.createElement('link')
      newCanonical.rel = 'canonical'
      newCanonical.href = `${window.location.origin}/galeria`
      document.head.append(newCanonical)
    }

    return () => {
      document.title = previousTitle
      if (description) description.content = previousDescription
      else document.querySelector('meta[name="description"]')?.remove()
      if (canonical) canonical.href = previousCanonical
      else document.querySelector('link[rel="canonical"]')?.remove()
    }
  }, [])

  useEffect(() => {
    let isActive = true

    apiRequest('/api/auth/me')
      .then(({ account: activeAccount }) => {
        if (isActive) setAccount(activeAccount)
      })
      .catch(() => {})
      .finally(() => {
        if (isActive) setIsCheckingSession(false)
      })

    return () => {
      isActive = false
    }
  }, [])

  useEffect(() => {
    try {
      window.sessionStorage.setItem(orderStorageKey, JSON.stringify(order))
    } catch {
      return undefined
    }
    return undefined
  }, [order])

  useEffect(() => {
    const dialog = quantityDialogRef.current
    if (!dialog) return
    if (selectedProduct && !dialog.open) dialog.showModal()
    if (!selectedProduct && dialog.open) dialog.close()
  }, [selectedProduct])

  useEffect(() => {
    const dialog = orderDialogRef.current
    if (!dialog) return
    if (isOrderOpen && !dialog.open) dialog.showModal()
    if (!isOrderOpen && dialog.open) dialog.close()
  }, [isOrderOpen])

  useEffect(() => {
    const dialog = quoteNoticeDialogRef.current
    if (!dialog) return
    if (isQuoteNoticeOpen && !dialog.open) dialog.showModal()
    if (!isQuoteNoticeOpen && dialog.open) dialog.close()
  }, [isQuoteNoticeOpen])

  useEffect(() => () => {
    window.clearTimeout(orderCloseTimeoutRef.current)
    window.clearTimeout(quantityCloseTimeoutRef.current)
    window.clearTimeout(quoteNoticeCloseTimeoutRef.current)
  }, [])

  useEffect(() => {
    if (!activeCategoryId) return
    const behavior = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth'
    document.getElementById('catalogo')?.scrollIntoView({ behavior, block: 'start' })
  }, [activeCategoryId])

  function openProductDialog(product) {
    window.clearTimeout(quantityCloseTimeoutRef.current)
    setIsQuantityClosing(false)
    setQuantity(1)
    setSelectedProduct(product)
  }

  function closeProductDialog() {
    if (!selectedProduct || isQuantityClosing) return
    setIsQuantityClosing(true)
    quantityCloseTimeoutRef.current = window.setTimeout(() => setSelectedProduct(null), 180)
  }

  function openOrderDialog() {
    window.clearTimeout(orderCloseTimeoutRef.current)
    setIsOrderClosing(false)
    setIsOrderOpen(true)
  }

  function closeOrderDialog() {
    if (!isOrderOpen || isOrderClosing) return
    setIsOrderClosing(true)
    orderCloseTimeoutRef.current = window.setTimeout(() => setIsOrderOpen(false), 220)
  }

  async function handleRequestQuote() {
    setQuoteError('')
    setIsCheckingSession(true)

    try {
      const { account: activeAccount } = await apiRequest('/api/auth/me')
      setAccount(activeAccount)
      if (!activeAccount) {
        window.location.assign('/cuenta?modo=registro')
        return
      }
      setIsQuoteNoticeClosing(false)
      setIsQuoteNoticeOpen(true)
    } catch {
      setQuoteError('No pudimos comprobar tu sesión. Intenta de nuevo en un momento.')
    } finally {
      setIsCheckingSession(false)
    }
  }

  function addSelectedProduct(event) {
    event.preventDefault()
    const selectedQuantity = Math.max(1, Math.min(99, Number(quantity) || 1))
    setOrder((currentOrder) => {
      const existingItem = currentOrder.find((item) => item.id === selectedProduct.id)
      if (existingItem) {
        return currentOrder.map((item) => (
          item.id === selectedProduct.id
            ? { ...item, quantity: Math.min(99, item.quantity + selectedQuantity) }
            : item
        ))
      }
      return [...currentOrder, { ...selectedProduct, quantity: selectedQuantity }]
    })
    closeProductDialog()
  }

  function changeQuantity(productId, difference) {
    setOrder((currentOrder) => currentOrder
      .map((item) => item.id === productId
        ? { ...item, quantity: Math.max(0, Math.min(99, item.quantity + difference)) }
        : item)
      .filter((item) => item.quantity > 0))
  }

  function closeQuoteNotice() {
    if (!isQuoteNoticeOpen || isQuoteNoticeClosing) return
    setIsQuoteNoticeClosing(true)
    quoteNoticeCloseTimeoutRef.current = window.setTimeout(() => setIsQuoteNoticeOpen(false), 180)
  }

  return (
    <div className="gallery-page">
      <section className="gallery-intro page-shell" data-reveal aria-labelledby="gallery-title">
        <div>
          <p className="gallery-eyebrow"><span>OH / 05</span> Catálogo para eventos</p>
          <h1 id="gallery-title">Piezas para darle forma a tu idea.</h1>
          <p className="gallery-lede">Explora mobiliario y elementos de ambientación. Arma una lista para solicitar una cotización a nuestro equipo.</p>
        </div>
        <div className="gallery-intro-aside">
          <span>08 categorías</span>
          <span>Precios de referencia en COP</span>
        </div>
      </section>

      <section className="gallery-categories page-shell" data-reveal aria-label="Categorías del catálogo">
        <div className="gallery-section-heading">
          <div>
            <p className="gallery-eyebrow"><span>01</span> Explora por categoría</p>
            <h2>¿Qué estás buscando?</h2>
          </div>
          {activeCategory && (
            <button className="gallery-back-button" type="button" onClick={() => setActiveCategoryId(null)}>
              <ArrowLeft size={16} /> Todas las categorías
            </button>
          )}
        </div>
        {!activeCategory && (
          <div className="gallery-category-grid" data-reveal-stagger data-reveal-step="70">
            {galleryCategories.map((category, index) => (
              <button className="gallery-category-card" key={category.id} type="button" onClick={() => setActiveCategoryId(category.id)}>
                <img src={category.image} alt={category.imageAlt} loading={index < 4 ? 'eager' : 'lazy'} decoding="async" />
                <span className="gallery-category-index">{String(index + 1).padStart(2, '0')}</span>
                <span className="gallery-category-copy">
                  <strong>{category.name}</strong>
                  <span>{category.description}</span>
                </span>
                <ArrowRight className="gallery-category-arrow" size={19} />
              </button>
            ))}
          </div>
        )}
      </section>

      {activeCategory && (
        <section className="gallery-catalog page-shell" id="catalogo" key={activeCategory.id} aria-labelledby="catalog-title">
          <div className="gallery-section-heading">
            <div>
              <p className="gallery-eyebrow"><span>02</span> {activeCategory.name}</p>
              <h2 id="catalog-title">Referencias disponibles</h2>
              <p className="gallery-catalog-description">{activeCategory.description}</p>
            </div>
            <span className="gallery-result-count">{activeCategory.products.length} referencias</span>
          </div>
          <div className="gallery-product-grid">
            {activeCategory.products.map((product, index) => (
              <article className="gallery-product" key={product.id} style={{ '--gallery-index': index }}>
                <div className="gallery-product-image">
                  <img src={activeCategory.image} alt={activeCategory.imageAlt} loading="lazy" decoding="async" />
                  <span>{String(index + 1).padStart(2, '0')} / {String(activeCategory.products.length).padStart(2, '0')}</span>
                </div>
                <div className="gallery-product-details">
                  <p className="gallery-product-category">{activeCategory.name}</p>
                  <h3>{product.name}</h3>
                  <p className="gallery-product-detail">{product.detail}</p>
                  <div className="gallery-product-purchase">
                    <div>
                      <strong>{formatCurrency.format(product.price)}</strong>
                      <span>por unidad / jornada</span>
                    </div>
                    <button className="gallery-add-button" type="button" onClick={() => openProductDialog({ ...product, category: activeCategory.name })}>
                      <Plus size={16} /> Agregar
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
          <p className="gallery-price-note">Tarifas ilustrativas antes de transporte, montaje e impuestos. El equipo confirmará disponibilidad y valor final en la cotización.</p>
        </section>
      )}

      <div className="gallery-order-bar" aria-live="polite">
        <span>{orderCount === 0 ? 'Tu pedido está vacío' : `${orderCount} ${orderCount === 1 ? 'unidad' : 'unidades'} · ${formatCurrency.format(orderTotal)}`}</span>
        <button type="button" onClick={openOrderDialog}>
          <ShoppingBag size={17} /> Ver pedido {orderCount > 0 && <b>{orderCount}</b>}
        </button>
      </div>

      <dialog
        className={`gallery-order-dialog${isOrderClosing ? ' is-closing' : ''}`}
        ref={orderDialogRef}
        onClose={() => { setIsOrderOpen(false); setIsOrderClosing(false) }}
        onCancel={(event) => { event.preventDefault(); closeOrderDialog() }}
        onClick={(event) => { if (event.target === event.currentTarget) closeOrderDialog() }}
      >
        <aside className="gallery-order-drawer" aria-labelledby="order-title">
          <div className="gallery-order-header">
            <div>
              <p className="gallery-eyebrow"><span>OH / PEDIDO</span> Resumen</p>
              <h2 id="order-title">Tu lista de pedido</h2>
            </div>
            <button className="gallery-icon-button" type="button" aria-label="Cerrar pedido" onClick={closeOrderDialog}><X size={20} /></button>
          </div>
          {order.length === 0 ? (
            <div className="gallery-order-empty">
              <ShoppingBag size={27} />
              <h3>Aún no agregas productos</h3>
              <p>Explora una categoría y agrega las referencias que quieras cotizar.</p>
              <button type="button" onClick={closeOrderDialog}>Volver al catálogo</button>
            </div>
          ) : (
            <>
              <div className="gallery-order-lines">
                {order.map((item) => (
                  <article className="gallery-order-line" key={item.id}>
                    <div className="gallery-order-line-copy">
                      <span>{item.category}</span>
                      <h3>{item.name}</h3>
                      <strong>{formatCurrency.format(item.price * item.quantity)}</strong>
                    </div>
                    <div className="gallery-order-line-actions">
                      <div className="gallery-quantity-control" aria-label={`Cantidad de ${item.name}`}>
                        <button type="button" aria-label={`Quitar una unidad de ${item.name}`} onClick={() => changeQuantity(item.id, -1)}><Minus size={13} /></button>
                        <span>{item.quantity}</span>
                        <button type="button" aria-label={`Agregar una unidad de ${item.name}`} onClick={() => changeQuantity(item.id, 1)}><Plus size={13} /></button>
                      </div>
                      <button className="gallery-remove-button" type="button" aria-label={`Eliminar ${item.name}`} onClick={() => changeQuantity(item.id, -item.quantity)}><Trash2 size={15} /></button>
                    </div>
                  </article>
                ))}
              </div>
              <div className="gallery-order-total">
                <span>Total estimado</span>
                <strong>{formatCurrency.format(orderTotal)}</strong>
                <small>El valor final se confirma al cotizar.</small>
              </div>
              <p className="gallery-order-disclaimer">
                {isCheckingSession
                  ? 'Comprobando tu sesión…'
                  : account
                    ? `Solicitud para ${account.email}. El total es referencial y no reserva inventario.`
                    : 'Inicia sesión o regístrate para solicitar una cotización.'}
              </p>
              {quoteError && <p className="gallery-quote-error" role="alert">{quoteError}</p>}
              <button className="gallery-quote-button" type="button" onClick={handleRequestQuote} disabled={isCheckingSession}>
                {isCheckingSession ? 'Verificando sesión…' : 'Solicitar cotización'} <ArrowRight size={17} />
              </button>
              <p className="gallery-order-disclaimer">Este resumen no confirma una compra.</p>
            </>
          )}
        </aside>
      </dialog>

      <dialog
        className={`gallery-quantity-dialog${isQuantityClosing ? ' is-closing' : ''}`}
        ref={quantityDialogRef}
        onClose={() => { setSelectedProduct(null); setIsQuantityClosing(false) }}
        onCancel={(event) => { event.preventDefault(); closeProductDialog() }}
      >
        {selectedProduct && (
          <form onSubmit={addSelectedProduct}>
            <div className="gallery-dialog-header">
              <div>
                <p className="gallery-eyebrow"><span>Agregar al pedido</span></p>
                <h2>{selectedProduct.name}</h2>
              </div>
              <button className="gallery-icon-button" type="button" aria-label="Cerrar" onClick={closeProductDialog}><X size={19} /></button>
            </div>
            <p className="gallery-dialog-price">{formatCurrency.format(selectedProduct.price)} <span>por unidad / jornada</span></p>
            <label className="gallery-quantity-label" htmlFor="gallery-quantity">Cantidad</label>
            <div className="gallery-dialog-quantity">
              <button type="button" aria-label="Disminuir cantidad" onClick={() => setQuantity((current) => Math.max(1, current - 1))}><Minus size={16} /></button>
              <input id="gallery-quantity" type="number" min="1" max="99" value={quantity} onChange={(event) => setQuantity(event.target.value)} required />
              <button type="button" aria-label="Aumentar cantidad" onClick={() => setQuantity((current) => Math.min(99, Number(current) + 1))}><Plus size={16} /></button>
            </div>
            <button className="gallery-quote-button" type="submit">Agregar a la lista <ArrowRight size={17} /></button>
          </form>
        )}
      </dialog>

      <dialog
        className={`gallery-notice-dialog${isQuoteNoticeClosing ? ' is-closing' : ''}`}
        ref={quoteNoticeDialogRef}
        aria-labelledby="quote-notice-title"
        onClose={() => { setIsQuoteNoticeOpen(false); setIsQuoteNoticeClosing(false) }}
        onCancel={(event) => { event.preventDefault(); closeQuoteNotice() }}
        onClick={(event) => { if (event.target === event.currentTarget) closeQuoteNotice() }}
      >
        <div className="gallery-notice-content">
          <button className="gallery-icon-button gallery-notice-close" type="button" aria-label="Cerrar aviso" onClick={closeQuoteNotice}>
            <X size={19} />
          </button>
          <span className="gallery-notice-icon"><TriangleAlert size={23} /></span>
          <p className="gallery-eyebrow"><span>Aviso temporal</span></p>
          <h2 id="quote-notice-title">La cotización sigue en desarrollo</h2>
          <p>Tu lista se conserva en esta pestaña. Pronto podrás enviar la solicitud directamente desde aquí.</p>
          <button className="gallery-notice-confirm" type="button" onClick={closeQuoteNotice}>Cerrar</button>
        </div>
      </dialog>
    </div>
  )
}

export default GalleryPage
