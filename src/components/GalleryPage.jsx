import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowLeft, ArrowRight, Minus, Plus, ShoppingBag, Trash2, X } from 'lucide-react'
import { galleryCategories } from '../data/gallery.js'
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
  const [selectedProduct, setSelectedProduct] = useState(null)
  const [quantity, setQuantity] = useState(1)
  const quantityDialogRef = useRef(null)
  const orderDialogRef = useRef(null)

  const activeCategory = galleryCategories.find((category) => category.id === activeCategoryId)
  const orderCount = order.reduce((total, item) => total + item.quantity, 0)
  const orderTotal = order.reduce((total, item) => total + item.price * item.quantity, 0)

  const quoteEmail = useMemo(() => {
    const summary = order.map((item) => (
      `${item.quantity} x ${item.name} | ${formatCurrency.format(item.price * item.quantity)}`
    ))
    const body = [
      'Hola, quisiera cotizar los siguientes elementos:',
      '',
      ...summary,
      '',
      `Total estimado: ${formatCurrency.format(orderTotal)}`,
      '',
      'Entiendo que disponibilidad, transporte e instalacion se confirman con el equipo.',
    ].join('\n')
    return `mailto:ayuda@ohmontajesyeventos.com?subject=${encodeURIComponent('Solicitud de cotizacion de mobiliario')}&body=${encodeURIComponent(body)}`
  }, [order, orderTotal])

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
    if (!activeCategoryId) return
    document.getElementById('catalogo')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [activeCategoryId])

  function openProductDialog(product) {
    setQuantity(1)
    setSelectedProduct(product)
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
    setSelectedProduct(null)
  }

  function changeQuantity(productId, difference) {
    setOrder((currentOrder) => currentOrder
      .map((item) => item.id === productId
        ? { ...item, quantity: Math.max(0, Math.min(99, item.quantity + difference)) }
        : item)
      .filter((item) => item.quantity > 0))
  }

  return (
    <div className="gallery-page">
      <section className="gallery-intro page-shell" aria-labelledby="gallery-title">
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

      <section className="gallery-categories page-shell" aria-label="Categorías del catálogo">
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
          <div className="gallery-category-grid">
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
        <section className="gallery-catalog page-shell" id="catalogo" aria-labelledby="catalog-title">
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
              <article className="gallery-product" key={product.id}>
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
        <button type="button" onClick={() => setIsOrderOpen(true)}>
          <ShoppingBag size={17} /> Ver pedido {orderCount > 0 && <b>{orderCount}</b>}
        </button>
      </div>

      <dialog className="gallery-order-dialog" ref={orderDialogRef} onClose={() => setIsOrderOpen(false)} onClick={(event) => { if (event.target === event.currentTarget) setIsOrderOpen(false) }}>
        <aside className="gallery-order-drawer" aria-labelledby="order-title">
          <div className="gallery-order-header">
            <div>
              <p className="gallery-eyebrow"><span>OH / PEDIDO</span> Resumen</p>
              <h2 id="order-title">Tu lista de pedido</h2>
            </div>
            <button className="gallery-icon-button" type="button" aria-label="Cerrar pedido" onClick={() => setIsOrderOpen(false)}><X size={20} /></button>
          </div>
          {order.length === 0 ? (
            <div className="gallery-order-empty">
              <ShoppingBag size={27} />
              <h3>Aún no agregas productos</h3>
              <p>Explora una categoría y agrega las referencias que quieras cotizar.</p>
              <button type="button" onClick={() => setIsOrderOpen(false)}>Volver al catálogo</button>
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
              <a className="gallery-quote-button" href={quoteEmail}>
                Solicitar cotización <ArrowRight size={17} />
              </a>
              <p className="gallery-order-disclaimer">Este resumen no confirma una compra ni reserva inventario.</p>
            </>
          )}
        </aside>
      </dialog>

      <dialog className="gallery-quantity-dialog" ref={quantityDialogRef} onClose={() => setSelectedProduct(null)}>
        {selectedProduct && (
          <form onSubmit={addSelectedProduct}>
            <div className="gallery-dialog-header">
              <div>
                <p className="gallery-eyebrow"><span>Agregar al pedido</span></p>
                <h2>{selectedProduct.name}</h2>
              </div>
              <button className="gallery-icon-button" type="button" aria-label="Cerrar" onClick={() => setSelectedProduct(null)}><X size={19} /></button>
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
    </div>
  )
}

export default GalleryPage
