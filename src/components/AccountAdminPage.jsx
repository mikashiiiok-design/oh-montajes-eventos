import { useEffect, useRef, useState } from 'react'
import { ArrowLeft, Ban, RefreshCw, Search, ShieldCheck, UserCog, X } from 'lucide-react'
import { accountRoleById, accountRoles } from '../../shared/roles.js'
import { apiRequest } from '../utils/api.js'
import AccountRoleBadge from './AccountRoleBadge.jsx'
import './AccountAdminPage.css'

const formatDate = new Intl.DateTimeFormat('es-CO', {
  dateStyle: 'medium',
  timeStyle: 'short',
})

function formatClientId(id) {
  return `OH-${String(id).padStart(6, '0')}`
}

function getAuditLabel(event) {
  if (event.action === 'role_changed') {
    const previousRole = accountRoleById[event.previous_value]?.label ?? event.previous_value
    const newRole = accountRoleById[event.new_value]?.label ?? event.new_value
    return `Cambió el rol de ${previousRole} a ${newRole}`
  }
  if (event.action === 'account_banned') return `Suspendió la cuenta: ${event.details}`
  return 'Reactivó la cuenta'
}

function AccountAdminPage() {
  const [sessionAccount, setSessionAccount] = useState(null)
  const [isCheckingSession, setIsCheckingSession] = useState(true)
  const [accounts, setAccounts] = useState([])
  const [auditEvents, setAuditEvents] = useState([])
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [loadedSearch, setLoadedSearch] = useState(null)
  const [pageError, setPageError] = useState('')
  const [notice, setNotice] = useState('')
  const [selectedAccount, setSelectedAccount] = useState(null)
  const [dialogAction, setDialogAction] = useState(null)
  const [roleDraft, setRoleDraft] = useState('client')
  const [banReason, setBanReason] = useState('')
  const [dialogError, setDialogError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isDialogClosing, setIsDialogClosing] = useState(false)
  const dialogRef = useRef(null)
  const closeTimeoutRef = useRef(null)

  useEffect(() => {
    const previousTitle = document.title
    const previousRobots = document.querySelector('meta[name="robots"]')
    const previousRobotsContent = previousRobots?.content
    document.title = 'Administración de cuentas | OH Montajes y Eventos'
    if (previousRobots) previousRobots.content = 'noindex, nofollow'
    else {
      const robots = document.createElement('meta')
      robots.name = 'robots'
      robots.content = 'noindex, nofollow'
      document.head.append(robots)
    }
    return () => {
      document.title = previousTitle
      if (previousRobots) previousRobots.content = previousRobotsContent
      else document.querySelector('meta[name="robots"]')?.remove()
    }
  }, [])

  useEffect(() => {
    let isActive = true
    apiRequest('/api/auth/me')
      .then(({ account }) => { if (isActive) setSessionAccount(account) })
      .catch(() => { if (isActive) setSessionAccount(null) })
      .finally(() => { if (isActive) setIsCheckingSession(false) })
    return () => { isActive = false }
  }, [])

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search.trim()), 240)
    return () => window.clearTimeout(timer)
  }, [search])

  useEffect(() => {
    if (sessionAccount?.role !== 'owner') return undefined
    let isActive = true
    const query = new URLSearchParams({ search: debouncedSearch })

    Promise.all([
      apiRequest(`/api/auth/admin/accounts?${query}`),
      apiRequest('/api/auth/admin/audit?limit=15'),
    ])
      .then(([accountResult, auditResult]) => {
        if (!isActive) return
        setAccounts(accountResult.accounts)
        setAuditEvents(auditResult.events)
        setPageError('')
      })
      .catch((requestError) => {
        if (isActive) setPageError(requestError.message)
      })
      .finally(() => { if (isActive) setLoadedSearch(debouncedSearch) })

    return () => { isActive = false }
  }, [sessionAccount, debouncedSearch])

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (selectedAccount && dialogAction && !dialog.open) dialog.showModal()
    if ((!selectedAccount || !dialogAction) && dialog.open) dialog.close()
  }, [selectedAccount, dialogAction])

  useEffect(() => () => window.clearTimeout(closeTimeoutRef.current), [])

  async function reloadData() {
    const query = new URLSearchParams({ search: debouncedSearch })
    const [accountResult, auditResult] = await Promise.all([
      apiRequest(`/api/auth/admin/accounts?${query}`),
      apiRequest('/api/auth/admin/audit?limit=15'),
    ])
    setAccounts(accountResult.accounts)
    setAuditEvents(auditResult.events)
  }

  function openAction(account, action) {
    window.clearTimeout(closeTimeoutRef.current)
    setIsDialogClosing(false)
    setDialogError('')
    setSelectedAccount(account)
    setDialogAction(action)
    setRoleDraft(account.role)
    setBanReason('')
  }

  function closeActionDialog() {
    if (!selectedAccount || isDialogClosing || isSubmitting) return
    setIsDialogClosing(true)
    closeTimeoutRef.current = window.setTimeout(() => {
      setSelectedAccount(null)
      setDialogAction(null)
      setIsDialogClosing(false)
    }, 180)
  }

  async function submitAction(event) {
    event.preventDefault()
    if (!selectedAccount || !dialogAction) return
    setDialogError('')
    setIsSubmitting(true)

    try {
      if (dialogAction === 'role') {
        await apiRequest(`/api/auth/admin/accounts/${selectedAccount.id}/role`, {
          method: 'POST',
          body: JSON.stringify({ role: roleDraft }),
        })
      } else {
        await apiRequest(`/api/auth/admin/accounts/${selectedAccount.id}/ban`, {
          method: 'POST',
          body: JSON.stringify({
            isBanned: dialogAction === 'ban',
            reason: dialogAction === 'ban' ? banReason.trim() : '',
          }),
        })
      }
      setNotice(dialogAction === 'role' ? 'Rol actualizado.' : dialogAction === 'ban' ? 'Cuenta suspendida y sesiones cerradas.' : 'Cuenta reactivada.')
      await reloadData()
      closeTimeoutRef.current = window.setTimeout(() => {
        setSelectedAccount(null)
        setDialogAction(null)
        setIsDialogClosing(false)
      }, 180)
    } catch (requestError) {
      setDialogError(requestError.message)
    } finally {
      setIsSubmitting(false)
    }
  }

  function handleDialogClose() {
    setSelectedAccount(null)
    setDialogAction(null)
    setIsDialogClosing(false)
  }

  const isOwner = sessionAccount?.role === 'owner'
  const isLoadingAccounts = isOwner && loadedSearch !== debouncedSearch

  return (
    <main className="account-admin-page">
      <header className="account-admin-topbar">
        <a href="/cuenta" className="account-admin-back"><ArrowLeft size={16} /> Cuenta</a>
        <span className="account-admin-brand">OH / ADMINISTRACIÓN</span>
      </header>

      {isCheckingSession ? (
        <div className="account-admin-state" role="status">Comprobando acceso…</div>
      ) : !sessionAccount ? (
        <section className="account-admin-state">
          <ShieldCheck size={28} />
          <h1>Inicia sesión para continuar</h1>
          <p>La administración está disponible únicamente para la cuenta Dueño.</p>
          <a href="/cuenta?modo=login">Iniciar sesión</a>
        </section>
      ) : !isOwner ? (
        <section className="account-admin-state" role="alert">
          <ShieldCheck size={28} />
          <h1>Acceso restringido</h1>
          <p>Esta sección es exclusiva para el rol Dueño.</p>
          <a href="/cuenta">Volver a mi cuenta</a>
        </section>
      ) : (
        <div className="account-admin-content">
          <section className="account-admin-heading">
            <div>
              <p className="account-admin-eyebrow"><span>CONTROL / 01</span> Usuarios y accesos</p>
              <h1>Administración de cuentas</h1>
              <p>Busca por ID de cliente, nombre o correo. Cada cambio queda registrado.</p>
            </div>
            <span className="account-admin-owner"><ShieldCheck size={15} /> Dueño</span>
          </section>

          {notice && <p className="account-admin-notice" role="status">{notice}</p>}
          {pageError && <p className="account-admin-error" role="alert">{pageError}</p>}

          <section className="account-admin-directory" aria-labelledby="accounts-heading">
            <div className="account-admin-section-heading">
              <div>
                <p className="account-admin-eyebrow"><span>01</span> Directorio</p>
                <h2 id="accounts-heading">Cuentas registradas</h2>
              </div>
              <span className="account-admin-count">{accounts.length} resultados · máximo 50</span>
            </div>
            <label className="account-admin-search">
              <Search size={17} aria-hidden="true" />
              <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="ID OH-000001, nombre o correo" aria-label="Buscar cuenta" />
              {search && <button type="button" aria-label="Limpiar búsqueda" onClick={() => setSearch('')}><X size={16} /></button>}
            </label>
            {isLoadingAccounts ? (
              <p className="account-admin-loading" role="status">Buscando cuentas…</p>
            ) : accounts.length === 0 ? (
              <p className="account-admin-empty">No hay cuentas que coincidan con la búsqueda.</p>
            ) : (
              <div className="account-admin-list">
                {accounts.map((account) => (
                  <article className={`account-admin-row${account.isBanned ? ' is-banned' : ''}`} key={account.id}>
                    <div className="account-admin-person">
                      <span className="account-admin-id">{formatClientId(account.id)}</span>
                      <h3>{account.name}</h3>
                      <p>{account.email}</p>
                      {account.isBanned && <span className="account-admin-suspended">Suspendida{account.bannedReason ? ` · ${account.bannedReason}` : ''}</span>}
                    </div>
                    <AccountRoleBadge role={account.role} />
                    <div className="account-admin-actions">
                      <button type="button" disabled={String(account.id) === String(sessionAccount.id)} title={String(account.id) === String(sessionAccount.id) ? 'No puedes cambiar tu propio rol' : undefined} onClick={() => openAction(account, 'role')}><UserCog size={15} /> Cambiar rol</button>
                      {account.isBanned ? (
                        <button type="button" onClick={() => openAction(account, 'restore')}><RefreshCw size={15} /> Reactivar</button>
                      ) : (
                        <button type="button" className="account-admin-ban" disabled={account.role === 'owner'} onClick={() => openAction(account, 'ban')}><Ban size={15} /> Suspender</button>
                      )}
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>

          <section className="account-admin-audit" aria-labelledby="audit-heading">
            <div className="account-admin-section-heading">
              <div>
                <p className="account-admin-eyebrow"><span>02</span> Seguimiento</p>
                <h2 id="audit-heading">Actividad administrativa</h2>
              </div>
            </div>
            {auditEvents.length === 0 ? (
              <p className="account-admin-empty">Los cambios de rol y estado aparecerán aquí.</p>
            ) : (
              <ol className="account-admin-audit-list">
                {auditEvents.map((event) => (
                  <li key={event.id}>
                    <span className="account-admin-audit-mark" />
                    <div>
                      <p><strong>{event.actor_name ?? 'Cuenta eliminada'}</strong> · {getAuditLabel(event)}</p>
                      <span>{formatClientId(event.target_id)} · {event.target_name} · {formatDate.format(new Date(event.created_at))}</span>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </section>
        </div>
      )}

      <dialog
        className={`account-admin-dialog${isDialogClosing ? ' is-closing' : ''}`}
        ref={dialogRef}
        onClose={handleDialogClose}
        onCancel={(event) => { event.preventDefault(); closeActionDialog() }}
      >
        {selectedAccount && dialogAction && (
          <form onSubmit={submitAction}>
            <div className="account-admin-dialog-head">
              <div>
                <p className="account-admin-eyebrow"><span>{formatClientId(selectedAccount.id)}</span> Confirmar acción</p>
                <h2>{dialogAction === 'role' ? 'Cambiar rol' : dialogAction === 'ban' ? 'Suspender cuenta' : 'Reactivar cuenta'}</h2>
                <p>{selectedAccount.name} · {selectedAccount.email}</p>
              </div>
              <button className="account-admin-icon-button" type="button" aria-label="Cerrar" onClick={closeActionDialog}><X size={19} /></button>
            </div>
            {dialogAction === 'role' ? (
              <label className="account-admin-field">
                Nuevo rol
                <select value={roleDraft} onChange={(event) => setRoleDraft(event.target.value)} disabled={String(selectedAccount.id) === '1'}>
                  {accountRoles.map((role) => <option key={role.id} value={role.id}>Nivel {role.level} · {role.label}</option>)}
                </select>
                {String(selectedAccount.id) === '1' && <small>La cuenta OH-000001 conserva el rol Dueño.</small>}
              </label>
            ) : dialogAction === 'ban' ? (
              <label className="account-admin-field">
                Motivo de suspensión
                <textarea minLength={5} maxLength={250} required value={banReason} onChange={(event) => setBanReason(event.target.value)} placeholder="Describe brevemente el motivo (5–250 caracteres)." />
                <small>Se cerrarán todas las sesiones activas de esta cuenta.</small>
              </label>
            ) : (
              <p className="account-admin-restore-copy">La cuenta podrá volver a iniciar sesión y usar las funciones permitidas por su rol actual.</p>
            )}
            {dialogError && <p className="account-admin-error" role="alert">{dialogError}</p>}
            <div className="account-admin-dialog-actions">
              <button className="account-admin-cancel" type="button" onClick={closeActionDialog} disabled={isSubmitting}>Cancelar</button>
              <button className={`account-admin-confirm${dialogAction === 'ban' ? ' is-danger' : ''}`} type="submit" disabled={isSubmitting}>
                {isSubmitting ? 'Guardando…' : dialogAction === 'role' ? 'Guardar rol' : dialogAction === 'ban' ? 'Suspender cuenta' : 'Reactivar cuenta'}
              </button>
            </div>
          </form>
        )}
      </dialog>
    </main>
  )
}

export default AccountAdminPage
