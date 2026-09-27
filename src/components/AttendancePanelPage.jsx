import { useEffect, useMemo, useState } from 'react'
import { CalendarDays, Save, ShieldCheck } from 'lucide-react'
import { apiRequest } from '../utils/api.js'
import { accountRoleById } from '../../shared/roles.js'
import './AttendancePanelPage.css'

const attendanceOptions = [
  { value: 'present', label: 'Asistencia normal' },
  { value: 'late', label: 'Asistencia tardía' },
  { value: 'late_justified', label: 'Asistencia tardía justificada' },
  { value: 'absent', label: 'Inasistencia' },
]

const allowedRoles = new Set(['owner', 'accountant', 'warehouse_manager', 'secretary'])

function toDateInputValue(date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function formatDayLabel(dateString) {
  const date = new Date(`${dateString}T12:00:00`)
  return new Intl.DateTimeFormat('es-CO', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(date)
}

function AttendancePanelPage() {
  const [sessionAccount, setSessionAccount] = useState(null)
  const [isCheckingSession, setIsCheckingSession] = useState(true)
  const [selectedDate, setSelectedDate] = useState(toDateInputValue(new Date()))
  const [workers, setWorkers] = useState([])
  const [draft, setDraft] = useState({})
  const [isSaving, setIsSaving] = useState(false)
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    const previousTitle = document.title
    const previousRobots = document.querySelector('meta[name="robots"]')
    const previousRobotsContent = previousRobots?.content
    document.title = 'Lista de asistencia | OH Montajes y Eventos'
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

    async function refreshSession() {
      try {
        const { account } = await apiRequest('/api/auth/me')
        if (!isActive) return
        setSessionAccount(account)
      } catch {
        if (isActive) setSessionAccount(null)
      } finally {
        if (isActive) setIsCheckingSession(false)
      }
    }

    refreshSession()
    return () => { isActive = false }
  }, [])

  useEffect(() => {
    if (!isCheckingSession && (!sessionAccount || !allowedRoles.has(sessionAccount.role))) {
      window.location.replace('/404')
      return
    }

    let isActive = true

    async function loadAttendance() {
      try {
        const [workersResult, attendanceResult] = await Promise.all([
          apiRequest('/api/auth/attendance/workers'),
          apiRequest(`/api/auth/attendance?date=${selectedDate}`),
        ])

        if (!isActive) return

        const nextWorkers = workersResult.workers ?? []
        const nextMap = Object.fromEntries((attendanceResult.records ?? []).map((record) => [String(record.accountId), record]))
        setWorkers(nextWorkers)

        const nextDraft = Object.fromEntries(
          nextWorkers.map((worker) => {
            const existing = nextMap[String(worker.id)]
            return [String(worker.id), existing?.status ?? 'present']
          }),
        )
        setDraft(nextDraft)
        setError('')
      } catch (requestError) {
        if (isActive) setError(requestError.message)
      }
    }

    loadAttendance()
    return () => { isActive = false }
  }, [sessionAccount, isCheckingSession, selectedDate])

  const visibleWorkers = useMemo(
    () => workers.filter((worker) => allowedRoles.has(worker.role)),
    [workers],
  )

  async function handleSave() {
    if (!sessionAccount || !allowedRoles.has(sessionAccount.role)) {
      window.location.replace('/404')
      return
    }

    setIsSaving(true)
    setNotice('')
    setError('')

    try {
      const entries = visibleWorkers.map((worker) => ({
        accountId: worker.id,
        status: draft[String(worker.id)] ?? 'present',
      }))

      await apiRequest('/api/auth/attendance', {
        method: 'POST',
        body: JSON.stringify({ date: selectedDate, entries }),
      })

      setNotice('El registro de asistencia quedó guardado y no puede ser alterado en esta sesión.')
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setIsSaving(false)
    }
  }

  const isAccessBlocked = !isCheckingSession && (!sessionAccount || !allowedRoles.has(sessionAccount.role))

  if (isCheckingSession) {
    return <main className="attendance-panel"><div className="attendance-state" role="status">Comprobando acceso…</div></main>
  }

  if (isAccessBlocked) {
    return <main className="attendance-panel"><div className="attendance-state" role="alert"><ShieldCheck size={28} /><h1>Acceso restringido</h1><p>Esta sección está disponible solo para personal autorizado.</p><a href="/cuenta">Volver a mi cuenta</a></div></main>
  }

  return (
    <main className="attendance-panel">
      <header className="attendance-topbar">
        <a href="/cuenta" className="attendance-back">Volver a mi cuenta</a>
        <span className="attendance-brand">OH / ASISTENCIA</span>
      </header>

      <div className="attendance-shell">
        <section className="attendance-header">
          <div>
            <p className="attendance-kicker"><span>CONTROL / 02</span> Registro diario</p>
            <h1>Lista de asistencia</h1>
          </div>
          <div className="attendance-date-picker">
            <CalendarDays size={16} />
            <input type="date" value={selectedDate} onChange={(event) => setSelectedDate(event.target.value)} aria-label="Seleccionar fecha de asistencia" />
          </div>
        </section>

        <section className="attendance-summary">
          <div>
            <span>Fecha actual</span>
            <strong>{formatDayLabel(selectedDate)}</strong>
          </div>
          <div>
            <span>Personal activo</span>
            <strong>{visibleWorkers.length} colaboradores</strong>
          </div>
        </section>

        {notice && <p className="attendance-notice" role="status">{notice}</p>}
        {error && <p className="attendance-error" role="alert">{error}</p>}

        <section className="attendance-table-card" aria-label="Listado de asistencia por trabajador">
          <div className="attendance-table-head">
            <span>Trabajador</span>
            <span>Rol</span>
            <span>Asistencia</span>
          </div>

          {visibleWorkers.length === 0 ? (
            <p className="attendance-empty">No hay personal disponible para esta fecha.</p>
          ) : (
            <div className="attendance-list">
              {visibleWorkers.map((worker) => (
                <div key={worker.id} className="attendance-row">
                  <div className="attendance-worker">
                    <span className="attendance-name">{worker.name}</span>
                    <small>{worker.email}</small>
                  </div>
                  <span className="attendance-role-badge">{accountRoleById[worker.role]?.label ?? worker.role}</span>
                  <label className="attendance-select-wrap">
                    <select
                      value={draft[String(worker.id)] ?? 'present'}
                      onChange={(event) => setDraft((current) => ({ ...current, [String(worker.id)]: event.target.value }))}
                      aria-label={`Estado de asistencia para ${worker.name}`}
                    >
                      {attendanceOptions.map((option) => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                      ))}
                    </select>
                  </label>
                </div>
              ))}
            </div>
          )}

          <div className="attendance-actions">
            <button type="button" className="attendance-save" onClick={handleSave} disabled={isSaving}>
              {isSaving ? 'Guardando…' : 'Guardar registro'}
              {!isSaving && <Save size={15} />}
            </button>
          </div>
        </section>
      </div>
    </main>
  )
}

export default AttendancePanelPage
