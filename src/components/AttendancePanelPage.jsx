import { useEffect, useMemo, useState } from 'react'
import { CalendarDays, Save, ShieldCheck } from 'lucide-react'
import { apiRequest } from '../utils/api.js'
import { attendanceAccessRoles, attendanceWorkerRoles, getRoleInfo } from '../../shared/roles.js'
import './AttendancePanelPage.css'

const attendanceOptions = [
  { value: 'present', label: 'Asistencia normal' },
  { value: 'late', label: 'Asistencia tardía' },
  { value: 'late_justified', label: 'Asistencia tardía justificada' },
  { value: 'absent', label: 'Inasistencia' },
]

const accessRoles = new Set(attendanceAccessRoles)
const workerRoles = new Set(attendanceWorkerRoles)

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
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    const previousTitle = document.title
    const previousRobots = document.querySelector('meta[name="robots"]')
    const previousRobotsContent = previousRobots?.content

    document.title = 'Lista de asistencia | OH Montajes y Eventos'
    if (previousRobots) {
      previousRobots.content = 'noindex, nofollow'
    } else {
      const robots = document.createElement('meta')
      robots.name = 'robots'
      robots.content = 'noindex, nofollow'
      document.head.append(robots)
    }

    return () => {
      document.title = previousTitle
      if (previousRobots) {
        previousRobots.content = previousRobotsContent
      } else {
        document.querySelector('meta[name="robots"]')?.remove()
      }
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
    if (isCheckingSession || !sessionAccount || !accessRoles.has(sessionAccount.role)) {
      return undefined
    }

    let isActive = true

    async function loadAttendance() {
      try {
        const [workersResult, attendanceResult] = await Promise.all([
          apiRequest('/api/auth/attendance/workers'),
          apiRequest(`/api/auth/attendance?date=${selectedDate}`),
        ])

        if (!isActive) return

        const nextWorkers = Array.isArray(workersResult.workers)
          ? workersResult.workers.filter((worker) => attendanceWorkerRoles.includes(worker.role))
          : []
        const nextMap = Object.fromEntries((attendanceResult.records ?? []).map((record) => [String(record.accountId), record]))

        setWorkers(nextWorkers)
        setDraft(Object.fromEntries(
          nextWorkers.map((worker) => {
            const existing = nextMap[String(worker.id)]
            return [String(worker.id), existing?.status ?? 'present']
          }),
        ))
        setHasUnsavedChanges(false)
        setError('')
      } catch (requestError) {
        if (isActive) {
          setError(requestError.message || 'No se pudo cargar la asistencia.')
        }
      }
    }

    loadAttendance()
    return () => { isActive = false }
  }, [isCheckingSession, selectedDate, sessionAccount])

  const visibleWorkers = useMemo(
    () => workers.filter((worker) => workerRoles.has(worker.role)),
    [workers],
  )

  async function handleSave() {
    if (!sessionAccount || !accessRoles.has(sessionAccount.role)) {
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

      setHasUnsavedChanges(false)
      setNotice('El registro de asistencia quedó guardado correctamente.')
    } catch (requestError) {
      setError(requestError.message || 'No se pudo guardar la asistencia.')
    } finally {
      setIsSaving(false)
    }
  }

  const isAccessBlocked = !isCheckingSession && (!sessionAccount || !accessRoles.has(sessionAccount.role))

  if (isCheckingSession) {
    return (
      <main className="attendance-panel-page">
        <div className="attendance-state" role="status">Comprobando acceso…</div>
      </main>
    )
  }

  if (isAccessBlocked) {
    return (
      <main className="attendance-panel-page">
        <div className="attendance-state" role="alert">
          <ShieldCheck size={28} />
          <h1>Acceso restringido</h1>
          <p>Esta sección solo está disponible para el Dueño, el Jefe de Bodega, el Contador y la Secretaria.</p>
          <a href="/cuenta">Volver a mi cuenta</a>
        </div>
      </main>
    )
  }

  return (
    <main className="attendance-panel-page">
      <header className="attendance-panel-topbar">
        <a href="/cuenta" className="attendance-panel-back">Volver a mi cuenta</a>
        <span className="attendance-panel-brand">OH / ASISTENCIA</span>
      </header>

      <div className="attendance-panel-shell">
        <section className="attendance-panel-heading">
          <div>
            <p className="attendance-panel-eyebrow"><span>CONTROL / 02</span> Registro diario</p>
            <h1>Lista de asistencia</h1>
          </div>
          <label className="attendance-date-picker" aria-label="Seleccionar fecha de asistencia">
            <CalendarDays size={16} />
            <input type="date" value={selectedDate} onChange={(event) => setSelectedDate(event.target.value)} />
          </label>
        </section>

        <section className="attendance-panel-summary">
          <div className="attendance-panel-summary-item">
            <span className="attendance-summary-label">Fecha actual</span>
            <strong>{formatDayLabel(selectedDate)}</strong>
          </div>
          <div className="attendance-panel-summary-item">
            <span className="attendance-summary-label">Personal activo</span>
            <strong>{visibleWorkers.length} colaboradores</strong>
          </div>
        </section>

        {notice && <p className="attendance-panel-notice" role="status">{notice}</p>}
        {error && <p className="attendance-panel-error" role="alert">{error}</p>}

        <section className="attendance-panel-card" aria-label="Listado de asistencia por trabajador">
          <div className="attendance-panel-table-header">
            <span>Trabajador</span>
            <span>Rol</span>
            <span>Asistencia</span>
          </div>

          {visibleWorkers.length === 0 ? (
            <p className="attendance-panel-empty">No hay personal disponible para esta fecha.</p>
          ) : (
            <div className="attendance-panel-list">
              {visibleWorkers.map((worker) => (
                <div key={worker.id} className="attendance-panel-row">
                  <div className="attendance-worker-meta">
                    <span className="attendance-worker-name">{worker.name}</span>
                    <small className="attendance-worker-email">{worker.email}</small>
                  </div>
                  <span className="attendance-role-pill">{getRoleInfo(worker.role).label}</span>
                  <label className="attendance-status-wrap">
                    <select
                      value={draft[String(worker.id)] ?? 'present'}
                      onChange={(event) => {
                        const nextValue = event.target.value
                        setDraft((current) => ({ ...current, [String(worker.id)]: nextValue }))
                        setHasUnsavedChanges(true)
                      }}
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

          <div className="attendance-panel-actions">
            <button type="button" onClick={handleSave} className="attendance-panel-save" disabled={isSaving || !hasUnsavedChanges || visibleWorkers.length === 0}>
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
